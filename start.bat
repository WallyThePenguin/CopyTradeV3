@echo off
REM Start Python backend and Node frontend in separate terminals
cd /d %~dp0

start "Python Backend" cmd /k "call api\venv\Scripts\activate.bat && python api\mistral_server.py"
start "Node Frontend" cmd /k "npm start"

