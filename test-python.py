"""
Simple Python script to test if uv can run Python scripts correctly
"""

import sys
import platform

print("Python version:", sys.version)
print("Platform:", platform.platform())
print("Python executable:", sys.executable)
print("Path:", sys.path)

print("\nTest successful!")
