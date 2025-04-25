#!/usr/bin/env python3
"""
Douyin video extractor based on tiktokdien approach
"""

import sys
import re
import json
import urllib.request
import urllib.parse
import time

def extract_video_id(url):
    """Extract video ID from Douyin URL using tiktokdien approach"""
    # Parse using regex pattern from tiktokdien
    parsed = re.search(
        r'https?:\/\/(www\.tiktok\.com\/@[^/]+\/video\/(\d+)|vm\.tiktok\.com\/([^/]+)\/|www\.douyin\.com\/video\/(\d+)|v\.douyin\.com\/([^/]+)\/)',
        url
    )
    
    if not parsed:
        print(f"Invalid URL format: {url}", file=sys.stderr)
        return None
    
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
                    'Referer': 'no-referrer',
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
    
    return None

def fetch_url(url):
    """Fetch URL with redirect handling, exactly like tiktokdien"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 5_1_1 like Mac OS X) AppleWebKit/534.46 (KHTML, like Gecko) Version/5.1 Mobile/9B206 Safari/7534.48.3',
        'Referer': 'no-referrer',
    }
    
    request_options = {
        'headers': headers,
    }
    
    req = urllib.request.Request(url, headers=headers)
    response = urllib.request.urlopen(req)
    
    if response.geturl() != url:
        # This is a redirect
        return {'url': response.geturl()}
    else:
        # This is a JSON response
        return json.loads(response.read().decode('utf-8'))

def get_direct_video_url(video_id):
    """Get direct video URL from video ID using tiktokdien approach"""
    # Use the API endpoint from tiktokdien
    api_url = f"https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids={video_id}"
    
    try:
        print(f"Fetching API URL: {api_url}", file=sys.stdout)
        result = fetch_url(api_url)
        
        if 'status_code' in result and result['status_code'] != 0:
            print(f"API returned error status: {result.get('status_msg', 'Unknown error')}", file=sys.stderr)
            return None
        
        if 'item_list' not in result or len(result['item_list']) == 0:
            print(f"No items found in API response", file=sys.stderr)
            return None
        
        root_info = result['item_list'][0]
        
        if 'video' not in root_info or 'play_addr' not in root_info['video'] or 'url_list' not in root_info['video']['play_addr'] or len(root_info['video']['play_addr']['url_list']) == 0:
            print(f"Video URL not found in API response", file=sys.stderr)
            return None
        
        play_url = root_info['video']['play_addr']['url_list'][0]
        
        # Replace 'playwm' with 'play' to get the URL without watermark
        # This is the key insight from tiktokdien
        direct_url = play_url.replace("playwm", "play")
        
        # Now we need to follow this URL to get the actual video URL
        print(f"Following URL: {direct_url}", file=sys.stdout)
        
        # Fetch the direct URL to get the final URL
        result = fetch_url(direct_url)
        
        if 'url' in result:
            final_url = result['url']
            print(f"Final video URL: {final_url}", file=sys.stdout)
            return final_url
        
        print(f"Using direct URL: {direct_url}", file=sys.stdout)
        return direct_url
        
    except Exception as e:
        print(f"Error getting direct video URL: {str(e)}", file=sys.stderr)
        return None

def download_video(video_url, output_path):
    """Download video from URL to output path"""
    try:
        print(f"Downloading video from: {video_url}", file=sys.stdout)
        print(f"Saving to: {output_path}", file=sys.stdout)
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 5_1_1 like Mac OS X) AppleWebKit/534.46 (KHTML, like Gecko) Version/5.1 Mobile/9B206 Safari/7534.48.3',
            'Referer': 'no-referrer',
        }
        
        req = urllib.request.Request(video_url, headers=headers)
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
        print(f"Error downloading video: {str(e)}", file=sys.stderr)
        return False

def main():
    """Main function to extract and download Douyin video"""
    if len(sys.argv) < 3:
        print("Usage: python douyin_tiktokdien.py <url> <output_path>", file=sys.stderr)
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
    
    # Download the video
    if not download_video(direct_url, output_path):
        print(f"Failed to download video from: {direct_url}", file=sys.stderr)
        sys.exit(1)
    
    print(f"Successfully downloaded video to: {output_path}", file=sys.stdout)
    sys.exit(0)

if __name__ == "__main__":
    main()
