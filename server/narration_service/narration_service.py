"""
Narration Service Module
-----------------------
This module provides the main entry point for the narration service.
It imports and registers the narration blueprint with Flask.

Usage:
    from narration_service import narration_bp
    app.register_blueprint(narration_bp, url_prefix='/narration')
"""

from .narration_blueprint import narration_bp

# This file serves as the main entry point for the narration service
# The narration_bp blueprint can be imported and registered with a Flask app
