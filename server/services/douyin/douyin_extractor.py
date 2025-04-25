#!/usr/bin/env python
# Custom Douyin extractor for yt-dlp

import re
import json
import sys
import os
import urllib.request
import urllib.parse
import time
import random
import subprocess
import shutil

def extract_video_id(url):
    """Extract video ID from Douyin URL"""
    # Parse using regex pattern from tiktokdien
    parsed = re.search(
        r'https?:\/\/(www\.tiktok\.com\/@[^/]+\/video\/(\d+)|vm\.tiktok\.com\/([^/]+)\/|www\.douyin\.com\/video\/(\d+)|v\.douyin\.com\/([^/]+)\/)',
        url
    )

    if parsed:
        # Extract the video ID from the matched groups
        # Group 4 is for www.douyin.com/video/{id}
        # Group 5 is for v.douyin.com/{shortcode}/
        douyin_id = parsed.group(4) if parsed.group(4) else None
        douyin_shortcode = parsed.group(5) if parsed.group(5) else None

        if douyin_id:
            print(f"Extracted Douyin video ID: {douyin_id}", file=sys.stdout)
            return douyin_id

        if douyin_shortcode:
            print(f"Extracted Douyin shortcode: {douyin_shortcode}", file=sys.stdout)
            # For short URLs, follow the redirect to get the actual video ID
            try:
                req = urllib.request.Request(
                    url,
                    headers={
                        'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 5_1_1 like Mac OS X) AppleWebKit/534.46 (KHTML, like Gecko) Version/5.1 Mobile/9B206 Safari/7534.48.3',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    }
                )
                response = urllib.request.urlopen(req)
                redirected_url = response.geturl()
                print(f"Redirected to: {redirected_url}", file=sys.stdout)

                # Try to extract video ID from the redirected URL
                vid_match = re.search(r'/video/(\d+)', redirected_url)
                if vid_match:
                    print(f"Extracted video ID from redirect: {vid_match.group(1)}", file=sys.stdout)
                    return vid_match.group(1)

                # Try to extract from URL parameters
                parsed_url = urllib.parse.urlparse(redirected_url)
                query_params = urllib.parse.parse_qs(parsed_url.query)
                if 'vid' in query_params:
                    print(f"Extracted video ID from query params: {query_params['vid'][0]}", file=sys.stdout)
                    return query_params['vid'][0]

                # If we can't extract from the redirected URL, return the shortcode
                return douyin_shortcode
            except Exception as e:
                print(f"Error following redirect: {str(e)}", file=sys.stderr)
                # Return the shortcode if we can't follow the redirect
                return douyin_shortcode

    # Fallback to the original extraction methods

    # For short URLs, follow the redirect first
    if 'v.douyin.com' in url:
        try:
            req = urllib.request.Request(
                url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 5_1_1 like Mac OS X) AppleWebKit/534.46 (KHTML, like Gecko) Version/5.1 Mobile/9B206 Safari/7534.48.3',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                }
            )
            response = urllib.request.urlopen(req)
            url = response.geturl()
            print(f"Redirected to: {url}", file=sys.stdout)
        except Exception as e:
            print(f"Error following redirect: {str(e)}", file=sys.stderr)
            # Continue with the original URL

    # Try to extract from URL parameters
    parsed_url = urllib.parse.urlparse(url)
    query_params = urllib.parse.parse_qs(parsed_url.query)

    # Check if vid parameter exists
    if 'vid' in query_params:
        print(f"Extracted video ID from query params: {query_params['vid'][0]}", file=sys.stdout)
        return query_params['vid'][0]

    # Try to extract from path
    match = re.search(r'/video/(\d+)', url)
    if match:
        print(f"Extracted video ID from path: {match.group(1)}", file=sys.stdout)
        return match.group(1)

    # For short URLs, use the path component
    if 'v.douyin.com' in url:
        path = parsed_url.path.strip('/')
        if path:
            print(f"Using path component as ID: {path}", file=sys.stdout)
            return path

    print(f"Could not extract video ID from URL: {url}", file=sys.stderr)
    return None

