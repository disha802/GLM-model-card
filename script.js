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
    API_BASE_URL: "https://YOUR-FASTAPI-ENDPOINT.example.com", // TODO: replace
    GENERATE_PATH: "/generate",
    REQUEST_TIMEOUT_MS: 60000,
    USE_MOCK_BACKEND: true, // Set to false when pointing at a live FastAPI server
  };

  /* ------------------------------------------------------------------
     1. Emoji palette + semantic mapping
     ------------------------------------------------------------------ */
  const EMOJI_PALETTE = [
    "😊", "🔥", "🌧️", "💔", "🌙", "❤️", "☀️", "🌊",
    "⚡", "🍂", "✨", "😢", "🌻", "🖤", "🎉", "🕯️",
    "😡", "😴", "🥶", "💃", "👻", "🚀", "🦋", "🌈",
    "☕", "🌸", "😌", "🎸", "🕺", "❄️", "🏆", "💫",
  ];

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
  function buildPalette() {
    EMOJI_PALETTE.forEach((emoji) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = emoji;
      chip.dataset.emoji = emoji;
      chip.setAttribute("aria-pressed", "false");
      chip.setAttribute("aria-label", `Toggle ${EMOJI_ATTRIBUTES[emoji].mood}`);
      chip.addEventListener("click", () => toggleEmoji(emoji));
      trayChipsEl.appendChild(chip);
    });
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
      state.hue = STATION_HUE[primaryEmoji] ?? 38;
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

    const attrs = selected.map((e) => EMOJI_ATTRIBUTES[e]).filter(Boolean);
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

    generateBtn.disabled = false;
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

  function setLamp(stateName, text) {
    lampEl.dataset.state = stateName;
    lampTextEl.textContent = text;
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
      const source = audioCtx.createMediaElementSource(audioEl);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      dataArray = new Uint8Array(analyser.frequencyBinCount);
    } catch(e) {
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

    let freqData = [];
    if (analyser && state.playing) {
      try {
        analyser.getByteFrequencyData(dataArray);
        freqData = Array.from(dataArray);
      } catch(e) { freqData = []; }
    }

    const bars = 64;
    const hue = state.hue;

    ctx.save();
    ctx.translate(cx, cy);
    rotation += state.playing ? 0.005 : 0.002;
    ctx.rotate(rotation);

    for (let i = 0; i < bars; i++) {
      const angle = (i / bars) * Math.PI * 2;
      let val = 0;

      if (state.playing) {
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
      ctx.strokeStyle = `hsla(${hue}, 82%, 73%, ${state.playing ? 0.5 : 0.2})`;
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------
     9. AI Backend Generation Pipeline
     ------------------------------------------------------------------ */
  async function generateMusic(selectedEmoji, patch) {
    const emojiString = selectedEmoji.join("");

    if (CONFIG.USE_MOCK_BACKEND) {
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
          "Simulated soundscape compiled successfully (mock mode). Set CONFIG.USE_MOCK_BACKEND = false in Script.js to link a real API.";
        deckStatusEl.textContent = "silent track";
      } else if (outcome.audioUrl) {
        audioEl.src = outcome.audioUrl;
        deckStatusEl.textContent = "ready to play";
      } else {
        noteEl.textContent = "Prompt built, but the API returned no audio target URL.";
        deckStatusEl.textContent = "empty";
      }
    } catch (err) {
      deckStatusEl.textContent = "connect error";
      noteEl.textContent = `Could not establish connection with API: ${err.message}. Check CONFIG.API_BASE_URL in Script.js.`;
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
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }

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

    tapePlayBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePlayback();
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

    apiStateEl.textContent = CONFIG.USE_MOCK_BACKEND
      ? "mock mode enabled"
      : CONFIG.API_BASE_URL;
    apiStateEl.dataset.connected = String(!CONFIG.USE_MOCK_BACKEND);

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
