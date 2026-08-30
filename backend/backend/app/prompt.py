"""
Prompt Generator — Module 3 of the pipeline.

Turns a `Reading` from the Emoji Semantic Engine into a single
natural-language sentence that MusicGen understands well. MusicGen
responds best to a compact description that names mood, genre, tempo,
tonality, instrumentation and texture — not a paragraph.
"""
from __future__ import annotations

from .semantics import Reading

_TONALITY = {
    "minor": "in a minor key",
    "major": "in a major key",
    "modal": "with a modal, floating tonality",
}


def build_prompt(reading: Reading) -> str:
    """Compose the MusicGen prompt for a reading."""
    mood_word, energy_word = (part.strip() for part in reading.mood.split(","))
    instruments = ", ".join(reading.instruments) or "piano, pads"
    textures = ", ".join(reading.textures) or "clean"
    tonality = _TONALITY.get(reading.mode, _TONALITY["modal"])

    return (
        f"A {energy_word} {mood_word} {reading.genre} piece at around "
        f"{reading.tempo} BPM {tonality}, built from {instruments}, with a "
        f"{textures} texture. The arrangement should breathe and resolve naturally."
    )
