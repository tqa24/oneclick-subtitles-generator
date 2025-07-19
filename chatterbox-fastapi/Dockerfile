# Dockerfile for Chatterbox FastAPI Service
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    build-essential \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements-api.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements-api.txt

# Install chatterbox (assuming it's already installed in the environment)
# If you need to install from source, uncomment the following:
# COPY chatterbox/ ./chatterbox/
# RUN pip install -e ./chatterbox/

# Copy API files
COPY api.py .
COPY start_api.py .

# Create directory for temporary files
RUN mkdir -p /tmp/chatterbox

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the API
CMD ["python", "start_api.py", "--host", "0.0.0.0", "--port", "8000"]
