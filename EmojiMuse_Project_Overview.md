# Emoji-to-Music: Project Overview

## 1. Project Title

**Emoji-to-Music: Emoji-Conditioned Generative Music Synthesis**

------------------------------------------------------------------------

## 2. Project Concept

Emoji-to-Music is an end-to-end Generative AI application that converts
one or more user-selected emojis into an original piece of music.

Instead of asking the user to describe a song using technical musical
terminology, the application uses emojis as an intuitive creative
interface.

For example:

-   `😊` → cheerful, bright, upbeat music
-   `🌧️` → calm, melancholic, atmospheric music
-   `🔥` → energetic, intense music
-   `🌙` → dreamy, nocturnal ambient music
-   `🌧️💔🌙` → slow, melancholic, intimate cinematic music

The system interprets the emotional and semantic meaning of the emoji
combination, converts it into a detailed music-generation prompt, and
uses a text-to-music Generative AI model to synthesize the final audio.

------------------------------------------------------------------------

## 3. Problem Statement

Traditional music-generation interfaces often require users to provide
textual descriptions such as:

> "Generate a slow melancholic piano composition with atmospheric
> strings."

Many users can express an emotion visually through emojis much more
easily than they can describe musical characteristics.

This project explores whether emojis can serve as a compact, intuitive
conditioning mechanism for generative music systems.

------------------------------------------------------------------------

## 4. Proposed Solution

The application introduces an **Emoji-to-Music Semantic Pipeline**:

``` text
User Emoji(s)
     ↓
Emoji Semantic Interpretation
     ↓
Emotion / Energy / Valence / Musical Attribute Mapping
     ↓
Music Prompt Generation
     ↓
MusicGen
     ↓
Generated Audio
     ↓
Frontend Audio Player
```

The key idea is that emojis are not directly fed into the music model.
Instead, they are transformed into meaningful musical attributes and
then into a natural-language prompt understood by the text-to-music
model.

------------------------------------------------------------------------

## 5. Core Generative AI Model

### Primary Model: Meta MusicGen

**Model:** `facebook/musicgen-small`

MusicGen is a text-to-music generative model developed by Meta's
AudioCraft team.

It can generate music from natural-language descriptions such as:

``` text
A warm acoustic guitar melody with soft piano,
upbeat percussion and a joyful summer atmosphere.
```

For this project, the generated prompt is dynamically constructed from
the user's emoji input.

### Why MusicGen Small?

The initial implementation is intended to run on a **Google Colab NVIDIA
T4 GPU with 16 GB VRAM**.

MusicGen Small is a practical starting point because:

-   It is significantly lighter than larger MusicGen variants.
-   It is suitable for experimentation on a Colab T4.
-   It provides sufficient quality for a student GenAI application.
-   It supports local inference rather than requiring a paid
    music-generation API.
-   It integrates naturally with Python and the AudioCraft ecosystem.

A larger MusicGen variant can be evaluated later if additional GPU
resources are available.

------------------------------------------------------------------------

## 6. Emoji Semantic Engine

The most important custom component of the project is the **Emoji
Semantic Engine**.

Instead of treating an emoji as a simple label, the system maps it to
multiple musical dimensions.

Example:

``` text
😊
│
├── Emotion: Joy
├── Valence: Positive
├── Energy: High
├── Tempo: 110–120 BPM
├── Tonality: Major
├── Instruments: Piano, acoustic guitar
├── Genre: Acoustic pop
└── Texture: Bright and warm
```

Another example:

``` text
🌧️💔🌙
│
├── Emotion: Melancholy
├── Valence: Negative
├── Energy: Low
├── Tempo: 60–75 BPM
├── Tonality: Minor / atmospheric
├── Instruments: Piano, soft strings, ambient pads
├── Genre: Cinematic ambient
└── Texture: Intimate, spacious, nocturnal
```

These attributes are then converted into a prompt for MusicGen.

------------------------------------------------------------------------

## 7. Example End-to-End Generation

### Input

``` text
🌧️💔🌙
```

### Semantic Interpretation

