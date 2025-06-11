#!/bin/bash

# Exit on error
set -e

# Ensure we run from project root
cd "$(dirname "$0")"

# Step 0: Remove broken venv if it exists
if [ -d "api/venv" ]; then
    echo "Removing old virtual environment..."
    rm -rf api/venv
fi

# Step 1: Create new virtual environment
python3 -m venv api/venv

# Step 2: Activate virtual environment
source api/venv/bin/activate

# Step 3: Upgrade pip and install Python dependencies
pip install --upgrade pip
# Force install psycopg2-binary in case psycopg2 is present
pip uninstall -y psycopg2 || true
pip install psycopg2-binary

# Install remaining requirements
pip install -r api/requirements.txt

# Step 4: Install Node.js dependencies
npm install

# Step 5: Start backend in background
python3 api/mistral_server.py &

# Step 6: Start frontend
npm start
