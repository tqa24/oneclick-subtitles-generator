"""
Utility functions for the model manager.
"""
from .constants import logger

def parse_hf_url(url):
    """Parse Hugging Face URL."""

    if not url: return None, None

    # Try hf:// format
    if url.startswith('hf://'):
        parts = url[5:].split('/', 1)
        if len(parts) == 2:
            repo_id, file_path = parts
            # Basic validation: repo_id should have one '/'
            if repo_id.count('/') == 1 and file_path:

                return repo_id, file_path
            else:
                 logger.warning(f"Invalid hf:// format structure: {url}")
                 return None, None

    # Try https://huggingface.co format
    elif 'huggingface.co' in url:
        try:
            path_part = url.split('huggingface.co/', 1)[1]
            # Format: repo_id/resolve/branch/file_path
            if '/resolve/' in path_part:
                repo_id, branch_file = path_part.split('/resolve/', 1)
                if '/' in branch_file:
                    _, file_path = branch_file.split('/', 1) # Skip branch
                    if repo_id.count('/') == 1 and file_path:

                        return repo_id, file_path
            # Format: repo_id/blob/branch/file_path
            elif '/blob/' in path_part:
                repo_id, branch_file = path_part.split('/blob/', 1)
                if '/' in branch_file:
                    _, file_path = branch_file.split('/', 1) # Skip branch
                    if repo_id.count('/') == 1 and file_path:

                        return repo_id, file_path
            # Add other potential formats if needed (e.g., direct file links without resolve/blob?)
            logger.warning(f"Could not extract repo_id/file_path from huggingface.co URL structure: {url}")
            return None, None
        except (IndexError, ValueError) as e:
            logger.error(f"Error parsing huggingface.co URL {url}: {e}")
            return None, None

    logger.error(f"URL format not recognized as Hugging Face: {url}")
    return None, None