``` text
Mood: Melancholic
Energy: Low
Atmosphere: Nocturnal
Emotional theme: Heartbreak
Tempo: Slow
Instrumentation: Piano + soft strings + ambient pads
Style: Cinematic ambient
```

### Generated Music Prompt

``` text
A slow melancholic cinematic piano composition,
intimate and atmospheric, with soft strings,
sparse percussion, ambient pads and a nocturnal
texture, expressing loneliness and heartbreak.
```

### Output

``` text
🎵 Generated audio
```

The frontend provides an audio player so the user can immediately listen
to the generated composition.

------------------------------------------------------------------------

## 8. System Architecture

``` text
┌────────────────────────────────────────────┐
│                 FRONTEND                   │
│                                            │
│      Emoji Selector / Emoji Input          │
│                  │                         │
│             [Generate]                     │
└──────────────────┬─────────────────────────┘
                   │
                   │ HTTP POST
                   ▼
┌────────────────────────────────────────────┐
│                 FASTAPI                    │
│                  API                       │
│                                            │
│       POST /generate                       │
│                  │                         │
│                  ▼                         │
│        Emoji Semantic Engine               │
│                  │                         │
│                  ▼                         │
│          Prompt Generator                  │
│                  │                         │
│                  ▼                         │
│              MusicGen                      │
└──────────────────┬─────────────────────────┘
                   │
                   ▼
             Generated WAV
                   │
                   ▼
┌────────────────────────────────────────────┐
│                 FRONTEND                   │
│                                            │
│              Audio Player                 │
│                 ▶️                         │
└────────────────────────────────────────────┘
```

------------------------------------------------------------------------

## 9. Technology Stack

### AI / Machine Learning

-   Python
-   PyTorch
-   Meta AudioCraft
-   MusicGen Small
-   CUDA

### Backend

-   FastAPI
-   Uvicorn
-   Python

### Frontend

A basic implementation can use:

-   HTML
-   CSS
-   JavaScript

Alternatively, the first prototype can use Streamlit for rapid
development.

### Development Environment

-   Google Colab
-   NVIDIA T4 GPU
-   16 GB GPU VRAM

### API Exposure

For the prototype, the FastAPI server can be exposed from Colab using a
tunneling solution such as:

-   ngrok
-   Cloudflare Tunnel

------------------------------------------------------------------------

## 10. API Design

### Endpoint

``` http
POST /generate
```

### Request

``` json
{
  "emoji": "🌧️💔🌙"
}
```

### Processing

``` text
Emoji
 ↓
Semantic mapping
 ↓
Prompt construction
 ↓
MusicGen inference
 ↓
Audio file
```

### Response

The API can return either:

1.  A generated audio file directly, or
2.  A temporary URL/reference to the generated audio.

Example JSON response:

``` json
{
  "status": "success",
  "prompt": "A slow melancholic cinematic piano composition...",
  "audio_url": "/audio/generated_001.wav"
}
```

------------------------------------------------------------------------

## 11. Suggested Project Modules

### Module 1 --- Emoji Input

Responsible for:

-   Emoji selection
-   Multiple emoji combinations
-   Input validation

Example:

``` text
😊 🌧️ 💔 🔥 🌙 ❤️
```

### Module 2 --- Emoji Semantic Mapping

Responsible for converting emojis into structured attributes.

Example:

``` python
{
    "mood": "melancholic",
    "energy": "low",
    "tempo": "slow",
    "instruments": ["piano", "strings"],
    "style": "cinematic ambient"
}
```

### Module 3 --- Prompt Generator

Combines the semantic attributes into a natural-language prompt
optimized for MusicGen.

### Module 4 --- Music Generation

Loads MusicGen and performs inference on the Colab T4 GPU.

### Module 5 --- API Layer

FastAPI exposes the generation functionality to external clients.

### Module 6 --- Frontend

Provides:

-   Emoji input
-   Generate button
-   Loading indicator
-   Generated prompt display
-   Audio player
-   Optional download/save functionality

------------------------------------------------------------------------

