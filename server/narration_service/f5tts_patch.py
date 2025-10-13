"""
F5-TTS patch to support custom model configurations.
This patch allows loading F5-TTS models with custom architecture configs
instead of being limited to the predefined yaml configs.
"""

import os
import sys
from importlib.resources import files
from omegaconf import OmegaConf
from hydra.utils import get_class

# Add F5-TTS to path if not already there
f5tts_path = os.path.join(os.path.dirname(__file__), '..', '..', 'F5-TTS', 'src')
if f5tts_path not in sys.path:
    sys.path.insert(0, f5tts_path)

from f5_tts.infer.utils_infer import load_model, load_vocoder
from f5_tts.model.utils import seed_everything


class PatchedF5TTS:
    """
    Patched version of F5TTS that supports custom config_dict parameter.
    This allows loading models with architecture configs different from the yaml defaults.
    """

    def __init__(
        self,
        model="F5TTS_v1_Base",
        ckpt_file="",
        vocab_file="",
        ode_method="euler",
        use_ema=True,
        vocoder_local_path=None,
        device=None,
        hf_cache_dir=None,
        config_dict=None,
    ):
        # Import here to avoid circular imports
        from f5_tts.api import F5TTS

        if config_dict is not None:
            # Use provided config dict - create a temporary instance with custom config
            self._init_with_custom_config(
                config_dict, ckpt_file, vocab_file, ode_method, use_ema,
                vocoder_local_path, device, hf_cache_dir
            )
        else:
            # Use original F5TTS behavior
            self._original_f5tts = F5TTS(
                model=model,
                ckpt_file=ckpt_file,
                vocab_file=vocab_file,
                ode_method=ode_method,
                use_ema=use_ema,
                vocoder_local_path=vocoder_local_path,
                device=device,
                hf_cache_dir=hf_cache_dir,
            )
            # Copy attributes from original
            self.mel_spec_type = self._original_f5tts.mel_spec_type
            self.target_sample_rate = self._original_f5tts.target_sample_rate
            self.ode_method = self._original_f5tts.ode_method
            self.use_ema = self._original_f5tts.use_ema
            self.ema_model = self._original_f5tts.ema_model
            self.device = self._original_f5tts.device

    def _init_with_custom_config(
        self, config_dict, ckpt_file, vocab_file, ode_method, use_ema,
        vocoder_local_path, device, hf_cache_dir
    ):
        """Initialize with custom config dictionary."""
        # Structure config to match yaml format
        model_cfg = OmegaConf.create({"model": config_dict})
        model_cls = get_class(f"f5_tts.model.{model_cfg.model.backbone}")
        model_arc = model_cfg.model.arch

        self.mel_spec_type = model_cfg.model.mel_spec.mel_spec_type
        self.target_sample_rate = model_cfg.model.mel_spec.target_sample_rate

        self.ode_method = ode_method
        self.use_ema = use_ema

        if device is not None:
            self.device = device
        else:
            import torch
            self.device = (
                "cuda"
                if torch.cuda.is_available()
                else "xpu"
                if torch.xpu.is_available()
                else "mps"
                if torch.backends.mps.is_available()
                else "cpu"
            )

        # Load vocoder
        self.vocoder = load_vocoder(
            self.mel_spec_type, vocoder_local_path is not None, vocoder_local_path, self.device, hf_cache_dir
        )

        # Load model
        self.ema_model = load_model(
            model_cls, model_arc, ckpt_file, self.mel_spec_type, vocab_file, self.ode_method, self.use_ema, self.device
        )

    def transcribe(self, ref_audio, language=None):
        from f5_tts.api import F5TTS
        # Delegate to original method
        return F5TTS.transcribe(self, ref_audio, language)

    def export_wav(self, wav, file_wave, remove_silence=False):
        from f5_tts.api import F5TTS
        # Delegate to original method
        return F5TTS.export_wav(self, wav, file_wave, remove_silence)

    def export_spectrogram(self, spec, file_spec):
        from f5_tts.api import F5TTS
        # Delegate to original method
        return F5TTS.export_spectrogram(self, spec, file_spec)

    def infer(
        self,
        ref_file,
        ref_text,
        gen_text,
        show_info=print,
        progress=None,
        target_rms=0.1,
        cross_fade_duration=0.15,
        sway_sampling_coef=-1,
        cfg_strength=2,
        nfe_step=32,
        speed=1.0,
        fix_duration=None,
        remove_silence=False,
        file_wave=None,
        file_spec=None,
        seed=None,
    ):
        from f5_tts.api import F5TTS
        # Delegate to original method
        return F5TTS.infer(
            self, ref_file, ref_text, gen_text, show_info, progress, target_rms,
            cross_fade_duration, sway_sampling_coef, cfg_strength, nfe_step, speed,
            fix_duration, remove_silence, file_wave, file_spec, seed
        )


# Monkey patch the original F5TTS to support config_dict
def patch_f5tts():
    """Apply monkey patch to F5TTS to support config_dict parameter."""
    import f5_tts.api
    original_init = f5_tts.api.F5TTS.__init__

    def patched_init(
        self,
        model="F5TTS_v1_Base",
        ckpt_file="",
        vocab_file="",
        ode_method="euler",
        use_ema=True,
        vocoder_local_path=None,
        device=None,
        hf_cache_dir=None,
        config_dict=None,
    ):
        if config_dict is not None:
            # Use patched initialization
            patched_instance = PatchedF5TTS(
                model=model,
                ckpt_file=ckpt_file,
                vocab_file=vocab_file,
                ode_method=ode_method,
                use_ema=use_ema,
                vocoder_local_path=vocoder_local_path,
                device=device,
                hf_cache_dir=hf_cache_dir,
                config_dict=config_dict,
            )
            # Copy all attributes to self
            self.__dict__.update(patched_instance.__dict__)
        else:
            # Use original initialization
            original_init(
                self, model, ckpt_file, vocab_file, ode_method, use_ema,
                vocoder_local_path, device, hf_cache_dir
            )

    # Apply the patch
    f5_tts.api.F5TTS.__init__ = patched_init


# Apply patch when module is imported
patch_f5tts()