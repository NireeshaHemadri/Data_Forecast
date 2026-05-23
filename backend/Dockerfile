FROM python:3.10-slim

WORKDIR /app

# Install system dependencies if any are needed (e.g. pg_config for psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend codebase
COPY . .

# Expose backend port
EXPOSE 8000

# Run FastAPI using uvicorn binding dynamically to PORT assigned by hosting environment
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
