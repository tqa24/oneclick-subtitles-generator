#!/usr/bin/env python3
"""
Android Source Code Fetcher

This script fetches Kotlin source files from the Android source repository
and automatically decodes them from base64 format.

Usage:
    python fetch-android-source.py <file_path> [output_dir]

Examples:
    python fetch-android-source.py compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/WavyProgressIndicator.kt
    python fetch-android-source.py compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/internal/ProgressIndicatorImpl.kt kotlin-code/
"""

import sys
import os
import base64
import requests
from urllib.parse import quote
import argparse
from pathlib import Path

class AndroidSourceFetcher:
    def __init__(self):
        self.base_url = "https://android.googlesource.com/platform/frameworks/support/+/androidx-main"
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

    def fetch_file(self, file_path, output_dir="kotlin-code"):
        """
        Fetch a single file from the Android source repository
        
        Args:
            file_path (str): Path to the file in the repository
            output_dir (str): Local directory to save the file
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Construct the raw file URL
            encoded_path = quote(file_path, safe='/')
            raw_url = f"{self.base_url}/{encoded_path}?format=TEXT"
            
            print(f"Fetching: {file_path}")
            print(f"URL: {raw_url}")
            
            # Make the request
            response = self.session.get(raw_url, timeout=30)
            response.raise_for_status()
            
            # Decode base64 content
            try:
                decoded_content = base64.b64decode(response.text).decode('utf-8')
            except Exception as e:
                print(f"Error decoding base64 content: {e}")
                return False
            
            # Create output directory if it doesn't exist
            output_path = Path(output_dir)
            output_path.mkdir(parents=True, exist_ok=True)
            
            # Extract filename from path
            filename = Path(file_path).name
            output_file = output_path / filename
            
            # Write the decoded content to file
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(decoded_content)
            
            print(f"✓ Successfully saved: {output_file}")
            return True
            
        except requests.exceptions.RequestException as e:
            print(f"✗ Network error: {e}")
            return False
        except Exception as e:
            print(f"✗ Error: {e}")
            return False

    def fetch_multiple_files(self, file_paths, output_dir="kotlin-code"):
        """
        Fetch multiple files from the Android source repository
        
        Args:
            file_paths (list): List of file paths to fetch
            output_dir (str): Local directory to save the files
        
        Returns:
            dict: Results with success/failure status for each file
        """
        results = {}
        
        for file_path in file_paths:
            results[file_path] = self.fetch_file(file_path, output_dir)
        
        return results

    def discover_dependencies(self, kotlin_content):
        """
        Analyze Kotlin content to discover import dependencies
        
        Args:
            kotlin_content (str): The Kotlin source code content
        
        Returns:
            list: List of potential dependency file paths
        """
        dependencies = []
        lines = kotlin_content.split('\n')
        
        for line in lines:
            line = line.strip()
            if line.startswith('import androidx.compose.material3.'):
                # Extract the import path and convert to file path
                import_path = line.replace('import ', '').replace('.', '/') + '.kt'
                if 'androidx/compose/material3/' in import_path:
                    # Convert to repository path
                    repo_path = import_path.replace(
                        'androidx/compose/material3/', 
                        'compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/'
                    )
                    dependencies.append(repo_path)
        
        return dependencies

    def fetch_from_file_list(self, file_list_path, output_dir="kotlin-code"):
        """
        Fetch multiple files from a text file containing file paths

        Args:
            file_list_path (str): Path to text file containing file paths
            output_dir (str): Local directory to save the files

        Returns:
            dict: Results with success/failure status for each file
        """
        try:
            with open(file_list_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            # Filter out comments and empty lines
            file_paths = []
            for line in lines:
                line = line.strip()
                if line and not line.startswith('#'):
                    file_paths.append(line)

            print(f"Found {len(file_paths)} files to download from {file_list_path}")
            return self.fetch_multiple_files(file_paths, output_dir)

        except FileNotFoundError:
            print(f"✗ File list not found: {file_list_path}")
            return {}
        except Exception as e:
            print(f"✗ Error reading file list: {e}")
            return {}

def main():
    parser = argparse.ArgumentParser(description='Fetch Android source files')
    parser.add_argument('file_path', nargs='?', help='Path to the file in the repository')
    parser.add_argument('output_dir', nargs='?', default='kotlin-code',
                       help='Output directory (default: kotlin-code)')
    parser.add_argument('--batch', '-b', metavar='FILE_LIST',
                       help='Batch download from file list (e.g., wavy-progress-files.txt)')
    parser.add_argument('--recursive', '-r', action='store_true',
                       help='Recursively fetch dependencies')

    args = parser.parse_args()

    fetcher = AndroidSourceFetcher()

    if args.batch:
        print(f"Batch downloading from: {args.batch}")
        results = fetcher.fetch_from_file_list(args.batch, args.output_dir)

        success_count = sum(1 for success in results.values() if success)
        total_count = len(results)

        print(f"\n📊 Results: {success_count}/{total_count} files downloaded successfully")

        if success_count < total_count:
            print("\n❌ Failed files:")
            for file_path, success in results.items():
                if not success:
                    print(f"  - {file_path}")

        sys.exit(0 if success_count == total_count else 1)

    if not args.file_path:
        parser.print_help()
        sys.exit(1)

    if args.recursive:
        print("Recursive dependency fetching enabled")
        # TODO: Implement recursive dependency fetching
        # This would analyze imports and fetch related files

    success = fetcher.fetch_file(args.file_path, args.output_dir)

    if success:
        print(f"\n✓ File successfully downloaded to {args.output_dir}/")
    else:
        print(f"\n✗ Failed to download file")
        sys.exit(1)

if __name__ == "__main__":
    main()
