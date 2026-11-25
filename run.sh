#!/usr/bin/env bash
# Start Jarvis on macOS / Linux.
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null; then echo "Install Python 3.9+ first: https://python.org"; exit 1; fi
if ! command -v ollama >/dev/null; then
  echo "Ollama not found. Install it from https://ollama.com then run this again."; exit 1
fi

# start Ollama in the background if it isn't already answering
if ! curl -s http://127.0.0.1:11434/api/tags >/dev/null; then
  echo "Starting Ollama..."; (ollama serve >/dev/null 2>&1 &); sleep 3
fi

MODEL=$(python3 -c "import json;print(json.load(open('config.json'))['model'])")
if ! ollama list | grep -q "^${MODEL}"; then
  echo "Model $MODEL not installed. Pull it now? (several GB)  [y/N]"; read -r a
  [ "$a" = "y" ] && ollama pull "$MODEL"
fi

python3 server.py
