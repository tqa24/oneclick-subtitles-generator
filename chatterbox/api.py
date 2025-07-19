"""
FastAPI wrapper for Chatterbox TTS with simplified controls.
Only exposes the 2 primary controls: exaggeration and cfg_weight.
"""

import io
import tempfile
import torch
import torchaudio as ta
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import uvicorn

from chatterbox.tts import ChatterboxTTS
from chatterbox.vc import ChatterboxVC


# Initialize FastAPI app
app = FastAPI(
    title="Chatterbox TTS API",
    description="Simple API for Chatterbox Text-to-Speech with primary controls only",
    version="1.0.0"
)

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3008", "http://127.0.0.1:3008"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model instances (loaded once on startup)
tts_model = None
vc_model = None

# Automatically detect the best available device
if torch.cuda.is_available():
    DEVICE = "cuda"
elif torch.backends.mps.is_available():
    DEVICE = "mps"
else:
    DEVICE = "cpu"


# Pydantic models for request/response
class TTSRequest(BaseModel):
    text: str = Field(..., description="Text to synthesize", max_length=300)
    exaggeration: float = Field(0.5, description="Emotional intensity (0.25-2.0, neutral=0.5)", ge=0.25, le=2.0)
    cfg_weight: float = Field(0.5, description="CFG/Pace control (0.0-1.0)", ge=0.0, le=1.0)


class TTSResponse(BaseModel):
    message: str
    sample_rate: int


class HealthResponse(BaseModel):
    status: str
    device: str
    models_loaded: dict


@app.on_event("startup")
async def startup_event():
    """Load models on startup"""
    global tts_model, vc_model

    print(f"Loading models on device: {DEVICE}")

    try:
        tts_model = ChatterboxTTS.from_pretrained(DEVICE)
        print("[SUCCESS] TTS model loaded successfully")

        # Check if default conditionals are available
        if tts_model.conds is None:
            print("[WARNING] TTS model loaded but no default voice conditionals (conds.pt) found")
            print("[WARNING] Attempting to download default voice conditionals...")

            # Try to download the conditionals file
            try:
                from huggingface_hub import hf_hub_download
                import os

                conds_path = hf_hub_download(
                    repo_id='ResembleAI/chatterbox',
                    filename='conds.pt',
                    force_download=True  # Force download to ensure we get the file
                )

                if os.path.exists(conds_path) and os.path.getsize(conds_path) > 0:
                    print(f"[SUCCESS] Downloaded default voice conditionals to: {conds_path}")
                    # Reload the model to pick up the conditionals
                    tts_model = ChatterboxTTS.from_pretrained(DEVICE)
                    if tts_model.conds is not None:
                        print("[SUCCESS] Default voice conditionals loaded after download")
                    else:
                        print("[WARNING] Default voice conditionals still not loaded after download")
                else:
                    print("[ERROR] Downloaded conditionals file is invalid")

            except Exception as download_error:
                print(f"[ERROR] Failed to download default voice conditionals: {download_error}")
                print("[WARNING] Voice reference files will be required for TTS generation")
        else:
            print("[SUCCESS] Default voice conditionals loaded")

    except Exception as e:
        print(f"[ERROR] Failed to load TTS model: {e}")
        tts_model = None

    try:
        vc_model = ChatterboxVC.from_pretrained(DEVICE)
        print("[SUCCESS] VC model loaded successfully")
    except Exception as e:
        print(f"[ERROR] Failed to load VC model: {e}")
        vc_model = None


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    # Check if TTS model is fully functional (loaded with conditionals)
    tts_functional = tts_model is not None and tts_model.conds is not None

    return HealthResponse(
        status="healthy" if tts_functional else "degraded",
        device=DEVICE,
        models_loaded={
            "tts": tts_functional,
            "vc": vc_model is not None
        }
    )


