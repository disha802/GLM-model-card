"""
MusicGen inference — Module 4 of the pipeline.

A thin wrapper around MusicGen Small that hides which library actually
runs it. Two backends are supported:

    transformers  — `MusicgenForConditionalGeneration`; installs cleanly
                    on current Colab, fp16 on the T4.
    audiocraft    — Meta's reference stack from the project spec.

The model is a process-wide singleton, loaded lazily (or at startup when
EMOJIMUSE_WARMUP is on). Generation is serialised with a lock because a
Colab T4 only has room for one render at a time.
"""
from __future__ import annotations

import threading
import time
from pathlib import Path

import numpy as np
import soundfile as sf

from .config import settings


def _resolve_device(pref: str) -> str:
    if pref in {"cuda", "cpu"}:
        return pref
    try:
        import torch

        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:
        return "cpu"


class MusicGenEngine:
    def __init__(self) -> None:
        self._load_lock = threading.Lock()
        self._infer_lock = threading.Lock()
        self._loaded = False
        self._backend = settings.MODEL_BACKEND
        self._model_name = settings.MODEL_NAME
        self.device = _resolve_device(settings.DEVICE)
        self.sample_rate: int | None = None
        # backend handles
        self._model = None
        self._processor = None

    # ---- lifecycle --------------------------------------------------
    @property
    def loaded(self) -> bool:
        return self._loaded

    def describe(self) -> dict:
        return {
            "backend": self._backend,
            "model": self._model_name,
            "device": self.device,
            "loaded": self._loaded,
            "sample_rate": self.sample_rate,
        }

    def load(self) -> None:
        if self._loaded:
            return
        with self._load_lock:
            if self._loaded:
                return
            if self._backend == "audiocraft":
                self._load_audiocraft()
            else:
                self._load_transformers()
            self._loaded = True

    def _load_transformers(self) -> None:
        import torch
        from transformers import AutoProcessor, MusicgenForConditionalGeneration

        self._processor = AutoProcessor.from_pretrained(self._model_name)
        dtype = torch.float16 if self.device == "cuda" else torch.float32
        model = MusicgenForConditionalGeneration.from_pretrained(
            self._model_name, torch_dtype=dtype
        )
        model.to(self.device)
        model.eval()
        self._model = model
        self.sample_rate = int(model.config.audio_encoder.sampling_rate)

    def _load_audiocraft(self) -> None:
        from audiocraft.models import MusicGen

        model = MusicGen.get_pretrained(self._model_name, device=self.device)
        self._model = model
        self.sample_rate = int(model.sample_rate)

    # ---- inference ------------------------------------------------
    def generate(self, prompt: str, duration: int) -> tuple[np.ndarray, int, float]:
        """
        Render `prompt` to audio.

        Returns (samples, sample_rate, elapsed_seconds) where `samples`
        is float32, shape (n,) mono or (n, channels).
        """
        self.load()
        duration = max(1, min(int(duration), settings.MAX_DURATION))
        started = time.perf_counter()
        with self._infer_lock:
            if self._backend == "audiocraft":
                audio = self._generate_audiocraft(prompt, duration)
            else:
                audio = self._generate_transformers(prompt, duration)
        elapsed = time.perf_counter() - started
        return audio, int(self.sample_rate), elapsed

    def _generate_transformers(self, prompt: str, duration: int) -> np.ndarray:
        import torch

        # MusicGen runs at a 50 Hz token frame rate.
        max_new_tokens = int(duration * 50)
        inputs = self._processor(text=[prompt], padding=True, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        with torch.no_grad():
            tokens = self._model.generate(
                **inputs,
                do_sample=True,
                guidance_scale=3.0,
                max_new_tokens=max_new_tokens,
            )
        wav = tokens[0].to(torch.float32).cpu().numpy()  # (channels, samples)
        return np.squeeze(wav).T if wav.ndim > 1 else wav

    def _generate_audiocraft(self, prompt: str, duration: int) -> np.ndarray:
        self._model.set_generation_params(duration=duration)
        wav = self._model.generate([prompt])  # (1, channels, samples)
        arr = wav[0].cpu().numpy().astype(np.float32)  # (channels, samples)
        return arr.T if arr.ndim > 1 else arr


engine = MusicGenEngine()


def render_to_file(prompt: str, duration: int, out_path: Path) -> dict:
    """Generate audio for `prompt` and write it to `out_path` as WAV."""
    audio, sample_rate, elapsed = engine.generate(prompt, duration)

    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    if peak > 1e-4:
        audio = audio / peak * 0.97  # normalise, leave a little headroom

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(out_path), audio, sample_rate, subtype="PCM_16")

    frames = audio.shape[0]
    return {
        "sample_rate": sample_rate,
        "seconds": round(frames / sample_rate, 2),
        "render_seconds": round(elapsed, 2),
    }
