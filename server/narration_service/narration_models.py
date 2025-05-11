import logging
from flask import Blueprint, request, jsonify
from urllib.parse import unquote
from .narration_config import HAS_F5TTS, INIT_ERROR, device
from .narration_gemini import get_gemini_api_key
from model_manager import (
    get_models, get_active_model, set_active_model, add_model, delete_model,
    download_model_from_hf, download_model_from_url, parse_hf_url,
    get_download_status, update_download_status, remove_download_status,
    update_model_info, is_model_using_symlinks, initialize_registry, cancel_download
)

logger = logging.getLogger(__name__)

# Create blueprint for model management routes
models_bp = Blueprint('narration_models', __name__)

@models_bp.route('/status', methods=['GET'])
def get_status():
    """Check if F5-TTS is available and other system status"""
    runtime_device = device
    runtime_cuda_available = False
    gpu_info = {'cuda_available': False}

    if HAS_F5TTS:
        # Perform runtime CUDA check as it might change (e.g., driver issues)
        try:
            import torch
            runtime_cuda_available = torch.cuda.is_available()
            if device == "cuda:0" and not runtime_cuda_available:
                logger.warning("Runtime Check: CUDA was previously detected but is now unavailable!")
                runtime_device = "cuda_error" # Indicate discrepancy
            elif runtime_cuda_available and device != "cuda:0":
                 logger.warning(f"Runtime Check: CUDA is available but service is configured for {device}. Check initialization.")
                 # Don't change runtime_device here, reflect configured state unless error

            if runtime_cuda_available:
                gpu_info['cuda_available'] = True
                current_dev_index = torch.cuda.current_device()
                gpu_info['device_name'] = torch.cuda.get_device_name(current_dev_index)
                gpu_info['device_count'] = torch.cuda.device_count()
                gpu_info['current_device_index'] = current_dev_index
                try:
                    # Report memory for the current device F5TTS is likely using
                    gpu_info['memory_allocated'] = f"{torch.cuda.memory_allocated(current_dev_index) / 1024**2:.2f} MB"
                    gpu_info['memory_reserved'] = f"{torch.cuda.memory_reserved(current_dev_index) / 1024**2:.2f} MB"
                    total_memory = torch.cuda.get_device_properties(current_dev_index).total_memory
                    gpu_info['total_memory'] = f"{total_memory / 1024**2:.2f} MB"
                except Exception as mem_e:
                    logger.warning(f"Could not get detailed CUDA memory info: {mem_e}")
                    gpu_info['memory_info'] = "Error retrieving memory details"

        except Exception as e:
            logger.error(f"Error during runtime status check for CUDA: {e}")
            gpu_info['error'] = f"Runtime check error: {str(e)}"
            if device == "cuda:0": # If we expected CUDA but check failed
                runtime_device = "cuda_error"

    # Get model info from modelManager
    model_info = get_models()

    from .narration_config import REFERENCE_AUDIO_DIR, OUTPUT_AUDIO_DIR

    return jsonify({
        'available': HAS_F5TTS,
        'device': runtime_device, # Reflects intended device or error state
        'runtime_cuda_available': runtime_cuda_available, # Actual current state
        'initialization_error': INIT_ERROR, # Error during startup
        'gpu_info': gpu_info,
        'models': model_info,
        'reference_audio_dir': REFERENCE_AUDIO_DIR,
        'output_audio_dir': OUTPUT_AUDIO_DIR,
        'gemini_api_key_found': bool(get_gemini_api_key()), # Check if key is discoverable
    })

@models_bp.route('/models', methods=['GET'])
def list_models():
    """Get list of available models"""
    include_cache = request.args.get('include_cache', 'false').lower() == 'true'
    models = get_models(include_cache)
    return jsonify(models)

@models_bp.route('/models/active', methods=['GET'])
def get_current_model():
    """Get the currently active model"""
    active_model_id = get_active_model()
    return jsonify({'active_model': active_model_id})

