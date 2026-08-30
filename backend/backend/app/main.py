"""
FastAPI app — Module 5 of the pipeline.

Wires the Emoji Semantic Engine, Prompt Generator and MusicGen together
behind the HTTP contract the frontend expects:

    GET  /health          -> { "status": "ok", "device": "cuda", ... }
    POST /generate         -> { "status": "success", "prompt": ..., "audio_url": ... }
    GET  /audio/<file>.wav -> the rendered track

Run locally:
    uvicorn app.main:app --host 0.0.0.0 --port 8000

On Colab, see backend/README.md for the ngrok bootstrap.
"""
from __future__ import annotations

import time
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .config import settings
from .musicgen import engine, render_to_file
from .prompt import build_prompt
from .semantics import MOOD_GROUPS, interpret, split_emoji

app = FastAPI(title="EmojiMuse API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings.AUDIO_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/audio", StaticFiles(directory=str(settings.AUDIO_DIR)), name="audio")


# --------------------------------------------------------------------------
# schemas
# --------------------------------------------------------------------------
class GenerateRequest(BaseModel):
    emoji: str = Field(..., description="Emoji combination, e.g. '🌧️💔🌙'")
    duration: int | None = Field(
        default=None, ge=1, le=settings.MAX_DURATION,
        description="Clip length in seconds; defaults to the server setting.",
    )


# --------------------------------------------------------------------------
# lifecycle
# --------------------------------------------------------------------------
@app.on_event("startup")
def _startup() -> None:
    if settings.WARMUP:
        import threading

        threading.Thread(target=engine.load, name="musicgen-warmup", daemon=True).start()


def _sweep_old_audio() -> None:
    ttl = settings.AUDIO_TTL_MINUTES
    if ttl <= 0:
        return
    cutoff = time.time() - ttl * 60
    for wav in settings.AUDIO_DIR.glob("*.wav"):
        try:
            if wav.stat().st_mtime < cutoff:
                wav.unlink()
        except OSError:
            pass


# --------------------------------------------------------------------------
# routes
# --------------------------------------------------------------------------
@app.get("/")
def root() -> dict:
    return {
        "name": "EmojiMuse API",
        "endpoints": ["/health", "/generate", "/palette"],
        "model": engine.describe(),
    }


@app.get("/health")
def health() -> dict:
    info = engine.describe()
    return {
        "status": "ok",
        "device": info["device"],
        "backend": info["backend"],
        "model": info["model"],
        "model_loaded": info["loaded"],
        "sample_rate": info["sample_rate"],
    }


@app.get("/palette")
def palette() -> dict:
    """The curated mood palette, so the frontend can stay in sync."""
    return {"groups": MOOD_GROUPS}


@app.post("/generate")
async def generate(req: GenerateRequest) -> dict:
    emoji_list = split_emoji(req.emoji)
    if not emoji_list:
        raise HTTPException(status_code=422, detail="No emoji found in request.")

    reading = interpret(emoji_list)
    if reading is None:
        raise HTTPException(status_code=422, detail="Could not interpret the emoji.")

    prompt = build_prompt(reading)
    duration = req.duration or settings.DEFAULT_DURATION

    _sweep_old_audio()
    filename = f"{uuid.uuid4().hex}.wav"
    out_path: Path = settings.AUDIO_DIR / filename

    try:
        meta = await run_in_threadpool(render_to_file, prompt, duration, out_path)
    except Exception as exc:  # noqa: BLE001 — surface any inference failure to the client
        raise HTTPException(status_code=500, detail=f"Generation failed: {exc}") from exc

    return {
        "status": "success",
        "emoji": reading.emoji,
        "prompt": prompt,
        "audio_url": f"/audio/{filename}",
        "attributes": reading.to_dict(),
        "meta": meta,
    }
