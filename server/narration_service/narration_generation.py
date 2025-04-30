import os
import uuid
import logging
import json
import time
import torch
import gc
import re
from flask import Blueprint, request, jsonify, Response
from .narration_config import HAS_F5TTS, OUTPUT_AUDIO_DIR
from .narration_utils import load_tts_model
from .narration_language import is_text_english

logger = logging.getLogger(__name__)

# Create blueprint for generation routes
generation_bp = Blueprint('narration_generation', __name__)

@generation_bp.route('/generate', methods=['POST', 'HEAD'])
def generate_narration():
    """Generate narration for subtitles using F5-TTS (Streaming Response)"""
    if not HAS_F5TTS:
        logger.error("Generate request received but F5-TTS is not available.")
        return jsonify({'error': 'F5-TTS service is not available'}), 503

    # Handle HEAD request for capability check (e.g., by streaming clients)
    if request.method == 'HEAD':
        logger.debug("Received HEAD request for /generate")
        response = Response()
        # Indicate streaming capability
        response.headers['Content-Type'] = 'text/event-stream'
        response.headers['Cache-Control'] = 'no-cache'
        return response

    # --- Process POST Request ---
    try:
        data = request.json
        if not data:
             return jsonify({'error': 'No JSON data received'}), 400

        reference_audio = data.get('reference_audio')
        reference_text = data.get('reference_text', '')
        subtitles = data.get('subtitles', [])
        settings = data.get('settings', {})
        requested_model_id = settings.get('modelId') # User can override active model

        logger.info(f"Generate request: RefAudio={reference_audio}, #Subtitles={len(subtitles)}, Model={requested_model_id or 'active/default'}")
        logger.debug(f"Reference Text: '{reference_text[:100]}...'")
        logger.debug(f"Settings: {settings}")

        if not reference_audio or not subtitles:
            return jsonify({'error': 'Missing required parameters (reference_audio, subtitles)'}), 400

        # Verify reference audio file exists *before* loading model
        if not os.path.exists(reference_audio):
            logger.error(f"Reference audio file does not exist: {reference_audio}")
            return jsonify({'error': f'Reference audio file not found: {reference_audio}'}), 404

        # --- Load Model ---
        # Load model instance specifically for this request to ensure isolation
        try:
            tts_model_instance, loaded_model_id = load_tts_model(requested_model_id)
            logger.info(f"Using TTS model '{loaded_model_id}' for this generation request.")
        except Exception as model_load_error:
             logger.error(f"Failed to load TTS model for generation: {model_load_error}", exc_info=True)
             # Return error before starting stream
             return jsonify({'error': f'Failed to load TTS model: {model_load_error}'}), 500

        # --- Prepare Settings ---
        remove_silence = settings.get('removeSilence', True)
        speed = float(settings.get('speechRate', 1.0))
        # Batch size isn't directly used by F5TTS.infer for single text, remove unless needed
        # batch_size = settings.get('batchSize', 10) # This seems unused for item-by-item generation
        nfe_step = int(settings.get('nfeStep', 32)) # Default from F5TTS if not specified
        sway_coef = float(settings.get('swayCoef', -1.0)) # Default from F5TTS
        cfg_strength = float(settings.get('cfgStrength', 2.0)) # Default from F5TTS
        seed_val = settings.get('seed') # Can be None, int, or string convertible to int
        seed = int(seed_val) if seed_val is not None and str(seed_val).isdigit() else None

        logger.info(f"Effective Generation Settings: model={loaded_model_id}, remove_silence={remove_silence}, speed={speed}, nfe_step={nfe_step}, sway_coef={sway_coef}, cfg_strength={cfg_strength}, seed={seed}")

        # --- Define Streaming Generator ---
        def generate_narration_stream():
            # Make the model instance accessible in this scope
            nonlocal tts_model_instance, loaded_model_id

            results = []
            total_subtitles = len(subtitles)
            processed_count = 0
            start_time_generation = time.time()

            # Language mismatch check (simple version)
            ref_lang_is_english = is_text_english(reference_text)
            logger.info(f"Reference text language heuristics: {'English' if ref_lang_is_english else 'Non-English'}")
            mismatch_warning_sent = False

            try:
                for i, subtitle in enumerate(subtitles):
                    subtitle_id = subtitle.get('id', f"index_{i}") # Use index if ID missing
                    text = subtitle.get('text', '').strip()
                    processed_count += 1

                    # --- Send Progress Update ---
                    progress_data = {
                        'type': 'progress',
                        'message': f'Processing subtitle {processed_count}/{total_subtitles} (ID: {subtitle_id})',
                        'current': processed_count,
                        'total': total_subtitles
                    }
                    yield f"data: {json.dumps(progress_data)}\n\n"

                    if not text:
                        logger.info(f"Skipping empty subtitle (ID: {subtitle_id})")
                        result = {'subtitle_id': subtitle_id, 'text': '', 'success': True, 'skipped': True}
                        results.append(result)
                        # Send skip result immediately
                        skip_data = {'type': 'result', 'result': result, 'progress': processed_count, 'total': total_subtitles}
                        yield f"data: {json.dumps(skip_data)}\n\n"
                        continue

                    # --- Language Mismatch Check ---
                    if not mismatch_warning_sent:
                         target_lang_is_english = is_text_english(text)
                         if ref_lang_is_english != target_lang_is_english:
                             logger.warning(f"Potential language mismatch! Reference is {'English' if ref_lang_is_english else 'Non-English'}, "
                                            f"first target subtitle (ID: {subtitle_id}) seems {'English' if target_lang_is_english else 'Non-English'}. "
                                            f"Model '{loaded_model_id}' might not support this cross-lingual generation.")
                             mismatch_warning_sent = True # Send warning only once

                    # --- Prepare for Generation ---
                    unique_id = str(uuid.uuid4())
                    output_filename = f"narration_{subtitle_id}_{unique_id}.wav"
                    output_path = os.path.join(OUTPUT_AUDIO_DIR, output_filename)

                    # Clean text: Remove control characters, ensure UTF-8
                    cleaned_text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', text)
                    # Ensure string type and UTF-8 encoding (though F5TTS might handle bytes too)
                    # cleaned_text = cleaned_text.encode('utf-8').decode('utf-8')
                    # Ensure reference text is also clean string
                    cleaned_ref_text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', reference_text or "")
                    # cleaned_ref_text = cleaned_ref_text.encode('utf-8').decode('utf-8')

                    # Log parameters clearly before calling infer
                    log_params = {
                        'ref_file': reference_audio, 'ref_text': cleaned_ref_text, 'gen_text': cleaned_text,
                        'file_wave': output_path, 'remove_silence': remove_silence, 'speed': speed,
                        'nfe_step': nfe_step, 'sway_sampling_coef': sway_coef, 'cfg_strength': cfg_strength, 'seed': seed
                    }
                    logger.info(f"Calling model.infer for subtitle ID {subtitle_id} with text: '{cleaned_text[:100]}...'")
                    logger.debug(f"Infer params: { {k: v for k, v in log_params.items() if k not in ['ref_text', 'gen_text']} }") # Avoid logging long texts at debug


                    # --- Perform Inference ---
                    try:
                        # Use the loaded model instance
                        # Ensure device context if needed (though F5TTS internal handling might suffice)
                        from .narration_config import device
                        context_manager = torch.cuda.device(device) if device.startswith("cuda") and torch.cuda.is_available() else torch.device(device)
                        with context_manager:
                             tts_model_instance.infer(**log_params)

                        logger.info(f"Successfully generated narration for subtitle ID {subtitle_id}")
                        result = {
                            'subtitle_id': subtitle_id,
                            'text': cleaned_text, # Return the cleaned text used for generation
                            'audio_path': output_path,
                            'filename': output_filename,
                            'success': True
                        }
                        results.append(result)

                        # Send success result
                        result_data = {'type': 'result', 'result': result, 'progress': processed_count, 'total': total_subtitles}
                        yield f"data: {json.dumps(result_data)}\n\n"

                    except Exception as infer_error:
                        # Log the specific error and the text that caused it
                        logger.error(f"Error generating narration for subtitle ID {subtitle_id} with text '{cleaned_text[:100]}...': {infer_error}", exc_info=True) # Log stack trace
                        error_message = f"{type(infer_error).__name__}: {str(infer_error)}"
                        result = {
                            'subtitle_id': subtitle_id,
                            'text': cleaned_text,
                            'error': error_message,
                            'success': False
                        }
                        results.append(result)

                        # Send error result
                        error_data = {'type': 'error', 'result': result, 'progress': processed_count, 'total': total_subtitles}
                        # Use ensure_ascii=False for better Unicode in JSON, but handle errors
                        try:
                            json_payload = json.dumps(error_data, ensure_ascii=False)
                        except UnicodeEncodeError:
                            logger.warning("Falling back to ASCII JSON encoding due to Unicode error.")
                            json_payload = json.dumps(error_data, ensure_ascii=True)
                        yield f"data: {json_payload}\n\n"

                    finally:
                         # --- Memory Management ---
                         # Try to free memory after each item, especially important for GPU
                         try:
                             gc.collect() # Force Python garbage collection
                             if device.startswith("cuda") and torch.cuda.is_available():
                                 torch.cuda.empty_cache()
                                 # logger.debug(f"CUDA cache cleared after subtitle ID {subtitle_id}")
                         except Exception as mem_error:
                              logger.warning(f"Error during memory cleanup after subtitle ID {subtitle_id}: {mem_error}")

            except Exception as stream_err:
                 # Catch errors within the generator loop itself
                 logger.error(f"Error during narration stream generation: {stream_err}", exc_info=True)
                 error_data = {'type': 'fatal_error', 'error': f'Stream generation failed: {str(stream_err)}'}
                 yield f"data: {json.dumps(error_data)}\n\n"

            finally:
                # --- Signal Completion ---
                total_time = time.time() - start_time_generation
                logger.info(f"Narration generation stream completed in {total_time:.2f} seconds. Results: {len(results)} processed.")
                complete_data = {'type': 'complete', 'results': results, 'total': len(results), 'duration_seconds': total_time}
                try:
                    json_payload = json.dumps(complete_data, ensure_ascii=False)
                except UnicodeEncodeError:
                    json_payload = json.dumps(complete_data, ensure_ascii=True)
                yield f"data: {json_payload}\n\n"

                # --- Resource Cleanup ---
                # Explicitly delete model instance to release resources if loaded per-request
                if tts_model_instance is not None:
                    logger.info(f"Cleaning up TTS model instance '{loaded_model_id}' after request.")
                    del tts_model_instance
                    try:
                         gc.collect()
                         from .narration_config import device
                         if device.startswith("cuda") and torch.cuda.is_available():
                             torch.cuda.empty_cache()
                             logger.info(f"Final CUDA cache clear. Mem allocated: {torch.cuda.memory_allocated(0)/1024**2:.2f}MB")
                    except Exception as final_clean_err:
                        logger.warning(f"Error during final resource cleanup: {final_clean_err}")


        # --- Return Streaming Response ---
        logger.info("Starting narration generation stream response.")
        return Response(generate_narration_stream(), mimetype='text/event-stream', headers={'Cache-Control': 'no-cache'})

    except Exception as e:
        # Catch errors before starting the stream (e.g., request parsing)
        logger.exception(f"Error setting up narration generation: {e}")
        return jsonify({'error': f'Failed to start generation: {str(e)}'}), 500
