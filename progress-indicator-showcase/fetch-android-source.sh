#!/bin/bash
# Shell script to fetch Android source files

if [ $# -eq 0 ]; then
    echo "Usage: ./fetch-android-source.sh <file_path> [output_dir]"
    echo ""
    echo "Examples:"
    echo "  ./fetch-android-source.sh compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/WavyProgressIndicator.kt"
    echo "  ./fetch-android-source.sh compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/internal/ProgressIndicatorImpl.kt kotlin-code/"
    exit 1
fi

python3 fetch-android-source.py "$@"
