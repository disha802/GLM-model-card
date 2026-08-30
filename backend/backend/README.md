# EmojiMuse — Backend

FastAPI service that turns an emoji combination into an original piece of
music: **Emoji → Semantic Engine → Prompt → MusicGen → WAV**.

```
app/
  semantics.py   Module 2 — emoji → musical attributes → a single "reading"
  prompt.py      Module 3 — reading → MusicGen prompt sentence
  musicgen.py    Module 4 — MusicGen Small inference (transformers or audiocraft)
  main.py        Module 5 — FastAPI: /health, /generate, /audio, /palette
  config.py      env-driven settings
colab_server.py  start the API + open an ngrok tunnel (Colab)
run_local.py     local dev server
tests/           pipeline tests (no model needed)
```

## HTTP contract

The frontend (`../Emoji.html`) expects exactly this:

### `GET /health`
```json
{ "status": "ok", "device": "cuda", "backend": "transformers",
  "model": "facebook/musicgen-small", "model_loaded": true, "sample_rate": 32000 }
```

### `POST /generate`
Request:
```json
{ "emoji": "🌧️💔🌙", "duration": 10 }
```
`duration` is optional (defaults to `EMOJIMUSE_DEFAULT_DURATION`).

Response:
```json
{
  "status": "success",
  "emoji": ["🌧️", "💔", "🌙"],
  "prompt": "A still melancholic cinematic ambient piece at around 71 BPM in a minor key, ...",
  "audio_url": "/audio/4f45...66.wav",
  "attributes": { "valence": -0.22, "energy": 0.25, "tension": 0.48, "tempo": 71,
                  "mode": "minor", "hue": 245.0, "mood": "melancholic, still",
                  "instruments": ["rhodes", "soft strings", "vinyl rain", "solo piano"],
                  "textures": ["rain-soft", "aching", "nocturnal"],
                  "genre": "cinematic ambient", "unknown": [] },
  "meta": { "sample_rate": 32000, "seconds": 10.0, "render_seconds": 18.4 }
}
```
`audio_url` is relative to the API base; the frontend also accepts an
absolute URL or the audio file returned directly.

### `GET /audio/<file>.wav`
The rendered track (`audio/wav`). Files older than
`EMOJIMUSE_AUDIO_TTL_MINUTES` are swept on each `/generate`.

### `GET /palette`
The curated mood palette, so the frontend can stay in sync with the engine.

CORS defaults to `*` (frontend is on GitHub Pages behind a rotating tunnel).

## Run locally

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python run_local.py            # http://localhost:8000  (docs at /docs)
```

Without a GPU, generation falls back to CPU and is slow (minutes per clip)
but works. Set `EMOJIMUSE_DEFAULT_DURATION=5` while testing.

## Run on Google Colab (T4)

1. Runtime → Change runtime type → **T4 GPU**.
2. Get the code onto Colab, then install deps:
   ```python
   !git clone https://github.com/<you>/EmojiMuse.git
   %cd EmojiMuse/backend
   !pip install -q -r requirements.txt
   ```
3. Start the server + open a public tunnel:
   ```python
   !python colab_server.py
   ```
   Default tunnel is **cloudflared** (no signup). To use ngrok instead:
   ```python
   import os
   os.environ["EMOJIMUSE_TUNNEL"] = "ngrok"
   os.environ["NGROK_AUTHTOKEN"] = "xxxx"   # dashboard.ngrok.com
   !python colab_server.py
   ```
4. Copy the printed `https://…` URL into the frontend's **Rig** dialog.
   It changes every Colab session — that's expected.

## Configuration

All settings are environment variables (see `.env.example`). Set them
*before* the server imports `app.main` (in a Colab cell, or exported in a
shell). Key ones:

| Variable | Default | Notes |
|---|---|---|
| `EMOJIMUSE_MODEL_BACKEND` | `transformers` | or `audiocraft` (see below) |
| `EMOJIMUSE_DEVICE` | `auto` | `cuda` / `cpu` |
| `EMOJIMUSE_WARMUP` | `true` | load model at startup vs first request |
| `EMOJIMUSE_DEFAULT_DURATION` | `10` | seconds |
| `EMOJIMUSE_MAX_DURATION` | `30` | seconds |
| `EMOJIMUSE_ALLOWED_ORIGINS` | `*` | comma-separated origin allowlist |

### AudioCraft backend (project-spec parity)

```bash
pip install -r requirements-audiocraft.txt
export EMOJIMUSE_MODEL_BACKEND=audiocraft
```
AudioCraft pins older dependencies and is fussier on current Colab —
prefer the default `transformers` stack unless you need it.

## Tests

```bash
cd backend
pip install pytest
python -m pytest            # semantics + prompt, no model download
```

## Notes

- One Colab T4 renders one clip at a time; `/generate` serialises
  inference with a lock, so concurrent requests queue rather than OOM.
- Colab is for the prototype/demo only. For anything permanent, move
  MusicGen to a dedicated GPU host and point the frontend at it.
- `app/semantics.py` is the source of truth for the emoji → attribute
  table. If the frontend keeps its own copy (for UI dials / an offline
  demo synth), mirror it from here.
