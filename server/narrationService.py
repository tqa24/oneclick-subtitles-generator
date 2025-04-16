import os
import uuid
import logging
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create blueprint
narration_bp = Blueprint('narration', __name__)

# Constants
NARRATION_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'narration')
REFERENCE_AUDIO_DIR = os.path.join(NARRATION_DIR, 'reference')
OUTPUT_AUDIO_DIR = os.path.join(NARRATION_DIR, 'output')

# Create directories if they don't exist
os.makedirs(NARRATION_DIR, exist_ok=True)
os.makedirs(REFERENCE_AUDIO_DIR, exist_ok=True)
os.makedirs(OUTPUT_AUDIO_DIR, exist_ok=True)

# Initialize variables
HAS_F5TTS = False
INIT_ERROR = None
device = None
tts_model = None

# Initialize F5-TTS
try:
    import torch
    from f5_tts.api import F5TTS

    # Check if CUDA is available
    cuda_available = torch.cuda.is_available()
    logger.info(f"CUDA available: {cuda_available}")

    if cuda_available:
        # Set environment variable to force CUDA
        os.environ['CUDA_VISIBLE_DEVICES'] = '0'
        # Force CUDA device
        device = "cuda:0"  # Explicitly use first CUDA device
        torch.cuda.set_device(0)  # Set to first CUDA device
        logger.info(f"Using CUDA device: {torch.cuda.get_device_name(0)}")
        logger.info(f"CUDA device count: {torch.cuda.device_count()}")
        logger.info(f"Current CUDA device: {torch.cuda.current_device()}")
    else:
        logger.warning("CUDA not available, falling back to CPU")
        device = "cpu"

    logger.info(f"Using device: {device}")

    # Initialize F5-TTS model
    logger.info(f"Initializing F5-TTS model with device={device}")
    # Force model to use CUDA by moving all tensors to CUDA device
    tts_model = F5TTS(device=device)
    
    # Verify the device being used
    if hasattr(tts_model, 'device'):
        logger.info(f"F5-TTS model device: {tts_model.device}")
    elif hasattr(tts_model, 'model') and hasattr(tts_model.model, 'device'):
        logger.info(f"F5-TTS model device: {tts_model.model.device}")
    
    # Force all model components to the correct device if possible
    if cuda_available and hasattr(tts_model, 'to_device'):
        tts_model.to_device(device)
        logger.info("Explicitly moved model to CUDA device")
    elif cuda_available and hasattr(tts_model, 'model') and hasattr(tts_model.model, 'to'):
        tts_model.model.to(device)
        logger.info("Explicitly moved model to CUDA device")

    # Additional check to ensure CUDA is being used if available
    if cuda_available:
        cuda_in_use = False
        if hasattr(tts_model, 'device') and 'cuda' in str(tts_model.device):
            cuda_in_use = True
        elif hasattr(tts_model, 'model') and hasattr(tts_model.model, 'device') and 'cuda' in str(tts_model.model.device):
            cuda_in_use = True
        
        if not cuda_in_use:
            logger.warning("Model may not be using CUDA despite CUDA being available!")
        else:
            logger.info("Confirmed model is using CUDA device")

    logger.info("F5-TTS model initialized successfully")
    HAS_F5TTS = True
    INIT_ERROR = None
except ImportError as e:
    logger.warning(f"F5-TTS not found. Narration features will be disabled. Error: {e}")
    HAS_F5TTS = False
    INIT_ERROR = f"F5-TTS not found: {str(e)}"
except Exception as e:
    logger.error(f"Error initializing F5-TTS: {e}")
    HAS_F5TTS = False
    INIT_ERROR = f"Error initializing F5-TTS: {str(e)}"

@narration_bp.route('/status', methods=['GET'])
def get_status():
    """Check if F5-TTS is available"""
    # Additional runtime check for CUDA status
    runtime_device = device
    if HAS_F5TTS and device == "cuda:0":
        try:
            import torch
            if not torch.cuda.is_available():
                logger.warning("CUDA was previously available but now reports as unavailable!")
                runtime_device = "cuda_error"
        except Exception as e:
            logger.error(f"Error checking CUDA status: {e}")
    
    logger.info(f"Status check: F5-TTS available: {HAS_F5TTS}, device: {runtime_device if HAS_F5TTS else 'None'}")

    # Get GPU info if available
    gpu_info = {}
    if HAS_F5TTS and "cuda" in str(device):
        try:
            import torch
            if torch.cuda.is_available():
                gpu_info = {
                    'cuda_available': True,
                    'device_name': torch.cuda.get_device_name(0),
                    'device_count': torch.cuda.device_count(),
                    'current_device': torch.cuda.current_device(),
                    'memory_allocated': f"{torch.cuda.memory_allocated(0) / 1024**2:.2f} MB",
                    'memory_reserved': f"{torch.cuda.memory_reserved(0) / 1024**2:.2f} MB"
                }
                
                # Add model device info
                if hasattr(tts_model, 'device'):
                    gpu_info['model_device'] = str(tts_model.device)
                elif hasattr(tts_model, 'model') and hasattr(tts_model.model, 'device'):
                    gpu_info['model_device'] = str(tts_model.model.device)
            else:
                gpu_info = {'cuda_available': False, 'error': 'CUDA not available at runtime'}
        except Exception as e:
            gpu_info = {'cuda_available': False, 'error': str(e)}

    return jsonify({
        'available': HAS_F5TTS,
        'device': runtime_device if HAS_F5TTS else None,
        'error': INIT_ERROR,
        'gpu_info': gpu_info,
        'source': 'direct'
    })

