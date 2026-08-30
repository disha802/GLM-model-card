"""
Runtime configuration, all overridable from the environment.

On Colab you normally only need to touch nothing — the defaults target a
single T4. Set values with `os.environ[...] = ...` in a notebook cell
*before* importing `app.main`, or export them in a shell.
"""
from __future__ import annotations

import os
from pathlib import Path


def _env_str(key: str, default: str) -> str:
    return os.environ.get(key, default).strip()


def _env_int(key: str, default: int) -> int:
    try:
        return int(os.environ.get(key, default))
    except (TypeError, ValueError):
        return default


def _env_bool(key: str, default: bool) -> bool:
    raw = os.environ.get(key)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    # ---- model -----------------------------------------------------------
    # Which library drives MusicGen:
    #   "transformers" — pip-friendly, works on modern Colab out of the box
    #   "audiocraft"   — Meta's reference stack (matches the project spec)
    MODEL_BACKEND: str = _env_str("EMOJIMUSE_MODEL_BACKEND", "transformers")
    MODEL_NAME: str = _env_str("EMOJIMUSE_MODEL_NAME", "facebook/musicgen-small")
    # "cuda", "cpu", or "auto"
    DEVICE: str = _env_str("EMOJIMUSE_DEVICE", "auto")
    # Load the model when the server boots instead of on the first request.
    WARMUP: bool = _env_bool("EMOJIMUSE_WARMUP", True)

    # ---- generation ----------------------------------------------------
    DEFAULT_DURATION: int = _env_int("EMOJIMUSE_DEFAULT_DURATION", 10)
    MAX_DURATION: int = _env_int("EMOJIMUSE_MAX_DURATION", 30)

    # ---- audio storage -----------------------------------------------
    AUDIO_DIR: Path = Path(_env_str("EMOJIMUSE_AUDIO_DIR", "generated_audio")).resolve()
    # Delete generated files older than this many minutes on each request.
    # 0 disables the sweep (keep everything for the session).
    AUDIO_TTL_MINUTES: int = _env_int("EMOJIMUSE_AUDIO_TTL_MINUTES", 120)

    # ---- http ----------------------------------------------------------
    # Comma-separated list, or "*" for any origin. The frontend is served
    # from GitHub Pages and hits this box through a rotating tunnel, so the
    # default is wide open — tighten it if you know your Pages URL.
    ALLOWED_ORIGINS: str = _env_str("EMOJIMUSE_ALLOWED_ORIGINS", "*")

    @property
    def allowed_origins_list(self) -> list[str]:
        if self.ALLOWED_ORIGINS.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


settings = Settings()
