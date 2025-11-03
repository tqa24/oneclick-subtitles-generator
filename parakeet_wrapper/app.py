import os
import gc
import logging
import datetime
import tempfile
import shutil
from pathlib import Path
from contextlib import asynccontextmanager

import numpy as np
import uvicorn
from onnx_asr import load_model
from pydub import AudioSegment
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Literal

# --- Configuration and Logging Setup ---

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

MODEL_NAME = os.getenv("ASR_MODEL_NAME", "istupakov/parakeet-tdt-0.6b-v3-onnx")
app_state = {}

# --- FastAPI Lifespan Management ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Loading ASR model: {MODEL_NAME}...")
    try:
        model = load_model(MODEL_NAME)
        app_state["asr_model"] = model.with_timestamps()
        logger.info("ASR model loaded successfully.")
    except Exception as e:
        logger.error(f"Failed to load ASR model: {e}", exc_info=True)
        app_state["asr_model"] = None
    
    yield

    logger.info("Cleaning up resources...")
    app_state.clear()
    gc.collect()
    logger.info("Shutdown complete.")

# --- FastAPI App Initialization ---

app = FastAPI(
    title="Parakeet Speech Transcription API",
    version="1.0.0",
    lifespan=lifespan
)

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# --- Helper Functions ---

def format_srt_time(seconds: float) -> str:
    if seconds < 0: seconds = 0.0
    delta = datetime.timedelta(seconds=seconds)
    hours, remainder = divmod(int(delta.total_seconds()), 3600)
    minutes, secs = divmod(remainder, 60)
    milliseconds = delta.microseconds // 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{milliseconds:03d}"

def generate_srt_content(segment_timestamps: list) -> str:
    srt_content = []
    for i, ts in enumerate(segment_timestamps):
        start_time = format_srt_time(ts['start'])
        end_time = format_srt_time(ts['end'])
        text = ts['segment']
        srt_content.append(str(i + 1))
        srt_content.append(f"{start_time} --> {end_time}")
        srt_content.append(text)
        srt_content.append("")
    return "\n".join(srt_content)

def _group_tokens_into_words(tokens: list, timestamps: list) -> list:
    words = []
    current_word_tokens = []
    current_word_start_time = None
    if not tokens: return []
    for i, token in enumerate(tokens):
        if current_word_start_time is None:
            current_word_start_time = timestamps[i]
        if token.startswith(" "):
            if current_word_tokens:
                word_text = "".join(current_word_tokens).strip()
                words.append({"text": word_text, "start": current_word_start_time})
            current_word_tokens = [token]
            current_word_start_time = timestamps[i]
        else:
            current_word_tokens.append(token)
    if current_word_tokens:
        word_text = "".join(current_word_tokens).strip()
        words.append({"text": word_text, "start": current_word_start_time})
    return words

def process_timestamped_result(timestamped_result, audio_duration_sec: float, segment_strategy: str, max_chars: int, pause_threshold: float) -> list:
    """
    FINAL VERSION: Estimates word duration to accurately detect pauses and uses a robust
    hierarchy of rules for segmentation. Restores distinct 'char' and 'sentence' strategies.
    """
    # Tunable heuristic for estimating speech duration
    AVG_CHAR_DURATION = 0.07  # 70ms per character

    timestamps = timestamped_result.timestamps
    tokens = timestamped_result.tokens
    if not timestamps or not tokens: return []

    words = _group_tokens_into_words(tokens, timestamps)
    if not words: return []

    segments = []
    current_segment_words = []
    current_segment_start = -1

    for i, word in enumerate(words):
        if current_segment_start == -1:
            current_segment_start = word['start']

        is_last_word = (i == len(words) - 1)

        # Estimate the end time of the current word based on its length
        estimated_speech_duration = len(word['text']) * AVG_CHAR_DURATION
        estimated_end_time = word['start'] + estimated_speech_duration
        
        # Ensure the estimated end time doesn't overlap the next word
        if not is_last_word:
            estimated_end_time = min(estimated_end_time, words[i+1]['start'])
        else:
            estimated_end_time = min(estimated_end_time, audio_duration_sec)
        
        # Calculate the pause *after* this word
        pause_after_word = 0
        if not is_last_word:
            pause_after_word = words[i+1]['start'] - estimated_end_time

        current_segment_words.append(word['text'])
        current_text = " ".join(current_segment_words)
        
        end_segment = False
        if is_last_word:
            end_segment = True
        elif pause_after_word >= pause_threshold:
            end_segment = True
        elif segment_strategy == 'sentence' and word['text'].strip().endswith(('.', '?', '!')):
            end_segment = True
        elif len(current_text) + (len(words[i+1]['text']) + 1 if not is_last_word else 0) > max_chars:
            end_segment = True
        
        if end_segment:
            segments.append({
                'start': current_segment_start,
                'end': estimated_end_time,
                'segment': current_text.strip()
            })
            current_segment_words = []
            current_segment_start = -1

    return segments

