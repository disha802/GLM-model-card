"""
Emoji Semantic Engine — Module 2 of the pipeline.

Maps each emoji to musical dimensions, then reduces a combination of
emoji to a single "reading" the prompt generator can turn into words.

The table here is the authoritative copy. If the frontend keeps its own
mirror (for UI dials / an offline demo synth), sync it from here.

Per-emoji dimensions:
    valence  -1..1   unpleasant .. pleasant
    energy    0..1    calm .. intense
    tension   0..1    resolved .. unresolved
    hue       deg     patch-cable / UI colour
    tempo     bpm     rough centre
    mode     'major' | 'minor' | 'modal'
    instr     short instrument list
    texture   one adjective
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Iterable

import regex  # grapheme-aware splitting (\X)

# --------------------------------------------------------------------------
# Palette groups — mirrors MOOD_GROUPS in the frontend.
# --------------------------------------------------------------------------
MOOD_GROUPS: list[dict] = [
    {"id": "bright", "label": "Bright", "emoji": ["😊", "😄", "🌞", "☀️", "🌻", "✨", "🎉"]},
    {"id": "calm", "label": "Calm / Dreamy", "emoji": ["🌙", "🌧️", "☁️", "🕊️", "🫧", "🌊"]},
    {"id": "warm", "label": "Warm / Love", "emoji": ["❤️", "🥰", "💌", "🌹"]},
    {"id": "intense", "label": "Energy / Intense", "emoji": ["🔥", "⚡", "💥", "🏃", "🥁"]},
    {"id": "melancholy", "label": "Melancholy", "emoji": ["💔", "🥀", "🌫️", "🖤", "😢"]},
    {"id": "night", "label": "Mystery / Night", "emoji": ["🌌", "🪐", "🔮", "🌑", "🦉"]},
]

# --------------------------------------------------------------------------
# Per-emoji attribute table.
# --------------------------------------------------------------------------
_E: dict[str, dict] = {
    "😊": {"valence": 0.80, "energy": 0.55, "tension": 0.15, "hue": 45, "tempo": 112, "mode": "major", "instr": ["piano", "acoustic guitar"], "texture": "bright"},
    "😄": {"valence": 0.90, "energy": 0.75, "tension": 0.10, "hue": 40, "tempo": 124, "mode": "major", "instr": ["upright piano", "hand claps", "brass"], "texture": "buoyant"},
    "🌞": {"valence": 0.85, "energy": 0.60, "tension": 0.10, "hue": 48, "tempo": 116, "mode": "major", "instr": ["nylon guitar", "marimba"], "texture": "sunlit"},
    "☀️": {"valence": 0.82, "energy": 0.58, "tension": 0.12, "hue": 50, "tempo": 114, "mode": "major", "instr": ["acoustic guitar", "shaker"], "texture": "open"},
    "🌻": {"valence": 0.78, "energy": 0.50, "tension": 0.14, "hue": 52, "tempo": 104, "mode": "major", "instr": ["folk guitar", "glockenspiel"], "texture": "warm"},
    "✨": {"valence": 0.70, "energy": 0.50, "tension": 0.20, "hue": 190, "tempo": 100, "mode": "modal", "instr": ["celesta", "bells", "pads"], "texture": "glittering"},
    "🎉": {"valence": 0.88, "energy": 0.85, "tension": 0.10, "hue": 32, "tempo": 128, "mode": "major", "instr": ["horns", "drum kit", "bass"], "texture": "festive"},

    "🌙": {"valence": 0.15, "energy": 0.20, "tension": 0.35, "hue": 225, "tempo": 72, "mode": "minor", "instr": ["felt piano", "ambient pads"], "texture": "nocturnal"},
    "🌧️": {"valence": -0.10, "energy": 0.25, "tension": 0.40, "hue": 210, "tempo": 76, "mode": "minor", "instr": ["rhodes", "soft strings", "vinyl rain"], "texture": "rain-soft"},
    "☁️": {"valence": 0.20, "energy": 0.18, "tension": 0.25, "hue": 205, "tempo": 68, "mode": "modal", "instr": ["pads", "muted piano"], "texture": "hazy"},
    "🕊️": {"valence": 0.45, "energy": 0.22, "tension": 0.15, "hue": 195, "tempo": 70, "mode": "major", "instr": ["harp", "strings"], "texture": "serene"},
    "🫧": {"valence": 0.40, "energy": 0.30, "tension": 0.20, "hue": 185, "tempo": 92, "mode": "major", "instr": ["mallets", "plucked synth"], "texture": "weightless"},
    "🌊": {"valence": 0.25, "energy": 0.45, "tension": 0.30, "hue": 200, "tempo": 90, "mode": "modal", "instr": ["synth swells", "low strings"], "texture": "tidal"},

    "❤️": {"valence": 0.75, "energy": 0.40, "tension": 0.20, "hue": 350, "tempo": 92, "mode": "major", "instr": ["warm piano", "strings"], "texture": "tender"},
    "🥰": {"valence": 0.82, "energy": 0.42, "tension": 0.15, "hue": 340, "tempo": 96, "mode": "major", "instr": ["rhodes", "brushed drums"], "texture": "affectionate"},
    "💌": {"valence": 0.70, "energy": 0.35, "tension": 0.22, "hue": 355, "tempo": 88, "mode": "major", "instr": ["music box", "strings"], "texture": "sentimental"},
    "🌹": {"valence": 0.55, "energy": 0.40, "tension": 0.35, "hue": 348, "tempo": 84, "mode": "minor", "instr": ["nylon guitar", "cello"], "texture": "romantic"},

    "🔥": {"valence": 0.35, "energy": 0.95, "tension": 0.55, "hue": 18, "tempo": 140, "mode": "minor", "instr": ["distorted synth", "hard drums", "sub bass"], "texture": "scorching"},
    "⚡": {"valence": 0.40, "energy": 0.98, "tension": 0.60, "hue": 55, "tempo": 150, "mode": "minor", "instr": ["arps", "punchy drums"], "texture": "electric"},
    "💥": {"valence": 0.30, "energy": 0.92, "tension": 0.70, "hue": 12, "tempo": 138, "mode": "minor", "instr": ["impacts", "brass hits", "drums"], "texture": "explosive"},
    "🏃": {"valence": 0.50, "energy": 0.88, "tension": 0.40, "hue": 28, "tempo": 146, "mode": "major", "instr": ["driving bass", "four-on-the-floor"], "texture": "propulsive"},
    "🥁": {"valence": 0.45, "energy": 0.80, "tension": 0.35, "hue": 30, "tempo": 132, "mode": "modal", "instr": ["live drums", "percussion"], "texture": "rhythmic"},

    "💔": {"valence": -0.70, "energy": 0.30, "tension": 0.60, "hue": 300, "tempo": 66, "mode": "minor", "instr": ["solo piano", "sub strings"], "texture": "aching"},
    "🥀": {"valence": -0.55, "energy": 0.22, "tension": 0.50, "hue": 320, "tempo": 64, "mode": "minor", "instr": ["felt piano", "cello"], "texture": "wilting"},
    "🌫️": {"valence": -0.20, "energy": 0.18, "tension": 0.45, "hue": 220, "tempo": 62, "mode": "modal", "instr": ["drones", "distant piano"], "texture": "obscured"},
    "🖤": {"valence": -0.45, "energy": 0.35, "tension": 0.55, "hue": 260, "tempo": 74, "mode": "minor", "instr": ["low synth", "slow drums"], "texture": "sombre"},
    "😢": {"valence": -0.60, "energy": 0.25, "tension": 0.50, "hue": 210, "tempo": 68, "mode": "minor", "instr": ["piano", "strings"], "texture": "tearful"},

    "🌌": {"valence": 0.30, "energy": 0.35, "tension": 0.40, "hue": 250, "tempo": 82, "mode": "modal", "instr": ["wide pads", "arpeggios", "sub bass"], "texture": "cosmic"},
    "🪐": {"valence": 0.35, "energy": 0.40, "tension": 0.35, "hue": 265, "tempo": 86, "mode": "modal", "instr": ["analog synth", "slow arps"], "texture": "orbital"},
    "🔮": {"valence": 0.20, "energy": 0.30, "tension": 0.50, "hue": 285, "tempo": 78, "mode": "minor", "instr": ["glass pads", "bowed metal"], "texture": "mystic"},
    "🌑": {"valence": -0.10, "energy": 0.28, "tension": 0.55, "hue": 255, "tempo": 70, "mode": "minor", "instr": ["deep drones", "sparse piano"], "texture": "eclipsed"},
    "🦉": {"valence": 0.10, "energy": 0.30, "tension": 0.40, "hue": 235, "tempo": 74, "mode": "modal", "instr": ["woodwinds", "soft mallets"], "texture": "watchful"},
}

_FALLBACK = {"valence": 0.10, "energy": 0.45, "tension": 0.35, "hue": 210, "tempo": 96, "mode": "modal", "instr": ["piano", "pads"], "texture": "neutral"}

KNOWN_EMOJI: list[str] = list(_E)

# Lookup that tolerates a missing/extra U+FE0F variation selector.
_VS16 = "️"
_NORMALIZED = {k.replace(_VS16, ""): v for k, v in _E.items()}


def _clamp(n: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, n))


def attributes_for(emoji: str) -> dict:
    """Attributes for a single emoji, falling back to a neutral profile."""
    if emoji in _E:
        return _E[emoji]
    return _NORMALIZED.get(emoji.replace(_VS16, ""), _FALLBACK)


def split_emoji(raw: str) -> list[str]:
    """
    Turn the frontend's combined string ("🌧️💔🌙") into a list of emoji.

    Splits on grapheme clusters so ZWJ sequences and skin-tone modifiers
    stay whole, then drops anything that is plainly not an emoji
    (whitespace, ASCII, stray punctuation).
    """
    out: list[str] = []
    for cluster in regex.findall(r"\X", raw or ""):
        c = cluster.strip()
        if not c:
            continue
        # keep it if any codepoint is outside the Basic Latin / Latin-1 range
        if any(ord(ch) > 0x2000 for ch in c):
            out.append(c)
    return out


_MOOD_WORDS = [(-0.45, "desolate"), (-0.15, "melancholic"), (0.15, "wistful"), (0.45, "warm"), (1.01, "radiant")]
_ENERGY_WORDS = [(0.28, "still"), (0.55, "gentle"), (0.78, "driving"), (1.01, "frenetic")]


def _word(table: list[tuple[float, str]], value: float) -> str:
    for ceiling, word in table:
        if value <= ceiling:
            return word
    return table[-1][1]


@dataclass
class Reading:
    """The reduced interpretation of an emoji combination."""

    emoji: list[str]
    valence: float
    energy: float
    tension: float
    tempo: int
    mode: str
    hue: float
    mood: str
    instruments: list[str]
    textures: list[str]
    genre: str
    tempo_label: str
    mode_label: str
    unknown: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def interpret(emoji_list: Iterable[str]) -> Reading | None:
    """Reduce a list of emoji to a single musical Reading. None if empty."""
    items = [e for e in emoji_list if e]
    if not items:
        return None

    parts = [attributes_for(e) for e in items]
    n = len(parts)

    def avg(key: str) -> float:
        return sum(p[key] for p in parts) / n

    valence = _clamp(avg("valence"), -1.0, 1.0)
    energy = _clamp(avg("energy"), 0.0, 1.0)
    tension = _clamp(avg("tension"), 0.0, 1.0)
    tempo = round(avg("tempo"))

    minor_votes = sum(1 for p in parts if p["mode"] == "minor")
    major_votes = sum(1 for p in parts if p["mode"] == "major")
    if minor_votes > major_votes:
        mode = "minor"
    elif major_votes > minor_votes:
        mode = "major"
    else:
        mode = "modal"

    mood_word = _word(_MOOD_WORDS, valence)
    energy_word = _word(_ENERGY_WORDS, energy)

    instruments: list[str] = []
    for p in parts:
        for ins in p["instr"]:
            if ins not in instruments:
                instruments.append(ins)
    instruments = instruments[:4]

    textures: list[str] = []
    for p in parts:
        if p["texture"] not in textures:
            textures.append(p["texture"])
    textures = textures[:3]

    hue = sum(p["hue"] for p in parts) / n

    if energy > 0.75 and valence < 0.4:
        genre = "cinematic electronic"
    elif energy > 0.70:
        genre = "upbeat pop"
    elif energy < 0.35 and valence < 0.0:
        genre = "cinematic ambient"
    elif energy < 0.40:
        genre = "ambient"
    elif valence > 0.50:
        genre = "acoustic pop"
    else:
        genre = "downtempo"

    unknown = [e for e in items if e not in _E and e.replace(_VS16, "") not in _NORMALIZED]

    return Reading(
        emoji=items,
        valence=round(valence, 3),
        energy=round(energy, 3),
        tension=round(tension, 3),
        tempo=tempo,
        mode=mode,
        hue=round(hue, 1),
        mood=f"{mood_word}, {energy_word}",
        instruments=instruments,
        textures=textures,
        genre=genre,
        tempo_label=f"{tempo} BPM",
        mode_label="modal / atmospheric" if mode == "modal" else mode,
        unknown=unknown,
    )