@models_bp.route('/models/active', methods=['POST'])
def set_current_model():
    """Set the active model"""
    data = request.json
    model_id = data.get('model_id')

    if not model_id:
        return jsonify({'error': 'No model_id provided'}), 400

    success, message = set_active_model(model_id)

    if success:

        return jsonify({'success': True, 'message': f'Active model set to {model_id}'})
    else:
        logger.error(f"Failed to set active model to '{model_id}': {message}")
        return jsonify({'error': message}), 400

@models_bp.route('/models', methods=['POST'])
def add_new_model():
    """Add a new model from Hugging Face or URL"""
    data = request.json
    if not data:
        return jsonify({'error': 'No JSON data received'}), 400

    source_type = data.get('source_type', 'huggingface').lower()
    model_id_req = data.get('model_id') # User-provided preferred ID
    config = data.get('config', {})
    language_codes = data.get('languageCodes', [])



    try:
        if source_type == 'huggingface':
            model_url = data.get('model_url') # Can be hf:// protocol or just repo_id/path
            vocab_url = data.get('vocab_url') # Optional

            if not model_url:
                return jsonify({'error': 'Missing Hugging Face model_url'}), 400

            # Use parse_hf_url for robustness
            repo_id, model_path = parse_hf_url(model_url)
            vocab_repo_id, vocab_path = parse_hf_url(vocab_url) if vocab_url else (None, None)

            if not repo_id or not model_path:
                 # Fallback: maybe model_url is just repo_id? Assume standard filenames? Less robust.
                 logger.warning(f"Could not parse '{model_url}' as standard hf:// or path. Trying as repo_id.")
                 # This part needs clarification based on expected F5-TTS model structure on HF
                 # For now, enforce parsing success.
                 return jsonify({'error': 'Invalid Hugging Face URL format for model_url'}), 400

            # Ensure vocab comes from the same repo if specified without one
            if vocab_path and not vocab_repo_id:
                vocab_repo_id = repo_id



            success, message, downloaded_model_id = download_model_from_hf(
                repo_id=repo_id,
                model_path=model_path,
                vocab_path=vocab_path, # Pass None if not provided
                config=config,
                model_id=model_id_req,
                language_codes=language_codes
            )

        elif source_type == 'url':
            model_url = data.get('model_url')
            vocab_url = data.get('vocab_url') # Optional

            if not model_url:
                return jsonify({'error': 'Missing model_url for direct download'}), 400

            success, message, downloaded_model_id = download_model_from_url(
                model_url=model_url,
                vocab_url=vocab_url, # Pass None if not provided
                config=config,
                preferred_model_id=model_id_req,
                language_codes=language_codes
            )
        else:
            return jsonify({'error': f'Invalid source_type: {source_type}. Must be "huggingface" or "url".'}), 400

        if success:

            return jsonify({
                'success': True,
                'message': message,
                'model_id': downloaded_model_id
            }), 201 # 201 Created status
        else:
            # Handle specific HF private repo error if applicable
            if source_type == 'huggingface' and "401" in message or "private" in message.lower():
                 logger.warning(f"Failed to download from Hugging Face (potentially private repo {repo_id}): {message}")
                 return jsonify({
                     'error': message,
                     'private_repo': True,
                     'repo_id': repo_id
                 }), 401 # Unauthorized
            else:
                logger.error(f"Failed to add model: {message}")
                return jsonify({'error': message}), 400

    except Exception as e:
        logger.exception(f"Unexpected error in add_new_model: {e}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500


@models_bp.route('/models/download-status/<path:model_id>', methods=['GET'])
def get_model_download_status(model_id):
    """Get the download status of a model (handles potential slashes in ID)"""
    # Decode model_id in case it contains URL-encoded characters like slashes
    decoded_model_id = unquote(model_id)
    logger.debug(f"Checking download status for model_id: '{decoded_model_id}' (raw: '{model_id}')")
    status = get_download_status(decoded_model_id)

    if status:
        # Return a consistent structure, including progress if available
        response = {
            'model_id': decoded_model_id,
            'status': status.get('status'),
            'progress': status.get('progress', None), # Percentage
            'downloaded_size': status.get('downloaded_size', None), # Bytes
            'total_size': status.get('total_size', None), # Bytes
            'error': status.get('error', None),
            'timestamp': status.get('timestamp')
        }
        return jsonify(response)
    else:
        # Check if the model exists at all (even if not downloading)
        all_models = get_models(include_cache=True)
        model_exists = any(m['id'] == decoded_model_id for m in all_models.get('models', [])) or \
                       any(m['id'] == decoded_model_id for m in all_models.get('cached_models', []))

        if model_exists:
             # Model exists but no active download status found
             return jsonify({
                 'model_id': decoded_model_id,
                 'status': 'not_downloading' # Indicate it's not actively downloading
             }), 200
        else:
             # Model ID not found anywhere
             return jsonify({
                 'model_id': decoded_model_id,
                 'status': None,
                 'error': 'Model ID not found'
             }), 404


@models_bp.route('/models/<path:model_id>', methods=['DELETE'])
def remove_model(model_id):
    """Delete a model (handles potential slashes in ID)"""
    decoded_model_id = unquote(model_id)
    delete_cache = request.args.get('delete_cache', 'false').lower() == 'true'


    success, message = delete_model(decoded_model_id, delete_cache)

    if success:

        return jsonify({'success': True, 'message': message})
    else:
        logger.error(f"Failed to delete model '{decoded_model_id}': {message}")
        # Distinguish between 'not found' and other errors if possible
        if "not found" in message.lower():
            return jsonify({'error': message}), 404
        else:
            return jsonify({'error': message}), 400

@models_bp.route('/models/<path:model_id>', methods=['PUT'])
def update_model(model_id):
    """Update model information (e.g., name, config)"""
    decoded_model_id = unquote(model_id)
    data = request.json

    if not data:
        return jsonify({'error': 'No update data provided'}), 400


    success, message = update_model_info(decoded_model_id, data)

    if success:

        return jsonify({'success': True, 'message': message})
    else:
        logger.error(f"Failed to update model '{decoded_model_id}': {message}")
        if "not found" in message.lower():
            return jsonify({'error': message}), 404
        else:
            return jsonify({'error': message}), 400

@models_bp.route('/models/<path:model_id>/storage', methods=['GET'])
def get_model_storage_info(model_id):
    """Get information about how a model is stored (symlink or copy)"""
    decoded_model_id = unquote(model_id)
    logger.debug(f"Request for storage info for model: '{decoded_model_id}'")

    try:
        is_symlink, original_model_file, original_vocab_file, size = is_model_using_symlinks(decoded_model_id)
        return jsonify({
            'model_id': decoded_model_id,
            'is_symlink': is_symlink,
            'original_model_file': original_model_file,
            'original_vocab_file': original_vocab_file,
            'size': size
        })
    except FileNotFoundError:
         logger.warning(f"Storage info requested for non-existent model: '{decoded_model_id}'")
         return jsonify({'error': 'Model not found'}), 404
    except Exception as e:
        logger.exception(f"Error getting storage info for model '{decoded_model_id}': {e}")
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500


@models_bp.route('/models/cancel-download/<path:model_id>', methods=['POST'])
def cancel_model_download(model_id):
    """Cancel an ongoing model download"""
    decoded_model_id = unquote(model_id)


    success = cancel_download(decoded_model_id)

    if success:

        return jsonify({
            'success': True,
            'message': f'Download cancellation requested for model {decoded_model_id}'
        })
    else:
        logger.warning(f"Could not cancel download for model '{decoded_model_id}': No active download found.")
        # 404 is appropriate as the specific resource (the download task) wasn't found
        return jsonify({
            'error': f'No active download found for model {decoded_model_id}'
        }), 404