## 12. Future Enhancements

### A. Emoji Combinations

Allow users to combine several emojis to create more complex emotional
states.

``` text
☀️🌻😊
```

could represent:

> Bright, warm, uplifting acoustic music.

### B. User Controls

Allow users to optionally modify:

-   Duration
-   Genre
-   Tempo
-   Instrumentation
-   Energy
-   Mood

### C. Multiple Generations

Generate several interpretations of the same emoji input.

``` text
🌙

Version 1 → Ambient
Version 2 → Piano
Version 3 → Electronic
```

### D. Mood History

Store previously generated tracks and their emoji inputs.

### E. Music Visualization

Display an animated waveform or frequency spectrum while the generated
music plays.

### F. LLM-Assisted Prompt Generation

An LLM can be added between semantic mapping and MusicGen:

``` text
Emoji
 ↓
Emoji Semantic Engine
 ↓
LLM
 ↓
Rich Music Prompt
 ↓
MusicGen
```

This can produce more expressive and context-aware prompts.

------------------------------------------------------------------------

## 13. MVP Scope

The minimum viable version should support:

-   [ ] Single emoji input
-   [ ] Multiple emoji input
-   [ ] Emoji-to-music semantic mapping
-   [ ] Automatic prompt generation
-   [ ] MusicGen Small inference
-   [ ] FastAPI `/generate` endpoint
-   [ ] Basic HTML/JavaScript frontend
-   [ ] Generated audio playback
-   [ ] Google Colab T4 inference

The MVP should prioritize reliability and a complete end-to-end workflow
over advanced UI features.

------------------------------------------------------------------------

## 14. Important Technical Constraint

Google Colab is suitable for the project prototype and demonstration,
but it is **not intended to function as a permanent production API
server**.

For a college project/demo:

``` text
Frontend
   ↓
Public tunnel
   ↓
FastAPI on Colab
   ↓
T4 GPU
   ↓
MusicGen
```

is perfectly reasonable.

For production deployment, the model should eventually be moved to a
dedicated GPU inference service or GPU-enabled server.

------------------------------------------------------------------------

## 15. Project Novelty

The novelty does not come from training a new music-generation model.

Instead, the project focuses on creating a new **conditioning interface
for generative music**:

> **Emoji → Semantic Emotion → Musical Attributes → Generative Prompt →
> Music**

This makes the project an example of **multimodal human-AI
interaction**, where a simple visual symbol is transformed into a
complex generative output.

------------------------------------------------------------------------

## 16. Proposed Project Name Ideas

### Technical

-   **Emoji2Music**
-   **EmotiTune**
-   **EmojiMuse**
-   **MoodGen**
-   **EmotiSound**

### More Product-Like

-   **VibeGen**
-   **VibeEmoji**
-   **Moodify**
-   **Emoti**
-   **SonicMood**

### Recommended

**EmojiMuse**

> *Turn an emoji into a vibe.*

------------------------------------------------------------------------

## 17. Final Project Pipeline

``` text
                  USER
                   │
                   ▼
             Select Emoji(s)
                   │
                   ▼
        ┌─────────────────────┐
        │ Emoji Semantic      │
        │ Engine              │
        └──────────┬──────────┘
                   │
                   ▼
       Emotion + Energy + Style
       Tempo + Instruments
       Atmosphere + Genre
                   │
                   ▼
        ┌─────────────────────┐
        │ Prompt Generator    │
        └──────────┬──────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │     MusicGen        │
        │   Small / AudioCraft│
        └──────────┬──────────┘
                   │
                   ▼
              🎵 AUDIO
                   │
                   ▼
        ┌─────────────────────┐
        │      FastAPI        │
        └──────────┬──────────┘
                   │
                   ▼
              FRONTEND
                   │
                   ▼
             ▶️ PLAY MUSIC
```

## 18. One-Line Project Description

**EmojiMuse is an end-to-end Generative AI application that transforms
emoji-based emotional expressions into original music using semantic
emoji interpretation, automatic prompt generation, and Meta's MusicGen
text-to-music model.**