@app.post("/tts/generate")
async def generate_speech(request: TTSRequest):
    """
    Generate speech from text using only the 2 primary controls.
    Returns audio as WAV file.
    """
    if tts_model is None:
        raise HTTPException(status_code=503, detail="TTS model not loaded")

    # Check if model has default conditionals loaded
    if tts_model.conds is None:
        raise HTTPException(
            status_code=503,
            detail="TTS model loaded but no default voice conditionals available. This typically happens on fresh installations. Please restart the service or provide a voice reference file."
        )

    try:
        # Generate speech with optimal defaults for all other parameters
        wav = tts_model.generate(
            text=request.text,
            exaggeration=request.exaggeration,
            cfg_weight=request.cfg_weight,
            # Optimal defaults (not exposed to user)
            temperature=0.8,
        )

        # Convert to bytes
        buffer = io.BytesIO()
        ta.save(buffer, wav, tts_model.sr, format="wav")
        buffer.seek(0)

        return Response(
            content=buffer.getvalue(),
            media_type="audio/wav",
            headers={
                "X-Sample-Rate": str(tts_model.sr)
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@app.post("/tts/generate-with-voice-path")
async def generate_speech_with_voice_path(request: dict):
    """
    Generate speech with voice reference using a file path.
    This is more efficient for local files than uploading.
    """
    if tts_model is None:
        raise HTTPException(status_code=503, detail="TTS model not loaded")

    # Extract parameters
    text = request.get('text', '')
    exaggeration = request.get('exaggeration', 0.5)
    cfg_weight = request.get('cfg_weight', 0.5)
    voice_file_path = request.get('voice_file_path', '')

    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    if not voice_file_path:
        raise HTTPException(status_code=400, detail="Voice file path is required")

    # Validate file exists
    import os
    if not os.path.exists(voice_file_path):
        raise HTTPException(status_code=400, detail=f"Voice file not found: {voice_file_path}")

    try:
        # Generate speech with voice reference
        wav = tts_model.generate(
            text=text,
            audio_prompt_path=voice_file_path,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
            # Optimal defaults (not exposed to user)
            temperature=0.8,
        )

        # Convert to bytes
        buffer = io.BytesIO()
        ta.save(buffer, wav, tts_model.sr, format="wav")
        buffer.seek(0)

        return Response(
            content=buffer.getvalue(),
            media_type="audio/wav",
            headers={
                "X-Sample-Rate": str(tts_model.sr)
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@app.post("/tts/generate-with-voice")
async def generate_speech_with_voice(
    text: str = Form(..., description="Text to synthesize", max_length=300),
    exaggeration: float = Form(0.5, description="Emotional intensity (0.25-2.0)", ge=0.25, le=2.0),
    cfg_weight: float = Form(0.5, description="CFG/Pace control (0.0-1.0)", ge=0.0, le=1.0),
    voice_file: UploadFile = File(..., description="Reference voice audio file")
):
    """
    Generate speech with custom voice reference.
    Only exposes the 2 primary controls.
    """
    if tts_model is None:
        raise HTTPException(status_code=503, detail="TTS model not loaded")
    
    # Validate audio file
    if not voice_file.content_type.startswith('audio/'):
        raise HTTPException(status_code=400, detail="Voice file must be an audio file")
    
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            content = await voice_file.read()
            temp_file.write(content)
            temp_voice_path = temp_file.name
        
        # Generate speech with voice reference
        wav = tts_model.generate(
            text=text,
            audio_prompt_path=temp_voice_path,
            exaggeration=exaggeration,
            cfg_weight=cfg_weight,
            # Optimal defaults (not exposed to user)
            temperature=0.8,
        )
        
        # Convert to bytes
        buffer = io.BytesIO()
        ta.save(buffer, wav, tts_model.sr, format="wav")
        buffer.seek(0)
        
        return Response(
            content=buffer.getvalue(),
            media_type="audio/wav",
            headers={
                "X-Sample-Rate": str(tts_model.sr)
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")
    finally:
        # Clean up temp file
        try:
            import os
            os.unlink(temp_voice_path)
        except:
            pass


@app.post("/vc/convert")
async def convert_voice(
    input_audio: UploadFile = File(..., description="Input audio to convert"),
    target_voice: UploadFile = File(..., description="Target voice reference")
):
    """
    Convert voice using Chatterbox VC.
    No additional controls exposed - uses optimal defaults.
    """
    if vc_model is None:
        raise HTTPException(status_code=503, detail="VC model not loaded")
    
    # Validate audio files
    if not input_audio.content_type.startswith('audio/'):
        raise HTTPException(status_code=400, detail="Input audio must be an audio file")
    if not target_voice.content_type.startswith('audio/'):
        raise HTTPException(status_code=400, detail="Target voice must be an audio file")
    
    try:
        # Save uploaded files temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_input:
            content = await input_audio.read()
            temp_input.write(content)
            temp_input_path = temp_input.name
            
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_target:
            content = await target_voice.read()
            temp_target.write(content)
            temp_target_path = temp_target.name
        
        # Convert voice
        wav = vc_model.generate(
            audio=temp_input_path,
            target_voice_path=temp_target_path
        )
        
        # Convert to bytes
        buffer = io.BytesIO()
        ta.save(buffer, wav, vc_model.sr, format="wav")
        buffer.seek(0)
        
        return Response(
            content=buffer.getvalue(),
            media_type="audio/wav",
            headers={
                "Content-Disposition": "attachment; filename=converted_voice.wav",
                "X-Sample-Rate": str(vc_model.sr)
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice conversion failed: {str(e)}")
    finally:
        # Clean up temp files
        try:
            import os
            os.unlink(temp_input_path)
            os.unlink(temp_target_path)
        except:
            pass


if __name__ == "__main__":
    uvicorn.run(
        "api:app",
        host="0.0.0.0",
        port=3011,
        reload=True,
        log_level="info"
    )