# --- Core Transcription Logic ---

def transcribe_audio(audio_path: str, model, segment_strategy: str, max_chars: int, pause_threshold: float) -> dict:
    if not model:
        raise HTTPException(status_code=503, detail="ASR model is not available.")
    
    try:
        audio = AudioSegment.from_file(audio_path)
        duration_sec = audio.duration_seconds
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not process audio file: {e}")

    target_sr = 16000
    transcribe_path = audio_path
    processed_audio_path = None
    
    if (audio.frame_rate != target_sr) or (audio.channels != 1):
        if audio.frame_rate != target_sr: audio = audio.set_frame_rate(target_sr)
        if audio.channels != 1: audio = audio.set_channels(1)
        with tempfile.NamedTemporaryFile(suffix='_processed.wav', delete=False) as temp_f:
            processed_audio_path = Path(temp_f.name)
        audio.export(processed_audio_path, format="wav")
        transcribe_path = str(processed_audio_path)

    try:
        result = model.recognize(transcribe_path)
        segment_timestamps = process_timestamped_result(result, duration_sec, segment_strategy, max_chars, pause_threshold)
        srt_content = generate_srt_content(segment_timestamps)
        return {
            "transcription": result.text,
            "segments": segment_timestamps,
            "srt_content": srt_content,
            "duration_seconds": duration_sec
        }
    finally:
        if processed_audio_path:
            processed_audio_path.unlink()

# --- API Endpoints ---

@app.get("/")
async def root():
    return {"message": "Parakeet Speech Transcription API", "version": "1.0.0"}

@app.post("/transcribe")
async def transcribe_endpoint(
    file: UploadFile = File(...),
    segment_strategy: str = Form("sentence", enum=["char", "sentence"]),
    max_chars: int = Form(42, gt=10, le=200),
    pause_threshold: float = Form(0.8, gt=0.1, le=5.0)
):
    """
    Accepts an audio file and transcription parameters.
    - **segment_strategy**: 'sentence' (breaks on pauses/punctuation) or 'char' (breaks on pauses/char limit).
    - **max_chars**: The character limit fallback for line breaking.
    - **pause_threshold**: Seconds of silence to trigger a new subtitle segment.
    """
    if not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail=f"Invalid file type: '{file.content_type}'.")

    temp_path = None
    try:
        suffix = Path(file.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            shutil.copyfileobj(file.file, temp_file)
            temp_path = temp_file.name
        
        asr_model = app_state.get("asr_model")
        result = transcribe_audio(temp_path, asr_model, segment_strategy, max_chars, pause_threshold)
        return JSONResponse(content=result)
    finally:
        if temp_path and Path(temp_path).exists():
            Path(temp_path).unlink()

class TranscribeBase64Request(BaseModel):
    audio_base64: str
    filename: Optional[str] = "audio.wav"
    segment_strategy: Literal['char', 'sentence'] = 'sentence'
    max_chars: int = 42
    pause_threshold: float = 0.8

@app.post("/transcribe_base64")
async def transcribe_base64_endpoint(payload: TranscribeBase64Request):
    import base64
    temp_path = None
    try:
        audio_b64 = payload.audio_base64
        if "," in audio_b64 and audio_b64.strip().startswith("data:"):
            audio_b64 = audio_b64.split(",", 1)[1]
        
        suffix = ''.join(Path(payload.filename).suffixes)
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
            temp_path = Path(f.name)
            f.write(base64.b64decode(audio_b64))

        asr_model = app_state.get("asr_model")
        result = transcribe_audio(
            str(temp_path), asr_model, payload.segment_strategy,
            payload.max_chars, payload.pause_threshold
        )
        return JSONResponse(content=result)
    finally:
        if temp_path and Path(temp_path).exists():
            Path(temp_path).unlink()

# --- Main Execution ---

if __name__ == "__main__":
    logger.info("Starting Parakeet ASR FastAPI server...")
    uvicorn.run(app, host="0.0.0.0", port=3038)