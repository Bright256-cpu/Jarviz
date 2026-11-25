# J.A.R.V.I.S. (local)

A Jarvis-style assistant that runs 100% on your machine. No API keys, no cloud.

- **HUD** in your browser: animated ring / cube / face, live status, knowledge graph of your memory
- **Brain**: any model you have in [Ollama](https://ollama.com) (default `qwen3.5:9b`, as in the video)
- **Voice**: speak to it (mic) and it talks back (browser speech, offline-capable depending on your OS voices)
- **Memory**: plain markdown files in `memory/`. Say "remember that ..." and it saves a note. Relevant notes are fed to the model automatically.
- **Zero dependencies**: Python standard library only

## Quick start

1. Install [Python 3.9+](https://python.org) and [Ollama](https://ollama.com)
2. Pull a model (pick one that fits your RAM):
   ```
   ollama pull qwen3.5:9b      # ~16 GB RAM
   ollama pull qwen3:4b        # lighter, ~8 GB RAM
   ```
3. Run it:
   - macOS/Linux: `./run.sh` (first time: `chmod +x run.sh`)
   - Windows: double-click `run.bat`
   - or just: `python3 server.py`
4. Your browser opens at http://127.0.0.1:8765. Use **Chrome or Edge** for voice input.

If the model in `config.json` isn't installed, Jarvis automatically uses the first model Ollama has.

## Using it

| Do this | Result |
|---|---|
| Type or press **MIC** | Talk to Jarvis. Sentences are spoken as they stream in |
| "what time is it" / "what's the date" | Instant reflex answer, no model needed |
| "remember that my passport expires in May" | Saved to `memory/notes/` and appears as a node in the graph |
| Ask about something you saved | Matching notes are injected into the prompt |
| **Esc** | Stop talking |
| **EYES** | Shows your webcam preview (stays local; vision isn't wired to the model yet) |
| **HOLO** | Scanline hologram effect |
| **VOICE / REFLEX** | Turn speech output / instant answers on or off |

## Customize

- `config.json`: model, your name, port, temperature
- `memory/notes`, `skills`, `tools`, `worlds`: markdown files; link them with `[[other note title]]` to draw edges in the graph
- `workspace/`: drop any file; it appears as a "Files" node
- `server.py` → `reflex()`: add instant commands (open an app, control lights, etc.)
- `web/app.js`: colors and HUD modes

## Ideas for next steps

- Vision: send webcam frames to a multimodal model (`ollama pull qwen2.5vl`) for the EYES toggle
- Better voice: swap browser TTS for a local engine like Piper or Kokoro
- Wake word, system control (open apps, volume), calendar via local files
- Real tool calling: Ollama supports tools in `/api/chat`; add them in `stream_chat()`

## Privacy

The server binds to 127.0.0.1 only. Nothing is sent anywhere except to your local Ollama.
Browser speech recognition in Chrome/Edge may use the browser vendor's cloud service; if you need fully offline
voice input, replace it with a local Whisper (e.g. whisper.cpp) later.