def get_direct_video_url(video_id):
    """Get direct video URL from video ID using the method from tiktokdien"""
    # Use the API endpoint from tiktokdien
    api_url = f"https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids={video_id}"

    # Set up headers to mimic iPad browser (from tiktokdien)
    headers = {
        'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 5_1_1 like Mac OS X) AppleWebKit/534.46 (KHTML, like Gecko) Version/5.1 Mobile/9B206 Safari/7534.48.3',
        'Referer': 'https://www.douyin.com/',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www.douyin.com'
    }

    try:
        print(f"Trying API URL: {api_url}", file=sys.stdout)

        # Make request to API
        req = urllib.request.Request(api_url, headers=headers)
        response = urllib.request.urlopen(req, timeout=10)
        data = json.loads(response.read().decode('utf-8'))

        # Check if the API returned a success status
        if 'status_code' in data and data['status_code'] != 0:
            print(f"API returned error status: {data.get('status_msg', 'Unknown error')}", file=sys.stderr)
            return None

        # Extract video URL from response using the tiktokdien method
        if 'item_list' in data and len(data['item_list']) > 0:
            item = data['item_list'][0]

            # Try to get play address
            if 'video' in item and 'play_addr' in item['video']:
                play_addr = item['video']['play_addr']
                if 'url_list' in play_addr and len(play_addr['url_list']) > 0:
                    # Get the first URL in the list
                    play_url = play_addr['url_list'][0]

                    # Replace 'playwm' with 'play' to get the URL without watermark
                    # This is the key insight from tiktokdien
                    direct_url = play_url.replace("playwm", "play")

                    # Now we need to follow this URL to get the actual video URL
                    print(f"Following URL: {direct_url}", file=sys.stdout)

                    # Make a request to the direct URL to get the final URL
                    req = urllib.request.Request(direct_url, headers=headers)
                    response = urllib.request.urlopen(req)

                    # If the response is a redirect, get the final URL
                    if response.geturl() != direct_url:
                        final_url = response.geturl()
                        print(f"Redirected to final URL: {final_url}", file=sys.stdout)
                        return final_url

                    print(f"Using direct URL: {direct_url}", file=sys.stdout)
                    return direct_url

        print("Failed to extract video URL from API response", file=sys.stderr)

    except Exception as e:
        print(f"Error with API {api_url}: {str(e)}", file=sys.stderr)

    # If the primary method fails, try the fallback methods

    # Try multiple API endpoints
    api_urls = [
        f"https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id={video_id}",
        f"https://api.douyin.wtf/api?url=https://www.douyin.com/video/{video_id}",
        f"https://api.douyin.wtf/api?url=https://v.douyin.com/{video_id}"
    ]

    # Different user agents to try
    user_agents = [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15'
    ]

    for api_url in api_urls:
        for user_agent in user_agents:
            try:
                print(f"Trying fallback API URL: {api_url} with User-Agent: {user_agent}", file=sys.stdout)

                # Set up headers to mimic browser
                headers = {
                    'User-Agent': user_agent,
                    'Referer': 'https://www.douyin.com/',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Accept': 'application/json, text/plain, */*',
                    'Origin': 'https://www.douyin.com'
                }

                # Add a random delay to avoid rate limiting
                time.sleep(random.uniform(0.5, 1.5))

                # Make request to API
                req = urllib.request.Request(api_url, headers=headers)
                response = urllib.request.urlopen(req, timeout=10)
                data = json.loads(response.read().decode('utf-8'))

                # Extract video URL from response
                if 'item_list' in data and len(data['item_list']) > 0:
                    item = data['item_list'][0]

                    # Try to get play address
                    if 'video' in item and 'play_addr' in item['video']:
                        play_addr = item['video']['play_addr']
                        if 'url_list' in play_addr and len(play_addr['url_list']) > 0:
                            # Return the first URL in the list
                            direct_url = play_addr['url_list'][0].replace("playwm", "play")
                            print(f"Found direct URL: {direct_url}", file=sys.stdout)
                            return direct_url

                # Try alternative response format
                if 'aweme_detail' in data:
                    detail = data['aweme_detail']
                    if 'video' in detail and 'play_addr' in detail['video']:
                        play_addr = detail['video']['play_addr']
                        if 'url_list' in play_addr and len(play_addr['url_list']) > 0:
                            direct_url = play_addr['url_list'][0].replace("playwm", "play")
                            print(f"Found direct URL: {direct_url}", file=sys.stdout)
                            return direct_url

                # Try the third API format
                if 'status' in data and data['status'] == 'success' and 'video_data' in data:
                    video_data = data['video_data']
                    if 'nwm_video_url_HQ' in video_data:
                        direct_url = video_data['nwm_video_url_HQ']
                        print(f"Found direct URL: {direct_url}", file=sys.stdout)
                        return direct_url
                    elif 'nwm_video_url' in video_data:
                        direct_url = video_data['nwm_video_url']
                        print(f"Found direct URL: {direct_url}", file=sys.stdout)
                        return direct_url

            except Exception as e:
                print(f"Error with API {api_url}: {str(e)}", file=sys.stderr)
                continue

    print("All API methods failed, trying direct page scraping", file=sys.stdout)

    # Try direct page scraping as a last resort
    try:
        url = f"https://www.douyin.com/video/{video_id}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 5_1_1 like Mac OS X) AppleWebKit/534.46 (KHTML, like Gecko) Version/5.1 Mobile/9B206 Safari/7534.48.3',
            'Referer': 'https://www.douyin.com/',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        }

        req = urllib.request.Request(url, headers=headers)
        response = urllib.request.urlopen(req)
        html = response.read().decode('utf-8')

        # Look for video URL in the HTML
        video_url_match = re.search(r'"playAddr":\s*\[\s*"([^"]+)"', html)
        if video_url_match:
            direct_url = video_url_match.group(1).replace('\\u002F', '/').replace("playwm", "play")
            print(f"Found direct URL from HTML: {direct_url}", file=sys.stdout)
            return direct_url
    except Exception as e:
        print(f"Error with direct page scraping: {str(e)}", file=sys.stderr)

    return None

def download_with_urllib(url, output_path):
    """Download a file using urllib"""
    try:
        print(f"Downloading with urllib from: {url}", file=sys.stdout)
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://www.douyin.com/',
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive'
        }

        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response, open(output_path, 'wb') as out_file:
            # Get content length for progress reporting
            content_length = response.getheader('Content-Length')
            total_size = int(content_length) if content_length else None

            # Download with progress reporting
            downloaded = 0
            block_size = 8192

            while True:
                buffer = response.read(block_size)
                if not buffer:
                    break

                downloaded += len(buffer)
                out_file.write(buffer)

                if total_size:
                    progress = int(downloaded / total_size * 100)
                    print(f"Download progress: {progress}%", file=sys.stdout)

        print(f"Download completed: {output_path}", file=sys.stdout)
        return True
    except Exception as e:
        print(f"Error downloading with urllib: {str(e)}", file=sys.stderr)
        return False

def download_with_requests(url, output_path):
    """Download a file using requests if available"""
    try:
        # Try to import requests
        import requests
        print(f"Downloading with requests from: {url}", file=sys.stdout)

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://www.douyin.com/',
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive'
        }

        with requests.get(url, headers=headers, stream=True) as response:
            response.raise_for_status()
            total_size = int(response.headers.get('content-length', 0))

            with open(output_path, 'wb') as out_file:
                downloaded = 0
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        out_file.write(chunk)
                        downloaded += len(chunk)

                        if total_size:
                            progress = int(downloaded / total_size * 100)
                            print(f"Download progress: {progress}%", file=sys.stdout)

        print(f"Download completed: {output_path}", file=sys.stdout)
        return True
    except ImportError:
        print("Requests library not available, falling back to urllib", file=sys.stderr)
        return False
    except Exception as e:
        print(f"Error downloading with requests: {str(e)}", file=sys.stderr)
        return False

def download_with_yt_dlp(url, output_path):
    """Download a file using yt-dlp"""
    try:
        print(f"Downloading with yt-dlp from: {url}", file=sys.stdout)

        # Find yt-dlp executable
        yt_dlp_path = "yt-dlp"  # Assume yt-dlp is in PATH

        # Check if we're in a virtual environment
        if 'VIRTUAL_ENV' in os.environ:
            venv_bin = 'Scripts' if sys.platform == 'win32' else 'bin'
            venv_yt_dlp_path = os.path.join(os.environ['VIRTUAL_ENV'], venv_bin, 'yt-dlp' + ('.exe' if sys.platform == 'win32' else ''))
            if os.path.exists(venv_yt_dlp_path):
                yt_dlp_path = venv_yt_dlp_path

        # Check for yt-dlp in the current directory's .venv
        current_dir = os.path.dirname(os.path.abspath(__file__))
        root_dir = os.path.abspath(os.path.join(current_dir, '..', '..', '..'))
        venv_dir = os.path.join(root_dir, '.venv')
        if os.path.exists(venv_dir):
            venv_bin = 'Scripts' if sys.platform == 'win32' else 'bin'
            venv_yt_dlp_path = os.path.join(venv_dir, venv_bin, 'yt-dlp' + ('.exe' if sys.platform == 'win32' else ''))
            if os.path.exists(venv_yt_dlp_path):
                yt_dlp_path = venv_yt_dlp_path

        print(f"Using yt-dlp at: {yt_dlp_path}", file=sys.stdout)

        # Use subprocess instead of os.system for better error handling
        result = subprocess.run(
            [yt_dlp_path, '-o', output_path, url],
            capture_output=True,
            text=True,
            check=False
        )

        if result.returncode == 0:
            print(f"yt-dlp download successful: {output_path}", file=sys.stdout)
            return True
        else:
            print(f"yt-dlp download failed with code {result.returncode}", file=sys.stderr)
            print(f"yt-dlp stdout: {result.stdout}", file=sys.stdout)
            print(f"yt-dlp stderr: {result.stderr}", file=sys.stderr)
            return False
    except Exception as e:
        print(f"Error downloading with yt-dlp: {str(e)}", file=sys.stderr)
        return False

def download_with_ffmpeg(url, output_path):
    """Download a file using ffmpeg"""
    try:
        print(f"Downloading with ffmpeg from: {url}", file=sys.stdout)

        # Find ffmpeg executable
        ffmpeg_path = "ffmpeg"  # Assume ffmpeg is in PATH

        # Use subprocess for better error handling
        result = subprocess.run(
            [ffmpeg_path, '-y', '-i', url, '-c', 'copy', output_path],
            capture_output=True,
            text=True,
            check=False
        )

        if result.returncode == 0:
            print(f"ffmpeg download successful: {output_path}", file=sys.stdout)
            return True
        else:
            print(f"ffmpeg download failed with code {result.returncode}", file=sys.stderr)
            print(f"ffmpeg stdout: {result.stdout}", file=sys.stdout)
            print(f"ffmpeg stderr: {result.stderr}", file=sys.stderr)
            return False
    except Exception as e:
        print(f"Error downloading with ffmpeg: {str(e)}", file=sys.stderr)
        return False

def main():
    """Main function to extract and download Douyin video"""
    if len(sys.argv) < 3:
        print("Usage: python douyin_extractor.py <url> <output_path>", file=sys.stderr)
        sys.exit(1)

    url = sys.argv[1]
    output_path = sys.argv[2]

    print(f"Extracting video from URL: {url}", file=sys.stdout)
    print(f"Output path: {output_path}", file=sys.stdout)

    # Extract video ID
    video_id = extract_video_id(url)
    if not video_id:
        print(f"Could not extract video ID from URL: {url}", file=sys.stderr)
        sys.exit(1)

    print(f"Extracted video ID: {video_id}", file=sys.stdout)

    # Get direct video URL
    direct_url = get_direct_video_url(video_id)
    if not direct_url:
        print(f"Could not get direct video URL for ID: {video_id}", file=sys.stderr)
        sys.exit(1)

    print(f"Direct video URL: {direct_url}", file=sys.stdout)

    # Try multiple download methods in order of preference
    download_methods = [
        download_with_requests,
        download_with_urllib,
        download_with_yt_dlp,
        download_with_ffmpeg
    ]

    for download_method in download_methods:
        method_name = download_method.__name__
        print(f"Trying download method: {method_name}", file=sys.stdout)

        if download_method(direct_url, output_path):
            print(f"Download successful with {method_name}", file=sys.stdout)

            # Verify the file exists and has content
            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                print(f"Verified file exists and has content: {output_path}", file=sys.stdout)
                sys.exit(0)
            else:
                print(f"File verification failed for {output_path}", file=sys.stderr)
                # Continue to next method
        else:
            print(f"Download failed with {method_name}, trying next method", file=sys.stderr)

    # If we get here, all methods failed
    print("All download methods failed", file=sys.stderr)
    sys.exit(1)

if __name__ == "__main__":
    main()