@narration_bp.route('/upload-reference', methods=['POST'])
def upload_reference_audio():
    """Upload reference audio file"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    # Generate a unique filename
    filename = secure_filename(file.filename)
    unique_id = str(uuid.uuid4())
    base, ext = os.path.splitext(filename)
    unique_filename = f"{base}_{unique_id}{ext}"

    # Save the file
    filepath = os.path.join(REFERENCE_AUDIO_DIR, unique_filename)
    file.save(filepath)

    # Transcribe the audio if reference text is not provided
    reference_text = request.form.get('reference_text', '')
    if not reference_text and HAS_F5TTS:
        try:
            reference_text = tts_model.transcribe(filepath)
        except Exception as e:
            logger.error(f"Error transcribing audio: {e}")
            reference_text = ""

    return jsonify({
        'success': True,
        'filepath': filepath,
        'filename': unique_filename,
        'reference_text': reference_text
    })

@narration_bp.route('/record-reference', methods=['POST'])
def record_reference_audio():
    """Save recorded audio as reference"""
    logger.info(f"Received record-reference request with files: {list(request.files.keys()) if request.files else 'None'}")
    logger.info(f"Content-Type: {request.headers.get('Content-Type')}")

    if 'audio_data' not in request.files:
        logger.error("No audio_data in request.files")
        return jsonify({'error': 'No audio data'}), 400

    audio_file = request.files['audio_data']
    logger.info(f"Received audio file: {audio_file.filename}, size: {audio_file.content_length}")

    try:
        # Generate a unique filename
        unique_id = str(uuid.uuid4())
        filename = f"recorded_{unique_id}.wav"
        filepath = os.path.join(REFERENCE_AUDIO_DIR, filename)

        # Ensure directory exists
        os.makedirs(REFERENCE_AUDIO_DIR, exist_ok=True)

        # Save the file
        logger.info(f"Saving audio file to {filepath}")
        audio_file.save(filepath)

        # Verify file was saved
        if not os.path.exists(filepath):
            logger.error(f"Failed to save file to {filepath}")
            return jsonify({'error': 'Failed to save audio file'}), 500

        logger.info(f"File saved successfully: {filepath}")

        # Transcribe the audio if reference text is not provided
        reference_text = request.form.get('reference_text', '')
        logger.info(f"Reference text from form: {reference_text}")

        if not reference_text and HAS_F5TTS:
            try:
                logger.info("Attempting to transcribe audio")
                reference_text = tts_model.transcribe(filepath)
                logger.info(f"Transcription result: {reference_text}")
            except Exception as e:
                logger.error(f"Error transcribing audio: {e}")
                reference_text = ""

        response_data = {
            'success': True,
            'filepath': filepath,
            'filename': filename,
            'reference_text': reference_text
        }
        logger.info(f"Returning success response: {response_data}")
        return jsonify(response_data)

    except Exception as e:
        logger.error(f"Error in record_reference_audio: {e}")
        return jsonify({'error': str(e)}), 500

@narration_bp.route('/extract-segment', methods=['POST'])
def extract_audio_segment():
    """Extract audio segment from video"""
    data = request.json
    video_path = data.get('video_path')
    start_time = data.get('start_time')
    end_time = data.get('end_time')

    if not video_path or start_time is None or end_time is None:
        return jsonify({'error': 'Missing required parameters'}), 400

    try:
        # Use ffmpeg to extract audio segment
        unique_id = str(uuid.uuid4())
        output_path = os.path.join(REFERENCE_AUDIO_DIR, f"segment_{unique_id}.wav")

        # Convert start and end times to seconds if they're in format "00:00:00"
        if isinstance(start_time, str) and ":" in start_time:
            parts = start_time.split(":")
            start_time = int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])

        if isinstance(end_time, str) and ":" in end_time:
            parts = end_time.split(":")
            end_time = int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])

        duration = end_time - start_time

        # Use ffmpeg to extract the segment
        import subprocess
        cmd = [
            'ffmpeg', '-y',
            '-i', video_path,
            '-ss', str(start_time),
            '-t', str(duration),
            '-vn',  # No video
            '-acodec', 'pcm_s16le',  # PCM 16-bit little-endian format
            '-ar', '44100',  # 44.1kHz sample rate
            '-ac', '1',  # Mono
            output_path
        ]

        subprocess.run(cmd, check=True)

        # Transcribe the audio segment if F5-TTS is available
        reference_text = ""
        if HAS_F5TTS:
            try:
                reference_text = tts_model.transcribe(output_path)
            except Exception as e:
                logger.error(f"Error transcribing audio segment: {e}")

        return jsonify({
            'success': True,
            'filepath': output_path,
            'filename': os.path.basename(output_path),
            'reference_text': reference_text
        })

    except Exception as e:
        logger.error(f"Error extracting audio segment: {e}")
        return jsonify({'error': str(e)}), 500

@narration_bp.route('/generate', methods=['POST'])
def generate_narration():
    """Generate narration for subtitles"""
    if not HAS_F5TTS:
        return jsonify({'error': 'F5-TTS is not available'}), 503

    data = request.json
    reference_audio = data.get('reference_audio')
    reference_text = data.get('reference_text', '')
    subtitles = data.get('subtitles', [])

    if not reference_audio or not subtitles:
        return jsonify({'error': 'Missing required parameters'}), 400

    try:
        # Log the received references to help with debugging
        logger.info(f"Generating narration with reference_audio: {reference_audio}")
        logger.info(f"Reference text: {reference_text}")
        logger.info(f"Number of subtitles: {len(subtitles)}")
        
        # Verify the reference audio file exists
        if not os.path.exists(reference_audio):
            logger.error(f"Reference audio file does not exist: {reference_audio}")
            return jsonify({'error': f'Reference audio file not found: {reference_audio}'}), 404

        # Create a new model instance to avoid any cached state from previous references
        logger.info("Creating new F5TTS instance to avoid cached references")
        import torch
        from f5_tts.api import F5TTS
        
        # Use the same device as the global model
        current_device = device
        
        # Initialize a new model instance for this specific request
        request_model = F5TTS(device=current_device)
        
        # Log the device being used
        logger.info(f"New F5TTS instance created with device: {current_device}")

        results = []

        for subtitle in subtitles:
            subtitle_id = subtitle.get('id')
            text = subtitle.get('text', '')

            if not text:
                continue

            # Generate a unique filename for this subtitle
            unique_id = str(uuid.uuid4())
            output_filename = f"narration_{subtitle_id}_{unique_id}.wav"
            output_path = os.path.join(OUTPUT_AUDIO_DIR, output_filename)

            # Generate narration
            try:
                # Generate narration and save to file
                logger.info(f"Generating narration for subtitle {subtitle_id} using device: {current_device}")
                logger.info(f"Using reference audio: {reference_audio}")
                logger.info(f"Using reference text: {reference_text}")
                logger.info(f"Generating for text: {text}")

                # Handle character encoding issues
                try:
                    # Try to encode the text to ASCII to check for non-ASCII characters
                    text.encode('ascii')
                except UnicodeEncodeError:
                    # If there are non-ASCII characters, replace them with their ASCII equivalents or remove them
                    import unicodedata
                    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
                    logger.info(f"Cleaned text for subtitle {subtitle_id}: {text}")

                # Force CUDA if available
                import torch
                if torch.cuda.is_available():
                    logger.info(f"Using CUDA for subtitle {subtitle_id} generation")
                    with torch.cuda.device(0):
                        # Use the request-specific model instance
                        request_model.infer(
                            ref_file=reference_audio,
                            ref_text=reference_text,
                            gen_text=text,
                            file_wave=output_path,
                            remove_silence=True
                        )
                else:
                    logger.warning(f"CUDA not available for subtitle {subtitle_id} generation, using CPU")
                    # Use the request-specific model instance
                    request_model.infer(
                        ref_file=reference_audio,
                        ref_text=reference_text,
                        gen_text=text,
                        file_wave=output_path,
                        remove_silence=True
                    )
                logger.info(f"Successfully generated narration for subtitle {subtitle_id}")

                results.append({
                    'subtitle_id': subtitle_id,
                    'text': text,
                    'audio_path': output_path,
                    'filename': output_filename,
                    'success': True
                })

            except Exception as e:
                logger.error(f"Error generating narration for subtitle {subtitle_id}: {e}")
                results.append({
                    'subtitle_id': subtitle_id,
                    'text': text,
                    'error': str(e),
                    'success': False
                })

        # Clean up the request-specific model to free memory
        del request_model
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            logger.info("Cleared CUDA cache after generation")

        return jsonify({
            'success': True,
            'results': results
        })

    except Exception as e:
        logger.error(f"Error generating narration: {e}")
        return jsonify({'error': str(e)}), 500

@narration_bp.route('/audio/<path:filename>', methods=['GET'])
def get_audio_file(filename):
    """Serve audio files"""
    # Check if the file is in the reference directory
    reference_path = os.path.join(REFERENCE_AUDIO_DIR, filename)
    if os.path.exists(reference_path):
        return send_file(reference_path, mimetype='audio/wav')

    # Check if the file is in the output directory
    output_path = os.path.join(OUTPUT_AUDIO_DIR, filename)
    if os.path.exists(output_path):
        return send_file(output_path, mimetype='audio/wav')

    return jsonify({'error': 'File not found'}), 404
