# Building Reveria: An AI Story Engine with Gemini #GeminiLiveAgentChallenge

*Describe a story. Watch it come alive. That's the pitch. Here's how I actually built it.*

> Built for the [Gemini Live Agent Challenge](https://devpost.com/) hackathon (Creative Storyteller Track). #GeminiLiveAgentChallenge

---

## What is Reveria?

Reveria is an interactive story engine. You type (or say) something like "a noir detective story in a rain-soaked city at midnight," and it generates an illustrated storybook in real time: narrative text, scene illustrations, voice narration, and an interactive flipbook you can page through. Everything streams in live as four AI agents work in parallel.

What makes it different from "give me a story" ChatGPT wrappers is the **Director Chat**. You open a voice conversation with an AI Director character, brainstorm your story idea out loud, and when the Director decides you're ready, it triggers generation automatically. During generation, the Director watches each scene and offers creative analysis in real time. It suggests what should happen next, and the Narrator picks up that suggestion in the following scene. Two agents shaping a story together, with you steering.

This isn't a single API call. It's a multi-agent pipeline built on Google's Agent Development Kit (ADK), with Gemini 2.0 Flash for text, Imagen 3 for illustrations, Gemini Live API for voice, and Gemini Native Audio for narration. Each agent runs at a different temperature tuned for its task.

Beyond generation, Reveria is a full application: a Library for your saved stories, an Explore page for discovering published work from other users, Reading Mode with karaoke-style narration, PDF export, 8-language support, 9 story templates, 30+ art styles, social features (likes, ratings, comments), and share links for public viewing.

**Live app**: [reveria.web.app](https://reveria.web.app) | **Source**: [github.com/Dileep2896/storyforge](https://github.com/Dileep2896/storyforge)

> **Quick stats**: 4 AI Agents · 30+ Art Styles · 9 Story Templates · 8 Languages

[IMAGE: 01-template-chooser.jpg — 9 story templates, from Storybook to Manga to Photo Journal]

---

## System Architecture

Reveria runs four specialist agents coordinated by ADK's SequentialAgent. The key design decision: **different temperatures for different tasks**. Story writing needs high creativity (temp 0.9). Image prompts need precision (temp 0.3). Character extraction needs determinism (temp 0.1). Director analysis needs structured JSON output (temp 0.3). A single Gemini call can't do all of these well.

The pipeline:

```
StoryOrchestrator (SequentialAgent)
  +-- NarratorADKAgent (per-scene streaming loop)
  |     |
  |     +-- Scene 1 text ready ──> Illustrator (Imagen 3)
  |     |                     ──> TTS (Gemini Native Audio)
  |     |                     ──> Director Live (commentary)
  |     |
  |     +-- [Check steering queue → inject user direction]
  |     |
  |     +-- Scene 2 text ready ──> (same parallel tasks)
  |     |
  |     +-- await all pending tasks
  |
  +-- PostNarrationAgent (ParallelAgent)
        +-- Director Agent (full post-batch analysis)
```

**Four agents, four roles:**

- **Narrator Agent** (Gemini 2.0 Flash, temp 0.9): writes each scene with consistent characters and plot threads, streams text chunk-by-chunk over WebSocket
- **Illustrator Agent** (Gemini + Imagen 3, temp 0.1–0.3): four-stage hybrid prompt pipeline for visually consistent illustrations across scenes
- **TTS Agent** (Gemini Native Audio): audiobook-quality narration that varies tone with mood
- **Director Agent** (Gemini Flash, temp 0.3): per-scene live commentary with mood, tension, craft notes, and creative suggestions

Each prompt generates exactly one scene. This keeps the feedback loop tight. Everything streams over a single WebSocket — text chunk-by-chunk, images as each Imagen call completes, audio per-scene, Director analysis as structured JSON.

---

## The Build

**Week 1** was about proving the core pipeline. Day 1: can we get Gemini to generate story text, stream it over WebSocket, and render it in a flipbook? Day 2 brought the first big challenge: image generation — Imagen 3 produces stunning illustrations, but characters looked completely different across scenes. Day 3 was the Firebase integration marathon: auth, Firestore persistence, save flows, Library, URL routing.

**Week 2** was about solving character consistency (the hardest problem — described below), building Director Mode with live commentary, adding templates and art styles, and getting per-scene streaming working.

**Week 3** was the Director Chat integration with the Gemini Live API, the safety and content filtering system, social features, multi-language support, Reading Mode, the CI/CD pipeline, and a lot of polish. The interaction-flow audit at the end caught 9 bugs that would have been embarrassing in production.

---

## The Biggest Challenge: Character Consistency

This was the hardest technical problem I solved.

### The Problem

The naive approach: send scene text to Gemini ("write an image prompt"), get a 100-word prompt, send to Imagen. Gemini would receive a scene about "Elena, a woman in her late 20s with pale skin, long dark wavy hair, green eyes, wearing a high-collar black Victorian dress" and compress it to "woman in dark dress." Characters changed faces, hair color, and outfits between every scene.

### The Fix: Hybrid Prompt Construction

We split image prompt creation into four stages:

1. **Character Sheet Extraction** (Gemini, temp 0.1): reads the full story and outputs structured character descriptions with hex color codes, face shapes, signature items, and dominant palette
2. **Character Identification** (Gemini, temp 0.0): identifies which characters appear in each scene
3. **Scene Composition** (Gemini, temp 0.3): writes ONLY setting, lighting, mood, camera angle — explicitly told "do NOT describe characters"
4. **Assembly**: character descriptions + anti-drift anchor + scene composition + art style suffix, concatenated programmatically

The final prompt sent to Imagen looks like:

```
Elena: [gender: woman], [age: late 20s], [skin: pale ivory #F5E6D3],
[hair: dark wavy #2A1810 shoulder-length], [face: oval, green #4A7C59 eyes,
high cheekbones], [outfit: black #1A1A2E Victorian dress, silver moon pendant],
[signature items: silver moon pendant, lace gloves],
[palette: #1A1A2E, #F5E6D3, #4A7C59, #C0C0C0]

IMPORTANT: Render each character EXACTLY as described above.

Elena stands at the edge of a moonlit cliff, wind catching her dress.
Low angle, dramatic backlighting, cinematic digital painting,
highly detailed, dramatic volumetric lighting, depth of field.
```

The hex color codes give Imagen specific, unambiguous visual targets instead of subjective descriptions like "pretty woman in dark clothing."

### Anchor Portraits and Visual DNA

We pushed this further. Before generating any scene images, the Illustrator creates a 1:1 close-up portrait of each character via Imagen 3, then feeds it to Gemini Vision for **visual DNA extraction** — a 100–150 word description of exactly what was rendered. Subsequent scene prompts reference this visual DNA instead of the original text description. Characters look recognizably like *themselves* across every scene, because every prompt references a description derived from a real rendered image.

---

## Director Chat: Talking to Your Story's AI Director

This is the feature I'm most excited about. Director Chat is a real-time voice conversation with an AI Director character, built on the **Gemini Live API** (`gemini-live-2.5-flash-native-audio`).

### How It Works

1. **Start session**: Frontend sends story context. Backend opens a persistent bidirectional Gemini Live session with function calling, native audio transcription, and context window compression.
2. **Conversation**: User speaks. Web Audio's AnalyserNode detects 800ms of silence to auto-stop the recorder. Audio goes over WebSocket to the Live session.
3. **Tool-driven generation**: When the model decides brainstorming is done, it calls the `generate_story` tool with a vivid prompt distilled from your conversation. No external classifier needed.
4. **Manual fallback**: A "Suggest" button handles cases where tool calling doesn't fire in audio mode.

### Zero Extra API Calls

The previous architecture made 3–5 separate Gemini calls per interaction: one for conversation, one for user transcription, one for Director transcription, one for intent detection, one for prompt suggestion. Massive latency and API waste.

The rewrite eliminated ALL extra calls using three native Live API features:

- **Native transcription** (`input_audio_transcription` / `output_audio_transcription`): transcripts arrive in the receive stream. No separate STT calls.
- **Native function calling**: the model decides when to generate. Replaces the external intent classifier.
- **Context window compression**: sliding window handles long brainstorming sessions automatically.

### Streaming Audio: Eliminating the "Thinking" Gap

The original Director Chat had a noticeable delay — full audio had to be collected, encoded as WAV, and sent as a data URL. The fix: stream raw PCM chunks incrementally. A `useStreamingAudio` hook feeds each chunk into Web Audio API AudioBufferSource nodes for gapless playback. The Director's voice starts within 200–400ms instead of 1–2 seconds.

### Voice-Reactive Orb

The voice orb is a canvas-based organic visualization — four overlapping soft blobs driven by real-time audio amplitude. Six visual modes (idle, recording, speaking, loading, watching, waiting) transition smoothly via per-frame color and speed lerping. Asymmetric smoothing (fast attack, slow decay) makes it feel alive.

For accessibility, a text input mode lets users type messages to the Director instead of speaking.

[IMAGE: 04-director-chat.jpg — Voice brainstorming with the Director, then watching generation unfold]

---

## Per-Scene Streaming: Making It Feel Alive

The original pipeline was batch-sequential: Narrator generates ALL text, then ALL images, then ALL audio. Users stared at a spinner for 15–30 seconds.

The rewrite fires image, audio, and Director commentary tasks **per-scene** as each scene's text completes. Scene 1's image paints in while Scene 2's text is still streaming.

A module-level `asyncio.Semaphore(1)` serializes Imagen calls for rate limiting, but they start as soon as each scene's text is ready. `handle_generate` runs as `asyncio.create_task()` so the WebSocket loop stays responsive — users can send steer messages ("make it scarier") during generation.

### Director as Creative Partner

The Director's live commentary includes a `suggestion` field that proposes what should happen next. This is stored on shared state and prepended to the Narrator's input for the next scene. The Director doesn't just observe — it drives. It spots an opportunity ("Reveal that the stranger is her long-lost sister"), and the Narrator runs with it.

[IMAGE: 02-story-generation.jpg — Live story generation with Director analysis panel]

---

## Visual Narratives: Comics, Manga, and Webtoons

Templates aren't skins. Each one reshapes the entire pipeline. A Manga template changes the scene composer to use character-dominant framing, activates the text-free image defense, adjusts TTS to narrate only overlay text, and shifts the Narrator toward visual storytelling.

### The Text-in-Image Problem

Comic art styles triggered Imagen to render speech bubbles with garbled AI text. Our fix is a **triple-layer defense**: a positive "Text-free panel art:" prefix at the start of the prompt (where attention weight is highest), explicit composer instructions, and negative constraints at the end. We learned the hard way that putting negative constraints first consumed Imagen's attention budget and degraded character consistency.

---

## The UI: Glassmorphism Meets Interactive Fiction

### Cinematic Book Opening

New stories trigger a choreographed entrance: the book materializes with a brightness bloom at 60%, then the cover flips open in an overlapping motion that starts at 350ms (before the entrance finishes). The overlap creates one fluid motion.

### Gemini Native Audio Narration

We replaced Cloud TTS with Gemini's native audio output. The difference is striking: audiobook-quality narration that varies tone with mood instead of robotic voices. Reading Mode adds word-by-word karaoke highlighting synced to the audio.

### Library and Social Features

3D CSS book cards with perspective transforms, spine shadows, and page edges. Published stories get a BookDetailsPage with likes, star ratings, and threaded comments — all denormalized on the story document for zero pop-in.

[IMAGE: 03-book-details.jpg — Published story with characters, ratings, and social features]

---

## Safety and Content Filtering

**Pre-pipeline**: A Gemini Flash classifier (temp 0, ~200ms) catches non-story prompts in any language. Fails open on errors.

**Post-generation**: Pattern matching in 6 languages for edge cases.

For borderline content, the Narrator redirects in-character: *"That part of the library is forbidden! Let's explore this mysterious path instead..."*

---

## Multi-Language Support

Reveria generates stories in 8 languages: English, Spanish, French, German, Japanese, Hindi, Portuguese, and Chinese. Language flows through `SharedPipelineState` and touches every agent: Narrator prompt, TTS voice selection, title generation, content filtering, and Director Chat personality.

### Gemini Native Interleaved Output

The primary generation path uses `response_modalities: ["TEXT", "IMAGE"]` — Gemini generates text and images together in a single call. But **Imagen 3 is always primary for images**. The Gemini native image is a tier-0 fallback when Imagen fails. Why? Character consistency — our full pipeline (character sheets, visual DNA, hybrid prompts) only works with Imagen.

---

## Cloud Infrastructure

- **Cloud Run**: containerized FastAPI backend
- **Firebase Hosting**: React SPA frontend
- **Cloud Firestore**: story persistence, social features
- **Google Cloud Storage**: scene images, covers
- **Vertex AI**: Gemini 2.0 Flash, Imagen 3, Gemini Native Audio, Live API
- **GitHub Actions CI/CD**: 4 jobs — backend tests, frontend tests, Cloud Run deploy, Firebase deploy

Key resilience patterns: per-user circuit breaker for Imagen quota, retry utility with transient error classification, GCS signed URL fallback, atomic Firestore transactions for usage tracking, first-message WebSocket auth (no credentials in URLs).

---

## Lessons Learned

**1. Prompt Engineering is Architecture.** When your prompt construction has four stages with different temperatures, it's not a template — it's a data pipeline.

**2. Use Native API Features First.** Our Director Chat went from 3–5 Gemini calls per interaction to zero extra calls by enabling native transcription, function calling, and context compression.

**3. Per-Scene is the Right Granularity.** Scene-level parallelism (fire tasks as each scene completes) makes the experience feel live. The UX improvement is dramatic.

**4. Make Agents Proactive, Not Just Reactive.** The Director started as a passive observer. The breakthrough was giving it a suggestion field that feeds the Narrator. A read-only analyst became an active creative partner.

**5. Voice UX Needs Silence Detection.** Web Audio's AnalyserNode detects speech-to-silence transitions and auto-stops the recorder. One tap to start, zero taps after.

**6. Flow Audits Find Crashes, Code Audits Find Patterns.** The critical bug: silently dropping a Gemini Live API tool call. The protocol requires a `FunctionResponse` for every tool call. Dropping it corrupted the session permanently.

**7. Templates Are Modes, Not Skins.** When a config option touches four pipeline stages, it's architecture.

**8. Character Consistency Requires Structural Solutions.** You can't prompt-engineer your way to consistent characters with a single call. Separate extraction from composition, use hex color codes, and anchor to rendered portraits via Gemini Vision.

---

## Tech Stack

- **Frontend**: React + CSS (glassmorphism) + Vite
- **Backend**: Python 3.12 + FastAPI + Uvicorn
- **Agent Framework**: Google ADK (SequentialAgent + ParallelAgent)
- **LLM**: Gemini 2.0 Flash via Vertex AI
- **Interleaved Output**: Gemini native text+image (Imagen primary, Gemini fallback)
- **Image Generation**: Imagen 3 via Vertex AI
- **Director Chat**: Gemini Live API (gemini-live-2.5-flash-native-audio)
- **Voice**: Web Audio API + Gemini Native Audio
- **Auth**: Firebase Authentication (Google Sign-In)
- **Database**: Cloud Firestore
- **Storage**: Google Cloud Storage
- **Hosting**: Cloud Run + Firebase Hosting
- **CI/CD**: GitHub Actions (4-job pipeline)

---

## Try It

**Live app**: [reveria.web.app](https://reveria.web.app)

**Source code**: [github.com/Dileep2896/storyforge](https://github.com/Dileep2896/storyforge)

Built for the [Gemini Live Agent Challenge](https://devpost.com/) hackathon (Creative Storyteller Track) using Google's AI technologies including Gemini 2.0 Flash, Imagen 3, Gemini Live API, Gemini Native Audio, and the Agent Development Kit (ADK).

**#GeminiLiveAgentChallenge**

*Describe a story. Watch it come alive.*
