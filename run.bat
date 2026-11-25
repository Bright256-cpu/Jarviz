@echo off
cd /d "%~dp0"
where python >nul 2>nul || (echo Install Python 3.9+ from https://python.org & pause & exit /b 1)
where ollama >nul 2>nul || (echo Install Ollama from https://ollama.com first & pause & exit /b 1)

curl -s http://127.0.0.1:11434/api/tags >nul 2>nul
if errorlevel 1 (
  echo Starting Ollama...
  start "" /min ollama serve
  timeout /t 4 >nul
)

python server.py
pause
