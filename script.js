/* ==========================================================================
   EmojiMuse — script.js
   Handles: orbit rendering, emoji selection state, the client-side semantic
   engine (mirrors Module 2/3 of the project doc so the UI is fully alive
   before any backend exists), and the placeholder FastAPI integration.
   ========================================================================== */

(() => {
  "use strict";

  /* ------------------------------------------------------------------
     0. CONFIG — swap API_BASE_URL for your real Colab/ngrok/production
        FastAPI URL when the backend is live. Everything below this
        block that talks to the network is isolated so wiring the real
        backend in is a one-line change, not a rewrite.
     ------------------------------------------------------------------ */
  const CONFIG = {
    API_BASE_URL: "https://YOUR-FASTAPI-ENDPOINT.example.com", // TODO: replace
    GENERATE_PATH: "/generate",
    REQUEST_TIMEOUT_MS: 60000,
    // While true, generateMusic() never touches the network and returns a
    // simulated response so the UI is demoable standalone. Flip to false
    // once CONFIG.API_BASE_URL points at a real, reachable FastAPI server.
    USE_MOCK_BACKEND: true,
  };

  /* ------------------------------------------------------------------
     1. Emoji palette + semantic mapping (client-side mirror of the
        project's "Emoji Semantic Engine" — Module 2/3 in the doc)
     ------------------------------------------------------------------ */
  const EMOJI_PALETTE = [
    "😊", "🔥", "🌧️", "💔", "🌙", "❤️", "☀️", "🌊",
    "⚡", "🍂", "✨", "😢", "🌻", "🖤", "🎉", "🕯️",
    "😡", "😴", "🥶", "💃", "👻", "🚀", "🦋", "🌈",
    "☕", "🌸", "😌", "🎸", "🕺", "❄️", "🏆", "💫",
  ];

  // Each emoji contributes one "vote" per attribute; combining emojis
  // blends them (last-strongest-wins per attribute keeps it legible).
  const EMOJI_ATTRIBUTES = {
    "😊": { mood: "joyful", energy: "high", tempo: [110, 128], key: "major", instruments: ["piano", "acoustic guitar"], genre: "acoustic pop", weight: 3 },
    "🔥": { mood: "intense", energy: "very high", tempo: [128, 150], key: "minor", instruments: ["synth bass", "drums"], genre: "electronic", weight: 4 },
    "🌧️": { mood: "melancholic", energy: "low", tempo: [60, 75], key: "minor / atmospheric", instruments: ["piano", "soft strings"], genre: "ambient", weight: 3 },
    "💔": { mood: "heartbroken", energy: "low", tempo: [55, 70], key: "minor", instruments: ["piano", "cello"], genre: "cinematic ballad", weight: 4 },
    "🌙": { mood: "dreamy", energy: "low", tempo: [65, 85], key: "minor / modal", instruments: ["ambient pads", "soft synth"], genre: "nocturne ambient", weight: 2 },
    "❤️": { mood: "warm", energy: "medium", tempo: [90, 105], key: "major", instruments: ["strings", "piano"], genre: "romantic orchestral", weight: 3 },
    "☀️": { mood: "bright", energy: "high", tempo: [115, 130], key: "major", instruments: ["acoustic guitar", "ukulele", "claps"], genre: "summer acoustic", weight: 3 },
    "🌊": { mood: "flowing", energy: "medium", tempo: [80, 100], key: "major / modal", instruments: ["ambient pads", "soft percussion"], genre: "chillwave", weight: 2 },
    "⚡": { mood: "electric", energy: "very high", tempo: [135, 155], key: "minor", instruments: ["synth lead", "distorted bass"], genre: "synthwave", weight: 4 },
    "🍂": { mood: "nostalgic", energy: "low-medium", tempo: [75, 90], key: "minor / major blend", instruments: ["acoustic guitar", "warm strings"], genre: "folk ambient", weight: 2 },
    "✨": { mood: "magical", energy: "medium", tempo: [90, 110], key: "major / lydian", instruments: ["celesta", "ambient pads", "harp"], genre: "cinematic dream-pop", weight: 3 },
    "😢": { mood: "sorrowful", energy: "very low", tempo: [50, 65], key: "minor", instruments: ["solo piano", "cello"], genre: "cinematic solo piano", weight: 4 },
    "🌻": { mood: "uplifting", energy: "high", tempo: [112, 126], key: "major", instruments: ["acoustic guitar", "piano", "light percussion"], genre: "acoustic pop", weight: 2 },
    "🖤": { mood: "somber", energy: "low", tempo: [58, 72], key: "minor", instruments: ["ambient pads", "sub bass"], genre: "dark ambient", weight: 3 },
    "🎉": { mood: "celebratory", energy: "very high", tempo: [120, 135], key: "major", instruments: ["brass", "drums", "synth"], genre: "upbeat pop", weight: 3 },
    "🕯️": { mood: "intimate", energy: "very low", tempo: [55, 68], key: "minor / modal", instruments: ["solo piano", "ambient pads"], genre: "intimate cinematic", weight: 3 },
    "😡": { mood: "angry", energy: "very high", tempo: [140, 165], key: "minor", instruments: ["distorted guitar", "heavy drums"], genre: "hard rock", weight: 4 },
    "😴": { mood: "sleepy", energy: "very low", tempo: [45, 58], key: "major / modal", instruments: ["soft piano", "warm pads"], genre: "lo-fi sleep", weight: 2 },
    "🥶": { mood: "icy", energy: "low", tempo: [65, 80], key: "minor", instruments: ["glass synth", "sparse bells"], genre: "glacial ambient", weight: 2 },
    "💃": { mood: "sultry", energy: "high", tempo: [100, 118], key: "minor / latin", instruments: ["congas", "brass", "bass"], genre: "latin pop", weight: 3 },
    "👻": { mood: "eerie", energy: "medium", tempo: [70, 90], key: "minor / dissonant", instruments: ["detuned synth", "music box"], genre: "spooky ambient", weight: 3 },
    "🚀": { mood: "adventurous", energy: "very high", tempo: [130, 145], key: "major", instruments: ["arpeggiated synth", "driving drums"], genre: "space synthwave", weight: 3 },
    "🦋": { mood: "delicate", energy: "low-medium", tempo: [85, 100], key: "major / lydian", instruments: ["harp", "flute", "light strings"], genre: "whimsical orchestral", weight: 2 },
    "🌈": { mood: "hopeful", energy: "high", tempo: [105, 120], key: "major", instruments: ["marimba", "acoustic guitar", "claps"], genre: "feel-good indie pop", weight: 2 },
    "☕": { mood: "cozy", energy: "low-medium", tempo: [78, 92], key: "major", instruments: ["electric piano", "soft drums", "upright bass"], genre: "jazzy lo-fi", weight: 2 },
    "🌸": { mood: "gentle", energy: "low-medium", tempo: [80, 95], key: "major / modal", instruments: ["koto", "soft strings", "piano"], genre: "spring ambient", weight: 2 },
    "😌": { mood: "content", energy: "low", tempo: [70, 85], key: "major", instruments: ["acoustic guitar", "soft pads"], genre: "mellow chill", weight: 2 },
    "🎸": { mood: "rebellious", energy: "high", tempo: [118, 135], key: "minor / major", instruments: ["electric guitar", "bass", "drums"], genre: "indie rock", weight: 3 },
    "🕺": { mood: "groovy", energy: "high", tempo: [110, 124], key: "major", instruments: ["funk bass", "clav", "horns"], genre: "funk disco", weight: 3 },
    "❄️": { mood: "crisp", energy: "low", tempo: [60, 75], key: "major / modal", instruments: ["celesta", "strings", "soft bells"], genre: "winter ambient", weight: 2 },
    "🏆": { mood: "triumphant", energy: "very high", tempo: [120, 138], key: "major", instruments: ["brass", "orchestral strings", "drums"], genre: "cinematic anthem", weight: 4 },
    "💫": { mood: "ethereal", energy: "medium", tempo: [85, 105], key: "major / lydian", instruments: ["ambient pads", "celesta", "airy synth"], genre: "dream-pop", weight: 2 },
  };

  /* ------------------------------------------------------------------
     2. State
     ------------------------------------------------------------------ */
  const state = {
    selected: [], // ordered array of emoji strings
    generating: false,
  };

  /* ------------------------------------------------------------------
     3. DOM refs
     ------------------------------------------------------------------ */
  const orbitEl = document.getElementById("orbit");
  const generateBtn = document.getElementById("generateBtn");
  const generateLabel = document.getElementById("generateLabel");
  const selectedChipsEl = document.getElementById("selectedChips");
  const clearBtn = document.getElementById("clearBtn");
  const readoutEl = document.getElementById("readout");
  const resultEl = document.getElementById("result");
  const resultStatusEl = document.getElementById("resultStatus");
  const resultAudioEl = document.getElementById("resultAudio");
  const resultNoteEl = document.getElementById("resultNote");
  const apiStateEl = document.getElementById("apiState");

  const readoutFields = {
    mood: document.getElementById("rMood"),
    energy: document.getElementById("rEnergy"),
    tempo: document.getElementById("rTempo"),
    key: document.getElementById("rKey"),
    instruments: document.getElementById("rInstruments"),
    genre: document.getElementById("rGenre"),
    prompt: document.getElementById("rPrompt"),
  };

  /* ------------------------------------------------------------------
     4. Build the emoji picker grid
     ------------------------------------------------------------------ */
  const TILE_COLORS = ["#ff2f8f", "#7c3aed", "#ff7a1a", "#d4ff3d", "#21e6c1", "#ffd23f"];

  function buildOrbit() {
    EMOJI_PALETTE.forEach((emoji, i) => {
      const tilt = (i % 2 === 0 ? 1 : -1) * (3 + (i % 3) * 2);
      const color = TILE_COLORS[i % TILE_COLORS.length];

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "picker__tile";
      btn.textContent = emoji;
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-label", `Toggle emoji ${emoji}`);
      btn.style.setProperty("--tilt", `${tilt}deg`);
      btn.style.setProperty("--bg-tile", color);
      btn.dataset.emoji = emoji;

      btn.addEventListener("click", () => toggleEmoji(emoji, btn));
      orbitEl.appendChild(btn);
    });
  }

  /* ------------------------------------------------------------------
     5. Selection handling
     ------------------------------------------------------------------ */
  function toggleEmoji(emoji, btn) {
    const idx = state.selected.indexOf(emoji);
    if (idx === -1) {
      state.selected.push(emoji);
      btn.setAttribute("aria-pressed", "true");
    } else {
      state.selected.splice(idx, 1);
      btn.setAttribute("aria-pressed", "false");
    }
    render();
  }

  function removeEmoji(emoji) {
    const idx = state.selected.indexOf(emoji);
    if (idx !== -1) state.selected.splice(idx, 1);
    const btn = orbitEl.querySelector(`[data-emoji="${cssEscape(emoji)}"]`);
    if (btn) btn.setAttribute("aria-pressed", "false");
    render();
  }

  function clearAll() {
    state.selected = [];
    orbitEl.querySelectorAll(".picker__tile").forEach((b) => b.setAttribute("aria-pressed", "false"));
    render();
  }

  function cssEscape(str) {
    return str.replace(/["\\]/g, "\\$&");
  }

  /* ------------------------------------------------------------------
     6. Semantic engine — combine selected emoji into one patch
     ------------------------------------------------------------------ */
  function computePatch(selected) {
    if (selected.length === 0) return null;

    const attrs = selected.map((e) => EMOJI_ATTRIBUTES[e]).filter(Boolean);
    if (attrs.length === 0) return null;

    // Weighted "loudest emotion wins" for mood/key/genre; numeric average for tempo.
    const strongest = attrs.reduce((a, b) => (b.weight > a.weight ? b : a));
    const tempoMin = Math.round(attrs.reduce((s, a) => s + a.tempo[0], 0) / attrs.length);
    const tempoMax = Math.round(attrs.reduce((s, a) => s + a.tempo[1], 0) / attrs.length);

    const instrumentSet = new Set();
    attrs.forEach((a) => a.instruments.forEach((i) => instrumentSet.add(i)));
    const instruments = Array.from(instrumentSet).slice(0, 5);

    const moods = Array.from(new Set(attrs.map((a) => a.mood)));
    const energyRank = { "very low": 0, "low": 1, "low-medium": 1.5, "medium": 2, "high": 3, "very high": 4 };
    const avgEnergy = attrs.reduce((s, a) => s + (energyRank[a.energy] ?? 2), 0) / attrs.length;
    const energyLabel = Object.keys(energyRank).find((k) => energyRank[k] === Math.round(avgEnergy * 2) / 2)
      || (avgEnergy < 1 ? "very low" : avgEnergy < 2 ? "low" : avgEnergy < 3 ? "medium" : avgEnergy < 4 ? "high" : "very high");

    const patch = {
      mood: moods.join(" + "),
      energy: energyLabel,
      tempo: `${tempoMin}–${tempoMax} BPM`,
      key: strongest.key,
      instruments,
      genre: strongest.genre,
    };

    patch.prompt = buildPrompt(patch, selected);
    return patch;
  }

  function buildPrompt(patch, selected) {
    const moodPhrase = patch.mood.split(" + ").join(", ");
    return `A ${patch.energy}-energy ${moodPhrase} ${patch.genre} composition, `
      + `around ${patch.tempo}, in a ${patch.key} tonality, featuring `
      + `${patch.instruments.join(", ")}, inspired by ${selected.join(" ")}.`;
  }

  /* ------------------------------------------------------------------
     7. Render
     ------------------------------------------------------------------ */
  function render() {
    renderChips();
    renderReadout();
    renderCoreState();
    resultEl.hidden = true;
  }

  function renderChips() {
    selectedChipsEl.innerHTML = "";
    if (state.selected.length === 0) {
      const p = document.createElement("span");
      p.className = "selected__placeholder";
      p.textContent = "no emoji selected yet";
      selectedChipsEl.appendChild(p);
      clearBtn.hidden = true;
      return;
    }

    clearBtn.hidden = false;
    state.selected.forEach((emoji) => {
      const chip = document.createElement("span");
      chip.className = "selected__chip";
      chip.innerHTML = `<span>${emoji}</span>`;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "selected__chip-remove";
      removeBtn.textContent = "✕";
      removeBtn.setAttribute("aria-label", `Remove ${emoji}`);
      removeBtn.addEventListener("click", () => removeEmoji(emoji));
      chip.appendChild(removeBtn);
      selectedChipsEl.appendChild(chip);
    });
  }

  function renderReadout() {
    const patch = computePatch(state.selected);
    if (!patch) {
      readoutEl.hidden = true;
      return;
    }
    readoutEl.hidden = false;
    readoutFields.mood.textContent = patch.mood;
    readoutFields.energy.textContent = patch.energy;
    readoutFields.tempo.textContent = patch.tempo;
    readoutFields.key.textContent = patch.key;
    readoutFields.instruments.textContent = patch.instruments.join(", ");
    readoutFields.genre.textContent = patch.genre;
    readoutFields.prompt.textContent = `"${patch.prompt}"`;
  }

  function renderCoreState() {
    generateBtn.disabled = state.selected.length === 0 || state.generating;
    generateBtn.classList.toggle("is-loading", state.generating);
    generateLabel.textContent = state.generating
      ? "cooking up your track…"
      : state.selected.length === 0
        ? "pick a mood first"
        : "generate";
  }

  /* ------------------------------------------------------------------
     8. FastAPI integration (placeholder)
     ------------------------------------------------------------------
     Real backend contract (from EmojiMuse_Project_Overview.md, §10):

       POST {API_BASE_URL}/generate
       Request:  { "emoji": "🌧️💔🌙" }
       Response: {
         "status": "success",
         "prompt": "A slow melancholic cinematic piano composition...",
         "audio_url": "/audio/generated_001.wav"
       }
  ------------------------------------------------------------------ */
  async function generateMusic(selectedEmoji, patch) {
    const emojiString = selectedEmoji.join("");

    if (CONFIG.USE_MOCK_BACKEND) {
      // TODO: remove this branch once a real FastAPI server is reachable.
      return mockGenerate(emojiString, patch);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.GENERATE_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji: emojiString }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Server responded ${res.status}`);
      }

      const data = await res.json();
      // Expected shape: { status, prompt, audio_url }
      return {
        status: data.status || "success",
        prompt: data.prompt || patch.prompt,
        audioUrl: resolveAudioUrl(data.audio_url),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  function resolveAudioUrl(audioUrl) {
    if (!audioUrl) return null;
    if (/^https?:\/\//i.test(audioUrl)) return audioUrl;
    return `${CONFIG.API_BASE_URL}${audioUrl}`;
  }

  // Simulated response so the UI is fully demoable without a live backend.
  function mockGenerate(emojiString, patch) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          status: "mock",
          prompt: patch.prompt,
          audioUrl: null, // no real audio file in mock mode
        });
      }, 1800);
    });
  }

  /* ------------------------------------------------------------------
     9. Generate flow
     ------------------------------------------------------------------ */
  async function handleGenerate() {
    if (state.selected.length === 0 || state.generating) return;

    const patch = computePatch(state.selected);
    if (!patch) return;

    state.generating = true;
    renderCoreState();

    resultEl.hidden = false;
    resultAudioEl.hidden = true;
    resultStatusEl.textContent = "◍ Composing your track…";
    resultNoteEl.textContent = "";

    try {
      const outcome = await generateMusic(state.selected, patch);

      if (outcome.status === "mock") {
        resultStatusEl.textContent = "◍ Prompt ready — backend not connected yet";
        resultNoteEl.textContent =
          "This is a simulated response. Set CONFIG.USE_MOCK_BACKEND = false and "
          + "CONFIG.API_BASE_URL to your FastAPI endpoint in script.js to hear real audio here.";
      } else if (outcome.audioUrl) {
        resultStatusEl.textContent = "◍ Track ready";
        resultAudioEl.src = outcome.audioUrl;
        resultAudioEl.hidden = false;
        resultNoteEl.textContent = "";
      } else {
        resultStatusEl.textContent = "◍ Prompt generated — no audio URL returned";
        resultNoteEl.textContent = "";
      }
    } catch (err) {
      resultStatusEl.textContent = "◍ Generation failed";
      resultNoteEl.textContent = `Could not reach the backend: ${err.message}. Check CONFIG.API_BASE_URL in script.js.`;
    } finally {
      state.generating = false;
      renderCoreState();
    }
  }

  /* ------------------------------------------------------------------
     10. Init
     ------------------------------------------------------------------ */
  function init() {
    buildOrbit();
    render();
    generateBtn.addEventListener("click", handleGenerate);
    clearBtn.addEventListener("click", clearAll);
    apiStateEl.textContent = CONFIG.USE_MOCK_BACKEND
      ? "backend not connected (mock mode)"
      : `backend: ${CONFIG.API_BASE_URL}`;
    apiStateEl.dataset.connected = String(!CONFIG.USE_MOCK_BACKEND);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
