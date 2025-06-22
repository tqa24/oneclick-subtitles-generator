"""
Model Manager Package for F5-TTS models.
This package provides functionality for managing F5-TTS models,
including downloading, registering, and selecting models.
"""

# Import all public functions to expose them at the package level
from .registry import (
    initialize_registry,
    get_registry,
    save_registry,
    get_models,
    scan_models_directory
)

from .models import (
    is_model_using_symlinks,
    update_model_info,
    get_active_model,
    set_active_model,
    add_model,
    delete_model
)

from .download_status import (
    get_download_status,
    update_download_status,
    remove_download_status
)

from .download import (
    cancel_download,
    download_model_from_hf,
    download_model_from_url
)

from .utils import (
    parse_hf_url
)

# Initialize registry on module import
initialize_registry()
