import os
import logging
from flask import Blueprint, send_file, jsonify
from .narration_config import REFERENCE_AUDIO_DIR, OUTPUT_AUDIO_DIR
from .narration_models import models_bp
from .narration_audio import audio_bp
from .narration_generation import generation_bp

logger = logging.getLogger(__name__)

# Create main narration blueprint
narration_bp = Blueprint('narration', __name__)

# Register sub-blueprints
narration_bp.register_blueprint(models_bp, url_prefix='')
narration_bp.register_blueprint(audio_bp, url_prefix='')
narration_bp.register_blueprint(generation_bp, url_prefix='')

# Add routes for serving audio files
@narration_bp.route('/audio/<path:filename>', methods=['GET'])
def get_audio_file(filename):
    """Serve audio files from reference or output directories"""
    # Prevent directory traversal attacks
    if '..' in filename or filename.startswith('/'):
        return jsonify({'error': 'Invalid filename'}), 400

    # Check reference directory first
    reference_path = os.path.join(REFERENCE_AUDIO_DIR, filename)
    # Use safe join and check existence within the intended directory
    safe_ref_path = os.path.abspath(reference_path)
    if safe_ref_path.startswith(os.path.abspath(REFERENCE_AUDIO_DIR)) and os.path.exists(safe_ref_path):
        logger.debug(f"Serving reference audio: {safe_ref_path}")
        return send_file(safe_ref_path, mimetype='audio/wav') # Assume WAV, adjust if needed

    # Check output directory
    output_path = os.path.join(OUTPUT_AUDIO_DIR, filename)
    safe_output_path = os.path.abspath(output_path)
    if safe_output_path.startswith(os.path.abspath(OUTPUT_AUDIO_DIR)) and os.path.exists(safe_output_path):
        logger.debug(f"Serving output audio: {safe_output_path}")
        return send_file(safe_output_path, mimetype='audio/wav') # Assume WAV

    logger.warning(f"Audio file not found in reference or output dirs: {filename}")
    return jsonify({'error': 'File not found'}), 404
