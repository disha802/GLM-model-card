/* ==========================================================================
   EmojiMuse — Aura Soundscape Redesign
   Logic: Dynamic emoji blending, color shifting, Canvas-based radial visualizer,
   progress timeline scrubbing, and backend API integration.
   ========================================================================== */

(() => {
  "use strict";

  /* ------------------------------------------------------------------
     0. CONFIG — swap API_BASE_URL for your real Colab/ngrok/production
     ------------------------------------------------------------------ */
  const CONFIG = {
    // Fallback only. A Cloudflare quick-tunnel URL changes every time the
    // Colab notebook restarts, so prefer the ?api= / localStorage overrides
    // below instead of editing this line each session.
    API_BASE_URL: "https://YOUR-FASTAPI-ENDPOINT.example.com",
    GENERATE_PATH: "/generate",
    // Clip length in seconds, sent as `duration` in the POST body. The API
    // clamps this to EMOJIMUSE_MAX_DURATION (30) and falls back to its own
    // EMOJIMUSE_DEFAULT_DURATION when omitted. MusicGen renders 50 tokens
    // per second, so 10s = 500 tokens.
    CLIP_SECONDS: 10,
    // MusicGen-small on a Colab T4 needs ~30-60s for 10s of audio, and the
    // notebook is slower still on its first (cold) request.
    REQUEST_TIMEOUT_MS: 180000,
    USE_MOCK_BACKEND: true,
  };

  const PLACEHOLDER_HOST = "YOUR-FASTAPI-ENDPOINT.example.com";
  const API_STORAGE_KEY = "emojiMuse-apiBase";

  /**
   * Resolve the backend URL, most specific source first:
   *   1. ?api=https://xyz.trycloudflare.com in the page URL (also persisted)
   *   2. whatever was saved to localStorage by a previous ?api= visit
   *   3. CONFIG.API_BASE_URL
   * Trailing slashes are stripped so `${base}${path}` never doubles up.
   */
  function resolveApiBase() {
    let base = null;
    try {
      const fromQuery = new URLSearchParams(location.search).get("api");
      if (fromQuery) {
        base = fromQuery;
        localStorage.setItem(API_STORAGE_KEY, fromQuery);
      } else {
        base = localStorage.getItem(API_STORAGE_KEY);
      }
    } catch (e) {
      // file:// or blocked storage — fall through to CONFIG
    }
    return String(base || CONFIG.API_BASE_URL).replace(/\/+$/, "");
  }

  // Mutable so the settings dialog can repoint the backend without a reload.
  let API_BASE = resolveApiBase();
  let USE_MOCK = CONFIG.USE_MOCK_BACKEND && API_BASE.includes(PLACEHOLDER_HOST);

  /** Point the app at `url` (empty string = disconnect back to mock mode). */
  function setApiBase(url) {
    const clean = String(url || "").trim().replace(/\/+$/, "");
    API_BASE = clean || CONFIG.API_BASE_URL;
    USE_MOCK = CONFIG.USE_MOCK_BACKEND && API_BASE.includes(PLACEHOLDER_HOST);
    try {
      if (clean) localStorage.setItem(API_STORAGE_KEY, clean);
      else localStorage.removeItem(API_STORAGE_KEY);
    } catch (e) {
      // storage unavailable (file://, private mode) — session-only is fine
    }
    renderApiState();
  }

  function renderApiState() {
    apiStateEl.textContent = USE_MOCK
      ? "mock mode — click ⚙ to connect"
      : API_BASE.replace(/^https?:\/\//, "");
    apiStateEl.dataset.connected = String(!USE_MOCK);
    apiStateEl.title = USE_MOCK ? "No backend configured" : API_BASE;
    const gear = document.getElementById("settingsBtn");
    if (gear) gear.dataset.connected = String(!USE_MOCK);
  }

  /* ------------------------------------------------------------------
     1. Emoji palette + semantic mapping
     ------------------------------------------------------------------ */
  // The palette is laid out one mood family per row, so the grid reads as a
  // spectrum (bright at the top, melancholy below it, and so on) instead of
  // an arbitrary 8-wide block.
  const EMOJI_GROUPS = [
    { id: "bright",  label: "Bright",   emoji: ["😊", "☀️", "🌻", "🎉", "🌈", "🏆"] },
    { id: "sad",     label: "Sad",      emoji: ["😢", "💔", "🌧️", "🖤"] },
    { id: "calm",    label: "Calm",     emoji: ["🌙", "🌊", "😌", "☕", "🕯️", "😴"] },
    { id: "intense", label: "Intense",  emoji: ["🔥", "⚡", "😡", "🎸", "🕺", "🚀"] },
    { id: "warm",    label: "Warm",     emoji: ["❤️", "🌸", "🦋", "💃"] },
    { id: "mystic",  label: "Mystic",   emoji: ["✨", "💫", "👻", "❄️", "🥶", "🍂"] },
  ];

  // Flat view, kept for anything that just wants "every built-in emoji".
  const EMOJI_PALETTE = EMOJI_GROUPS.reduce((all, g) => all.concat(g.emoji), []);

  // Human-readable names, shown on hover next to the mood word.
  const EMOJI_NAMES = {
    "😊": "Smiling face",   "☀️": "Sun",            "🌻": "Sunflower",     "🎉": "Party popper",
    "🌈": "Rainbow",        "🏆": "Trophy",         "😢": "Crying face",   "💔": "Broken heart",
    "🌧️": "Rain cloud",     "🖤": "Black heart",    "🌙": "Crescent moon", "🌊": "Wave",
    "😌": "Relieved face",  "☕": "Coffee",          "🕯️": "Candle",        "😴": "Sleeping face",
    "🔥": "Fire",           "⚡": "High voltage",    "😡": "Enraged face",  "🎸": "Guitar",
    "🕺": "Dancing man",    "🚀": "Rocket",         "❤️": "Red heart",     "🌸": "Cherry blossom",
    "🦋": "Butterfly",      "💃": "Dancing woman",  "✨": "Sparkles",      "💫": "Dizzy",
    "👻": "Ghost",          "❄️": "Snowflake",      "🥶": "Cold face",     "🍂": "Fallen leaves",
  };

  // Any emoji the user adds by hand falls back to this neutral profile, which
  // mirrors the backend's `_FALLBACK` in app/semantics.py.
  const FALLBACK_ATTRS = {
    mood: "neutral", energy: "medium", tempo: [88, 104], key: "modal",
    instruments: ["piano", "pads"], genre: "downtempo", weight: 1,
  };

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

  const STATION_HUE = {
    "😊": 44,  "🔥": 8,   "🌧️": 205, "💔": 268, "🌙": 228, "❤️": 348, "☀️": 40,  "🌊": 189,
    "⚡": 52,  "🍂": 26,  "✨": 280, "😢": 216, "🌻": 48,  "🖤": 250, "🎉": 320, "🕯️": 32,
    "😡": 0,   "😴": 232, "🥶": 196, "💃": 332, "👻": 152, "🚀": 258, "🦋": 176, "🌈": 300,
    "☕": 28,  "🌸": 336, "😌": 168, "🎸": 14,  "🕺": 288, "❄️": 192, "🏆": 46,  "💫": 244,
  };

  /* ------------------------------------------------------------------
     2. State
     ------------------------------------------------------------------ */
  const state = {
    selection: [],
    custom: [],   // emoji added by hand via the picker
    generating: false,
    tape: null, // Holds details of generated track
    playing: false,
    hue: 260, // Default neutral violet tone
  };

  /* ------------------------------------------------------------------
     3. DOM Elements
     ------------------------------------------------------------------ */
  const root = document.documentElement;
  const roomEl = document.querySelector(".room");

  const trayChipsEl = document.getElementById("trayChips");
  const clearBtn = document.getElementById("clearBtn");

  const lampEl = document.getElementById("lamp");
  const lampTextEl = document.getElementById("lampText");

  const generateBtn = document.getElementById("generateBtn");
  const generateLabel = document.getElementById("generateLabel");

  const playerDeckEl = document.getElementById("playerDeck");
  const deckStatusEl = document.getElementById("deckStatus");
  const progressFillEl = document.getElementById("progressFill");
  const progressBarEl = document.querySelector(".progress-bar");

  const tapeTitleEl = document.getElementById("tapeTitle");
  const tapeMetaEl = document.getElementById("tapeMeta");
  const tapeCounterEl = document.getElementById("tapeCounter");
  const tapePlayBtn = document.getElementById("tapePlay");
  const tapeDownloadBtn = document.getElementById("tapeDownload");
  const sleeveCardEl = document.getElementById("sleeveCard");

  const audioEl = document.getElementById("resultAudio");
  const noteEl = document.getElementById("resultNote");
  const apiStateEl = document.getElementById("apiState");

  const vinylDiscEl = document.getElementById("vinylDisc");
  const vinylEmojiEl = document.getElementById("vinylEmoji");

  const display = {
    emoji: document.getElementById("dEmoji"),
    mood: document.getElementById("dMood"),
    energy: document.getElementById("dEnergy"),
    tempo: document.getElementById("dTempo"),
    key: document.getElementById("dKey"),
    instruments: document.getElementById("dInstruments"),
    genre: document.getElementById("dGenre"),
    prompt: document.getElementById("dPrompt"),
  };

  /* ------------------------------------------------------------------
     4. Build Blending Badges Grid
     ------------------------------------------------------------------ */
  /** Curated profile if we know the emoji, neutral fallback otherwise. */
  function attributesFor(emoji) {
    return EMOJI_ATTRIBUTES[emoji] || FALLBACK_ATTRS;
  }

  /** "Sunflower · uplifting" — what the hover tooltip shows. */
  function labelFor(emoji) {
    const name = EMOJI_NAMES[emoji];
    const mood = attributesFor(emoji).mood;
    return name ? `${name} · ${mood}` : `Custom · ${mood}`;
  }

  function makeChip(emoji) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = emoji;
    chip.dataset.emoji = emoji;
    chip.dataset.name = labelFor(emoji);       // drives the CSS tooltip
    chip.setAttribute("aria-pressed", "false");
    chip.setAttribute("aria-label", labelFor(emoji));
    if (!EMOJI_ATTRIBUTES[emoji]) chip.dataset.custom = "true";
    chip.addEventListener("click", () => toggleEmoji(emoji));
    return chip;
  }

  /** One row per mood family, plus a trailing row for user-added emoji. */
  function buildPalette() {
    trayChipsEl.innerHTML = "";

    EMOJI_GROUPS.forEach((group) => {
      const row = document.createElement("div");
      row.className = "emoji-row";
      row.dataset.group = group.id;

      const label = document.createElement("span");
      label.className = "emoji-row__label";
      label.textContent = group.label;
      row.appendChild(label);

      const chips = document.createElement("div");
      chips.className = "emoji-row__chips";
      group.emoji.forEach((e) => chips.appendChild(makeChip(e)));
      row.appendChild(chips);

      trayChipsEl.appendChild(row);
    });

    renderCustomRow();
  }

  /** The "Yours" row only exists once the user has added something. */
  function renderCustomRow() {
    const existing = trayChipsEl.querySelector('[data-group="custom"]');
    if (existing) existing.remove();
    if (state.custom.length === 0) return;

    const row = document.createElement("div");
    row.className = "emoji-row";
    row.dataset.group = "custom";

    const label = document.createElement("span");
    label.className = "emoji-row__label";
    label.textContent = "Yours";
    row.appendChild(label);

    const chips = document.createElement("div");
    chips.className = "emoji-row__chips";
    state.custom.forEach((e) => chips.appendChild(makeChip(e)));
    row.appendChild(chips);

    trayChipsEl.appendChild(row);
  }

  /**
   * Add arbitrary emoji typed into the picker. Splits on grapheme clusters
   * so ZWJ sequences and skin-tone modifiers survive intact, matching the
   * backend's `split_emoji()`.
   */
  function addCustomEmoji(raw) {
    const clusters = typeof Intl !== "undefined" && Intl.Segmenter
      ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(raw), (s) => s.segment)
      : Array.from(raw);

    const added = [];
    clusters.forEach((c) => {
      const e = c.trim();
      // skip whitespace and plain ASCII, same rule the backend applies
      if (!e || !Array.from(e).some((ch) => ch.codePointAt(0) > 0x2000)) return;
      if (EMOJI_PALETTE.includes(e) || state.custom.includes(e)) return;
      state.custom.push(e);
      added.push(e);
    });

    if (added.length) {
      renderCustomRow();
      added.forEach((e) => {
        if (!state.selection.includes(e)) state.selection.push(e);
      });
      if (state.selection.length && !state.hue) state.hue = 260;
      render();
    }
    return added;
  }

  /* ------------------------------------------------------------------
     5. Handle Selections
     ------------------------------------------------------------------ */
  function toggleEmoji(emoji) {
    const index = state.selection.indexOf(emoji);
    if (index === -1) {
      state.selection.push(emoji);
    } else {
      state.selection.splice(index, 1);
    }
    
    // Set active dynamic hue based on first selected emoji
    if (state.selection.length > 0) {
      const primaryEmoji = state.selection[0];
      state.hue = STATION_HUE[primaryEmoji] ?? 260;
    } else {
      state.hue = 260; // Neutral hue
    }

    render();
  }

  function clearSelection() {
    state.selection = [];
    state.hue = 260;
    render();
  }

  /* ------------------------------------------------------------------
     6. Combined Emoji Logic (Semantic Blend)
     ------------------------------------------------------------------ */
  function computePatch(selected) {
    if (selected.length === 0) return null;

    const attrs = selected.map(attributesFor);
    if (attrs.length === 0) return null;

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
     7. Render Board Status
     ------------------------------------------------------------------ */
  function render() {
    const patch = computePatch(state.selection);
    if (!patch) {
      // Empty selection placeholder state
      root.style.setProperty("--hue", "260");

      trayChipsEl.querySelectorAll(".chip").forEach((chip) => {
        chip.setAttribute("aria-pressed", "false");
        chip.removeAttribute("data-tuned");
      });

      clearBtn.hidden = true;
      generateBtn.disabled = true;

      display.emoji.textContent = "";
      display.mood.textContent = "none";
      display.energy.textContent = "—";
      display.tempo.textContent = "—";
      display.key.textContent = "—";
      display.instruments.textContent = "—";
      display.genre.textContent = "—";
      display.prompt.textContent = "Select one or more emojis from the grid to begin brewing your soundscape.";

      const orbEmojiEl = document.getElementById("dEmoji");
      orbEmojiEl.textContent = "✨";
      orbEmojiEl.style.opacity = "0.4";

      vinylDiscEl.hidden = true;
      display.emoji.hidden = false;

      if (!state.generating) setLamp("tuned", "ready");
      return;
    }

    // Stay disabled while a generation is in flight — render() runs during
    // handleGenerate(), so an unconditional re-enable would make the button
    // look clickable mid-brew.
    generateBtn.disabled = state.generating;
    const orbEmojiEl = document.getElementById("dEmoji");
    orbEmojiEl.style.opacity = "1";

    // Apply color values to CSS variables
    root.style.setProperty("--hue", state.hue);

    // Toggle grid badges active styling
    trayChipsEl.querySelectorAll(".chip").forEach((chip) => {
      const e = chip.dataset.emoji;
      const isSelected = state.selection.includes(e);
      chip.setAttribute("aria-pressed", String(isSelected));
      chip.dataset.tuned = String(isSelected && state.selection[0] === e);
    });

    clearBtn.hidden = state.selection.length <= 1;

    // Update specs view
    display.emoji.textContent = state.selection.join(" ");
    display.mood.textContent = patch.mood;
    display.energy.textContent = patch.energy;
    display.tempo.textContent = patch.tempo;
    display.key.textContent = patch.key;
    display.instruments.textContent = patch.instruments.join(", ");
    display.genre.textContent = patch.genre;
    display.prompt.textContent = patch.prompt;

    // Update center emoji
    vinylEmojiEl.textContent = state.selection[0];

    // Toggle display elements based on generation presence
    if (state.tape) {
      playerDeckEl.hidden = false;
      vinylDiscEl.hidden = false;
      display.emoji.hidden = true;
    } else {
      vinylDiscEl.hidden = true;
      display.emoji.hidden = false;
    }

    if (!state.generating) setLamp("tuned", "ready");
  }

  // The Aura layout has no status lamp; the FM layout did. Guard both so
  // either markup works without the caller having to care.
  function setLamp(stateName, text) {
    if (lampEl) lampEl.dataset.state = stateName;
    if (lampTextEl) lampTextEl.textContent = text;
  }

  /* ------------------------------------------------------------------
     8. Canvas-based Radial visualizer
     ------------------------------------------------------------------ */
  let audioCtx = null;
  let analyser = null;
  let dataArray = null;

  function initAudioCtx() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.82;
      // NOTE: this taps the <audio> element, so a cross-origin WAV must be
      // requested with crossOrigin="anonymous" and served with
      // Access-Control-Allow-Origin or the graph outputs silence.
      const source = audioCtx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      dataArray = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) {
      console.warn("Web Audio API not fully initialized (possibly CORS/autoplay block):", e);
    }
  }

  const canvas = document.getElementById("visualizer");
  const ctx = canvas.getContext("2d");
  let rotation = 0;

  function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);
    
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const baseRadius = 88; // Radial offset surrounding the orb

    const live = state.playing;

    let freqData = [];
    if (analyser && live) {
      try {
        analyser.getByteFrequencyData(dataArray);
        freqData = Array.from(dataArray);
      } catch(e) { freqData = []; }
    }

    const bars = 64;
    const hue = state.hue;

    ctx.save();
    ctx.translate(cx, cy);
    rotation += live ? 0.005 : 0.002;
    ctx.rotate(rotation);

    for (let i = 0; i < bars; i++) {
      const angle = (i / bars) * Math.PI * 2;
      let val = 0;

      if (live) {
        if (freqData.length > 0) {
          // Real Web Audio Data mapping
          val = freqData[i % freqData.length] / 3.2;
        } else {
          // Procedural waves fallback
          const time = Date.now() * 0.004;
          val = 14 + Math.sin(i * 0.45 + time) * 12 + Math.cos(i * 0.25 - time * 0.5) * 6;
        }
      } else if (state.generating) {
        // Loading animation sweep
        const time = Date.now() * 0.007;
        val = 8 + Math.sin(i * 0.3 + time) * 6;
      } else {
        // Soft idle breathing
        const time = Date.now() * 0.0012;
        val = 3 + Math.sin(i * 0.15 + time) * 2;
      }

      const rStart = baseRadius + 4;
      const rEnd = baseRadius + 4 + val;

      const x1 = Math.cos(angle) * rStart;
      const y1 = Math.sin(angle) * rStart;
      const x2 = Math.cos(angle) * rEnd;
      const y2 = Math.sin(angle) * rEnd;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.strokeStyle = `hsla(${hue}, 82%, 73%, ${live ? 0.5 : 0.2})`;
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------
     9. AI Backend Generation Pipeline
     ------------------------------------------------------------------ */
  async function generateMusic(selectedEmoji, patch) {
    const emojiString = selectedEmoji.join("");

    if (USE_MOCK) {
      return mockGenerate(emojiString, patch);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${API_BASE}${CONFIG.GENERATE_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji: emojiString, duration: CONFIG.CLIP_SECONDS }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Server responded ${res.status}`);
      }

      const data = await res.json();
      return {
        status: data.status || "success",
        prompt: data.prompt || patch.prompt,
        audioUrl: resolveAudioUrl(data.audio_url),
        // { sample_rate, seconds, render_seconds } — what the server believes
        // it rendered, which is worth comparing against the <audio> duration.
        meta: data.meta || null,
      };
    } catch (err) {
      // fetch() reports CORS failures and DNS/tunnel failures identically as
      // a bare "Failed to fetch", so name the likely causes for the user.
      if (err.name === "AbortError") {
        throw new Error(`timed out after ${CONFIG.REQUEST_TIMEOUT_MS / 1000}s`);
      }
      if (err instanceof TypeError) {
        throw new Error(
          "could not reach the server — the tunnel may be down, or the API is missing CORS headers"
        );
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  function resolveAudioUrl(audioUrl) {
    if (!audioUrl) return null;
    if (/^https?:\/\//i.test(audioUrl)) return audioUrl;
    return `${API_BASE}${audioUrl.startsWith("/") ? "" : "/"}${audioUrl}`;
  }

  function mockGenerate(emojiString, patch) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          status: "mock",
          prompt: patch.prompt,
          audioUrl: null,
        });
      }, 2000);
    });
  }

  /* ------------------------------------------------------------------
     9b. Backend settings dialog
     ------------------------------------------------------------------
     Lets the Colab/Cloudflare URL be pasted at runtime instead of edited
     into this file, because the quick-tunnel hostname changes on every
     notebook restart.
     ------------------------------------------------------------------ */
  function initRigDialog() {
    const dlg = document.getElementById("rigDialog");
    const btn = document.getElementById("settingsBtn");
    if (!dlg || !btn) return;

    const urlEl = document.getElementById("rigUrl");
    const durEl = document.getElementById("rigDuration");
    const statusEl = document.getElementById("rigStatus");

    const setStatus = (text, state) => {
      statusEl.textContent = text;
      statusEl.dataset.state = state || "idle";
    };

    function openDialog() {
      urlEl.value = USE_MOCK ? "" : API_BASE;
      durEl.value = String(CONFIG.CLIP_SECONDS);
      setStatus(
        USE_MOCK
          ? "Not connected — running in mock mode."
          : `Configured: ${API_BASE}`,
        USE_MOCK ? "idle" : "ok"
      );
      if (typeof dlg.showModal === "function") dlg.showModal();
      else dlg.setAttribute("open", "");   // very old browsers
      urlEl.focus();
    }

    function closeDialog() {
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    }

    /** GET {url}/health — proves the tunnel is up AND that CORS is working. */
    async function testConnection(url) {
      if (!url) { setStatus("Enter a URL first.", "error"); return false; }
      setStatus("Contacting the backend…", "busy");
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(`${url.replace(/\/+$/, "")}/health`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`server responded ${res.status}`);
        const h = await res.json();
        const loaded = h.model_loaded ? "model loaded" : "model still loading";
        setStatus(
          `Connected · ${h.model || "musicgen"} on ${h.device || "?"} · ${loaded}`,
          "ok"
        );
        return true;
      } catch (err) {
        if (err.name === "AbortError") {
          setStatus("Timed out. Is the Colab cell still running?", "error");
        } else {
          setStatus(
            "Could not reach it. Check the URL is exact (https://…), that the "
            + "Colab server cell is still running, and that the notebook wasn't disconnected.",
            "error"
          );
        }
        return false;
      } finally {
        clearTimeout(t);
      }
    }

    btn.addEventListener("click", openDialog);
    document.getElementById("rigClose").addEventListener("click", closeDialog);

    document.getElementById("rigTest").addEventListener("click", () => {
      testConnection(urlEl.value.trim());
    });

    document.getElementById("rigSave").addEventListener("click", async () => {
      const url = urlEl.value.trim();
      CONFIG.CLIP_SECONDS = Number(durEl.value) || 10;
      if (!url) { setApiBase(""); setStatus("Disconnected — mock mode.", "idle"); return; }
      setApiBase(url);
      const ok = await testConnection(url);
      if (ok) setTimeout(closeDialog, 700);
    });

    document.getElementById("rigForget").addEventListener("click", () => {
      urlEl.value = "";
      setApiBase("");
      setStatus("Disconnected — mock mode.", "idle");
    });

    // Surface the dialog immediately if there is nothing configured yet.
    if (USE_MOCK && !new URLSearchParams(location.search).has("api")) {
      setStatus("Not connected — running in mock mode.", "idle");
    }
  }

  /* ------------------------------------------------------------------
     9c. Download the rendered track
     ------------------------------------------------------------------
     The `download` attribute is ignored on cross-origin hrefs, so a plain
     link to the tunnel would just navigate to the WAV instead of saving it.
     Fetching it as a Blob first (the API sends Access-Control-Allow-Origin)
     lets us save it locally under a meaningful filename.
     ------------------------------------------------------------------ */
  function trackFilename() {
    const mood = (state.tape && state.tape.mood ? state.tape.mood : "soundscape")
      .toLowerCase()
      .replace(/\s*\+\s*/g, "-")     // "dreamy + magical" -> "dreamy-magical"
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return `emojimuse-${mood || "soundscape"}.wav`;
  }

  async function downloadTrack() {
    if (!state.tape || !state.tape.audioUrl) return;

    const original = tapeDownloadBtn.textContent;
    tapeDownloadBtn.disabled = true;
    tapeDownloadBtn.textContent = "…";

    let objectUrl = null;
    try {
      const res = await fetch(state.tape.audioUrl);
      if (!res.ok) throw new Error(`server responded ${res.status}`);
      const blob = await res.blob();

      objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = trackFilename();
      document.body.appendChild(a);
      a.click();
      a.remove();

      deckStatusEl.textContent = "downloaded";
    } catch (err) {
      noteEl.textContent =
        `Could not download the track: ${err.message}. The Colab session may have `
        + "disconnected, or the file was swept (audio is kept for 120 minutes).";
    } finally {
      // revoke on the next tick so the browser has started the save
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
      tapeDownloadBtn.disabled = false;
      tapeDownloadBtn.textContent = original;
    }
  }

  /* ------------------------------------------------------------------
     10. Interaction Trigger Handlers
     ------------------------------------------------------------------ */
  async function handleGenerate() {
    if (state.generating) return;

    const patch = computePatch(state.selection);
    if (!patch) return;

    state.generating = true;
    generateBtn.disabled = true;
    generateLabel.textContent = "Brewing Vibe…";
    setLamp("recording", "brewing");
    noteEl.textContent = "";

    stopPlayback();
    state.tape = null;
    tapeDownloadBtn.hidden = true;
    render();

    try {
      const outcome = await generateMusic(state.selection, patch);

      state.tape = {
        mood: patch.mood,
        tempo: patch.tempo,
        prompt: outcome.prompt,
        audioUrl: outcome.audioUrl,
      };

      deckStatusEl.textContent = "track loaded";
      tapeTitleEl.textContent = `${patch.mood} soundscape`;
      tapeMetaEl.textContent = `AURA MIX · ${patch.tempo}`;
      progressFillEl.style.width = "0%";
      tapeCounterEl.textContent = "0:00";

      if (outcome.status === "mock") {
        noteEl.textContent =
          "Simulated soundscape compiled (mock mode) — no audio was rendered. "
          + "Click ⚙ in the header and paste your Colab tunnel URL to generate real music.";
        deckStatusEl.textContent = "silent track";
      } else if (outcome.audioUrl) {
        // The visualiser taps this element via createMediaElementSource, so a
        // cross-origin file fetched WITHOUT CORS taints the stream and plays as
        // silence. Request it in CORS mode explicitly — the API must answer
        // with Access-Control-Allow-Origin for the audio to be audible.
        audioEl.crossOrigin = "anonymous";
        audioEl.src = outcome.audioUrl;
        audioEl.load();
        tapeDownloadBtn.hidden = false;
        deckStatusEl.textContent = "ready to play";

        if (outcome.meta) {
          const m = outcome.meta;
          tapeMetaEl.textContent =
            `${m.seconds}s · ${(m.sample_rate / 1000).toFixed(0)}kHz · rendered in ${m.render_seconds}s`;
          // A server that reports far less than we asked for means the clip
          // was truncated upstream — surface it instead of leaving it a mystery.
          if (m.seconds && m.seconds < CONFIG.CLIP_SECONDS * 0.5) {
            noteEl.textContent =
              `Server returned only ${m.seconds}s of audio for a ${CONFIG.CLIP_SECONDS}s request `
              + `— check max_new_tokens (should be duration × 50) in app/musicgen.py.`;
          }
        }
      } else {
        noteEl.textContent = "Prompt built, but the API returned no audio target URL.";
        deckStatusEl.textContent = "empty";
      }
    } catch (err) {
      deckStatusEl.textContent = "connect error";
      noteEl.textContent = `Backend error — ${err.message}. Currently pointing at: ${API_BASE}`;
    } finally {
      state.generating = false;
      generateBtn.disabled = false;
      generateLabel.textContent = "Brew Soundscape";
      setLamp("tuned", "ready");
      render();
    }
  }

  /* ------------------------------------------------------------------
     11. Player Playback Actions
     ------------------------------------------------------------------ */
  function startPlayback() {
    if (!state.tape) return;
    state.playing = true;

    initAudioCtx();
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();

    tapePlayBtn.textContent = "❚❚";
    deckStatusEl.textContent = "playing";
    vinylDiscEl.classList.add("is-playing");

    if (state.tape.audioUrl) {
      audioEl.play().catch(() => {
        deckStatusEl.textContent = "blocked";
      });
    }
  }

  function stopPlayback() {
    state.playing = false;
    tapePlayBtn.textContent = "▶";
    vinylDiscEl.classList.remove("is-playing");
    if (state.tape) deckStatusEl.textContent = "paused";
    if (!audioEl.paused) audioEl.pause();
  }

  function togglePlayback() {
    if (state.playing) stopPlayback();
    else startPlayback();
  }

  /* ------------------------------------------------------------------
     12. Initializer
     ------------------------------------------------------------------ */
  function init() {
    buildPalette();

    generateBtn.addEventListener("click", handleGenerate);
    clearBtn.addEventListener("click", clearSelection);

    // --- free-form emoji entry ---
    const addBtn = document.getElementById("addEmojiBtn");
    const addPanel = document.getElementById("addEmojiPanel");
    const addInput = document.getElementById("addEmojiInput");
    const addGo = document.getElementById("addEmojiGo");
    const addHint = document.getElementById("addEmojiHint");
    const HINT_DEFAULT = addHint.innerHTML;

    function setHint(html, stateName) {
      addHint.innerHTML = html;
      if (stateName) addHint.dataset.state = stateName;
      else delete addHint.dataset.state;
    }

    addBtn.addEventListener("click", () => {
      const open = addPanel.hidden;
      addPanel.hidden = !open;
      addBtn.setAttribute("aria-expanded", String(open));
      if (open) addInput.focus();
      else setHint(HINT_DEFAULT, null);
    });

    function commitCustom() {
      const raw = addInput.value;
      if (!raw.trim()) return;
      const added = addCustomEmoji(raw);
      addInput.value = "";
      if (added.length) {
        setHint(
          `Added ${added.join(" ")} — unlisted emoji use a neutral profile.`,
          "ok"
        );
      } else {
        setHint("Nothing added — that emoji is already in the palette.", "error");
      }
      addInput.focus();
    }

    addGo.addEventListener("click", commitCustom);
    addInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commitCustom(); }
      if (e.key === "Escape") { addBtn.click(); addBtn.focus(); }
    });


    tapePlayBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePlayback();
    });

    tapeDownloadBtn.addEventListener("click", (e) => {
      e.stopPropagation();   // the whole sleeve is a play/pause target
      downloadTrack();
    });

    sleeveCardEl.addEventListener("click", togglePlayback);
    vinylDiscEl.addEventListener("click", togglePlayback);

    audioEl.addEventListener("ended", () => {
      stopPlayback();
      deckStatusEl.textContent = "finished";
      progressFillEl.style.width = "0%";
      tapeCounterEl.textContent = "0:00";
    });

    // Seek track by clicking progress timeline
    progressBarEl.addEventListener("click", (e) => {
      if (!audioEl.duration) return;
      const rect = progressBarEl.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      audioEl.currentTime = pct * audioEl.duration;
    });

    // Time update progress sync
    audioEl.addEventListener("timeupdate", () => {
      if (audioEl.duration) {
        const pct = (audioEl.currentTime / audioEl.duration) * 100;
        progressFillEl.style.width = `${pct}%`;

        const min = Math.floor(audioEl.currentTime / 60);
        const sec = Math.floor(audioEl.currentTime % 60);
        tapeCounterEl.textContent = `${min}:${sec.toString().padStart(2, "0")}`;
      }
    });

    renderApiState();
    initRigDialog();

    // A 404/CORS failure on the WAV itself is otherwise silent — surface it.
    audioEl.addEventListener("error", () => {
      if (!state.tape || !state.tape.audioUrl) return;
      stopPlayback();
      deckStatusEl.textContent = "audio failed";
      noteEl.textContent =
        `Could not load the audio file at ${state.tape.audioUrl} — check that the `
        + "endpoint serves the WAV and sends Access-Control-Allow-Origin.";
    });

    // --- Theme Toggle ---
    const themeToggleBtn = document.getElementById("themeToggle");

    // Restore saved preference
    const savedTheme = localStorage.getItem("emojiMuse-theme");
    if (savedTheme) document.body.dataset.theme = savedTheme;

    themeToggleBtn.addEventListener("click", () => {
      const isLight = document.body.dataset.theme === "light";
      const next = isLight ? "dark" : "light";
      document.body.dataset.theme = next;
      localStorage.setItem("emojiMuse-theme", next);
    });

    // Run background visualizer anim loop
    drawVisualizer();

    render();
  }

  document.addEventListener("DOMContentLoaded", init);

  if (roomEl) roomEl.setAttribute("data-ambient", "on");
})();
