"""Pipeline tests that don't need the model (semantics + prompt)."""
from __future__ import annotations

from app.prompt import build_prompt
from app.semantics import interpret, split_emoji


def test_split_emoji_handles_combined_string():
    assert split_emoji("🌧️💔🌙") == ["🌧️", "💔", "🌙"]


def test_split_emoji_drops_ascii_and_whitespace():
    assert split_emoji("  😊 hello 🔥 ") == ["😊", "🔥"]


def test_split_emoji_empty():
    assert split_emoji("") == []
    assert split_emoji("just text") == []


def test_interpret_melancholic_combo():
    r = interpret(["🌧️", "💔", "🌙"])
    assert r is not None
    assert r.mode == "minor"
    assert r.valence < 0
    assert r.tempo < 90
    assert "piano" in " ".join(r.instruments).lower() or r.instruments


def test_interpret_bright_combo():
    r = interpret(["😄", "🎉", "🌞"])
    assert r is not None
    assert r.mode == "major"
    assert r.valence > 0.5
    assert r.tempo > 100


def test_interpret_unknown_emoji_falls_back():
    r = interpret(["🦖"])
    assert r is not None
    assert r.unknown == ["🦖"]


def test_interpret_empty_is_none():
    assert interpret([]) is None


def test_build_prompt_mentions_key_dimensions():
    r = interpret(["🌧️", "💔", "🌙"])
    prompt = build_prompt(r)
    assert str(r.tempo) in prompt
    assert "minor" in prompt
    assert prompt.endswith("naturally.")
