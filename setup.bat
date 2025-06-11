@echo off
REM Setup script for Windows
cd /d %~dp0

REM Remove existing virtual environment
if exist "api\venv" (
    echo Removing old virtual environment...
    rmdir /s /q "api\venv"
)

python -m venv api\venv
call api\venv\Scripts\activate.bat

python -m pip install --upgrade pip
pip uninstall -y psycopg2 >nul 2>&1
pip install psycopg2-binary
pip install -r api\requirements.txt

npm install

echo Setup complete. Use start.bat to run the application.
