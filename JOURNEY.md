# The Reveria Journey: From Zero to 65 Sessions

*How a hackathon project evolved through 65 coding sessions, 3 major rewrites, and countless "why isn't this working" moments.*

---

## Day 1: Can We Even Do This? (Sessions 1-8)

It started with a question: can you build an AI storybook generator that actually feels like a book? Not a chat interface, not a wall of text. A real, page-turning, illustrated book.

Session 1 was the usual scaffolding. React + Vite on the frontend, FastAPI on the backend, Docker for good measure, a $5 GCP budget cap because hackathons and runaway cloud bills don't mix. The WebSocket echo endpoint worked on the first try. That never happens, so we took it as a good sign.

Session 2 is where things got exciting. Gemini 2.0 Flash streaming text over WebSocket, split into scenes with `[SCENE]` markers. The first time a story streamed in, word by word, with the narrator maintaining conversation history so you could say "make it scarier" and it would actually continue the same narrative. That moment of seeing it work, genuinely work, is why you do hackathons.

Session 3 brought Imagen 3 into the mix and nearly broke everything. The two-step pipeline (extract character sheet, then generate prompts, then call Imagen) seemed elegant on paper. In practice, the character sheet extraction returned wildly different results each time, the image prompts were inconsistent, and the 16:9 aspect ratio left black letterboxing edges that we had to crop with `transform: scale(1.04)`. But the flipbook worked. `react-pageflip` with 22 fixed page slots, scene reveal animations, drop-cap typography. It looked like a book.

Sessions 4-5 were about making it not break. Word limits to keep Gemini from writing novels per scene. Art style pills (only 6 at this point: Cinematic, Watercolor, Comic Book, Anime, Oil Painting, Pencil Sketch). A cleanup audit that found dead code everywhere, 5 unused dependencies, and 11 `print()` calls that should have been `logging`. The pipeline abort on dead connections was important: if the browser tab closed, stop burning API credits.

Session 6 was the responsive UI pass. Everything got `clamp()`. Headers, panels, buttons, icons, input fields. Director panel hidden under 768px. The kind of work that's boring to describe but makes the difference between "demo" and "app."

Sessions 7-8 were about the book itself looking right. Book depth shadows for a 3D effect. Page gutter shadows simulating binding darkness. An attempt at spine shadows that looked great until you flipped a page and the shadow stayed floating in mid-air. Reverted. An attempt at page edge thickness layers. Reverted per user feedback. The compact control bar that reclaimed vertical space for the flipbook by shaving pixels off every padding, gap, and margin in the UI.

**What worked:** The core loop. Prompt, stream text, generate images, flip pages. It felt magical even in v0.1.

**What didn't:** Image consistency. Every scene had different-looking characters. We knew this would be a problem. We just didn't know how big.

---

## Day 2: The Director Arrives (Sessions 9-10)

Session 9 introduced the Director panel: a structured analysis engine that watched your story and gave feedback. Narrative arc with a mini SVG curve. Character chips. Tension bars with trend arrows. Visual style mood pills. All collapsible, all with shimmer loading states. It was the first feature that made Reveria feel like more than a toy.

Session 10 tackled the image continuity problem head-on. Characters looked completely different across story continuations because the Illustrator rebuilt its character sheet from scratch each time. The fix: accumulate story text across batches and merge character sheets instead of replacing them. If the extraction failed, keep the old sheet. Simple in retrospect, took hours to debug because the failure mode was subtle: characters would slowly drift rather than obviously break.

Also fixed the pageflip bounce animation. When you swiped past the last page on mobile, it would show a visible flip-back animation instead of snapping back. Replaced `flip()` with `turnToPage()` for instant snap-back. Small fix, big quality-of-life improvement.

---

## Day 3: The Firebase Marathon (Sessions 11-24)

Fourteen sessions in one day. This is where it stopped being a demo and became an app.

**Session 11** laid the Firebase foundation. Auth with Google Sign-In, Firestore persistence, the save flow with its three tiers (instant if metadata exists, use WebSocket background result if available, call API with spinner as last resort). The `title_generated` flag that prevents re-generating titles on every save. `merge=True` on `persist_story` so we never accidentally overwrite fields we shouldn't touch.

**Sessions 12-13** built the Library and Explore pages. 3D CSS book cards with perspective transforms and spine edges. Skeleton loading states. Status badges. Publish/unpublish. URL routing with story resume on page reload. The `history.replaceState` trick for page parameter sync without React re-renders.

**Sessions 14-16** added the polish that makes an app feel real. Image error handling with specific reasons (quota, safety filter, timeout). Favorites with optimistic Firestore updates. Status filter pills. Explore page with likes using `arrayUnion`/`arrayRemove`. The `translateZ(2px)` fix for click events inside `preserve-3d` containers, because 3D CSS and click handlers are not friends.

**Session 17** added completed book protection. Sounds simple ("if completed, make it read-only") but the bug was that opening your own completed book from Explore didn't pass the `status` field, so it defaulted to 'draft' and the book appeared editable. The kind of bug you only find by testing every navigation path.

**Session 18** was the big one: per-scene actions. Regenerate image (keep text), regenerate scene (rewrite everything), delete scene. Each needed its own WebSocket message type, its own backend handler, its own loading state. Auto-session recovery so scene actions work even if the WebSocket dropped and reconnected. Narrator history updates to maintain continuity after edits. The `sceneDeleteOut` animation with scale, rotation, and blur was satisfying to build.

**Sessions 19-24** were a blur: scene titles parsed from `[SCENE: Title]` markers, custom glassmorphism dropdown for art styles, the 3-tier save optimization, toast notifications (success/error/warning/info with auto-dismiss and hover-pause), header hover effects with shimmer sweeps and spring curves, and the bug fixes that accumulate when you build fast. The Library "New Story" button that just navigated to `/` without saving the current story. Page clamping for stale URLs. WebSocket connection gating.

**The grind:** 14 features in one day. Each one small, each one necessary, each one with its own edge cases and Firestore indexes and CSS animations. This was the day the codebase stopped being something one person could hold in their head.

---

## Day 4: The Hard Problems (Sessions 25-42)

### The Image Consistency Breakthrough (Session 25)

This is the session that changed everything. Characters looked different in every scene, and we finally understood why.

The root cause: `_create_image_prompt()` asked Gemini to write a complete image prompt under 100 words. Gemini, being helpful, summarized character descriptions to fit the limit. "A 23-year-old woman with auburn hair in a loose braid, green eyes, freckled cheeks, wearing a burgundy leather jacket with brass buckles and a silver compass pendant" became "woman in dark dress." Imagen never saw the details.

The fix was a hybrid prompt architecture. Split into two stages: first, identify which characters appear in the scene (tiny Gemini call, ~50 tokens). Second, have Gemini write only the scene composition (setting, lighting, mood, camera angle) while character descriptions get prepended verbatim from the reference sheet. No summarization. No creative rewriting. The exact character description hits Imagen every time.

It sounds obvious now. It took three days to figure out.

### The Feature Sprint (Sessions 26-42)

With image consistency solved (or at least dramatically improved), we went on a feature tear.

**Multi-language support** (Session 34): 8 languages with language-specific TTS voices. The narrator's system prompt gets a language directive, the TTS client maps to the right voice (`es-US-Studio-B`, `ja-JP-Standard-B`), and the language persists per story in Firestore. Language-aware title generation so Japanese stories get Japanese titles.

**Reading Mode** (Session 38): Full-screen immersive overlay with word-by-word karaoke narration sync. Bookmarks in Firestore for authenticated users, sessionStorage for guests. Auto-advance between scenes. Keyboard controls. Fade transitions. The karaoke sync was the hardest part: aligning word highlighting to audio playback with no timestamp data, just heuristic weight-by-word-length estimates.

**PDF Export** (Session 37): `fpdf2` generating polished storybook PDFs with cover pages, scene images, decorative separators, and page numbering. Straightforward, but the image-to-PDF sizing math was fiddly.

**Character Portraits** (Session 40): Parse the character sheet, generate face portrait prompts, render 1:1 images via Imagen, upload to GCS. The fallback for stories where character extraction returned NONE (extract characters from the story text directly). Every error path sends `portraits_done` so the frontend loading spinner never gets stuck.

**Prompt Engineering** (Session 49): Hex color codes in character sheets. Face shapes and signature items. Anti-drift language between character blocks and scene composition: "Render each character EXACTLY as described above." Richer art style suffixes expanded from 5-8 words to 20-25 words with rendering specifics (volumetric lighting, paper texture, cel shading). Consistency anchors referencing signature accessories by name.

**Content Filtering** (Session 48): Pre-pipeline validation using Gemini Flash to classify prompts as STORY/REJECT before the expensive pipeline runs. Multilingual refusal patterns covering Hindi, Spanish, French, German, Japanese. Fails open on errors, because blocking legitimate requests is worse than letting an occasional edge case through.

### The Feature Graveyard

Not everything survived.

**Ambient music** (Session 39, removed Session 53): 7 mood-mapped ambient tracks that crossfaded when the Director's mood analysis changed. Cool technically. Web Audio API with `AudioContext` and `GainNode`, proportional crossfades, browser autoplay policy workarounds. Nobody noticed it was there. Removed.

**Gemini Live Voice v1** (Session 41, removed Session 53): Continuous voice conversation with Gemini for story brainstorming. `MediaRecorder` streaming 16kHz PCM, backend `LiveSession` class, auto-fill prompt detection. Too complex for what users actually wanted. They preferred typing. The voice feature would come back later in a very different form (Director Chat), but this first version was the wrong abstraction. Removed.

**Cast Characters / Subject Reference** (built across multiple sessions, removed later): Photo upload for character likeness. Vision analysis, `[USER-CAST]` sheet prefixes, Imagen `edit_image` with `[1]` bracket notation for subject binding. Likeness quality from Imagen's subject reference was not good enough. Characters looked vaguely similar at best. The entire feature was removed rather than shipping something half-baked.

Sometimes the right decision is deleting code you spent days writing.

---

## Day 5+: Deep Work (Sessions 43-62)

This is where the project matured. Fewer new features, more structural improvements and the kind of engineering that doesn't show up in screenshots.

### The Great Decomposition (Session 44)

Seven monolithic files (500-800 lines each) broken into 22 smaller modules, all under 320 lines. SceneCard.jsx went from 782 lines to 128. App.jsx from 557 to 324. The WebSocket handler from 462 to 233. Not glamorous work, but the codebase became navigable again.

### Backend Resilience (Session 55)

Per-user circuit breakers on Imagen (so one user hitting quota doesn't affect others). A retry utility with transient error detection. GCS retry with signed URL fallback when `make_public()` fails. Atomic usage tracking with Firestore transactions. Batched deletions (450-doc batches) for stories with lots of scenes. TTS silence insertion when a segment fails, so audio doesn't just cut out mid-sentence. A module-level `asyncio.Semaphore(1)` serializing all Imagen calls because the API can't handle concurrent requests gracefully.

### Per-Scene Streaming (Session 54)

The architecture rewrite that should have been there from day 1. Instead of generating all text, then all images, then all audio in batch, the pipeline now fires image and audio tasks per scene as soon as text is ready. Character extraction runs once on the first scene. Director analysis runs per scene. The perceived latency dropped dramatically because users see images appearing while text is still generating for later scenes.

Mid-generation steering came with this rewrite. The ControlBar stays active during generation. Users can type while the story generates, and the text gets injected into the narrator's context between scenes via a steering queue. The narrator picks up the new direction naturally.

### The Interaction-Flow Audit (Session 59)

This deserves its own section. Nine bugs found by asking "what happens if...?" questions instead of reading code. The approach: walk through every major user flow and think about race conditions, disconnects, and state mismatches.

**The critical one:** When generation was already running and the Director issued a `generate_story` tool call, the tool call was silently dropped without sending a `FunctionResponse` back to the Gemini Live API. This corrupted the session. The Live API requires a `FunctionResponse` for every tool call, no exceptions. Fix: always reject with `respond_to_tool_call(tc, success=False)` when generation is in progress.

**The subtle one:** `asyncio.CancelledError` inherits from `BaseException`, not `Exception`. So the `except Exception` block in `handle_generate` never caught it. When a WebSocket disconnected during generation, the usage counter was never decremented. Users lost a generation credit for stories they never received. Fix: explicit `except asyncio.CancelledError` block.

**The sneaky one:** After a story reset, `storyIdRef.current` becomes null, but scene-scoped WebSocket messages (text, image, audio, deletion) kept arriving and applied their data without checking. Stale data from the old story could leak into the new session. Fix: null guard on `storyIdRef.current` for every scene message handler.

Other finds: hero photo analysis blocking the entire WebSocket message loop for 30 seconds (wrap in `asyncio.create_task()`), double-click save race conditions (synchronous ref guard), scene busy indicators stuck after reconnect, director live notes accumulating across batches.

### Director Chat: Three Rewrites

The Director Chat went through three distinct versions, each one cutting complexity roughly in half.

**Version 1** (Session 55): Separate API calls for everything. `send_audio()` for the conversation, `transcribe_audio()` for the user's speech, another `transcribe_audio()` for the Director's response, `detect_intent()` to check if the user wants to generate, `suggest_prompt()` to extract a story prompt. Five API calls per interaction. It worked, but it was slow and expensive.

**Version 2** (Session 58): The rewrite that happened after actually reading the Gemini Live API docs more carefully. Native audio transcription (input and output), native function calling for generation intent, context window compression for long sessions. The `_collect_response()` method now returns audio, transcriptions, and tool calls from a single receive loop. `detect_intent()` and `suggest_prompt()` deleted entirely. Three to five API calls eliminated per interaction.

**Version 3** (across Sessions 59-60): VAD (Voice Activity Detection) for natural conversation flow. Web Audio API `AnalyserNode` computing RMS levels on a 100ms polling interval, detecting the speech-to-silence transition, auto-stopping the recorder after 1.2 seconds of quiet. Speak, pause, auto-send, Director responds. No button-pushing required for conversation.

The manual "Suggest" button stayed as a fallback because native tool calling reliability in audio mode hovers around 60-70%. Sometimes the best engineering is admitting the technology isn't reliable enough and building a backup path.

### The Cinematic Book Opening (Session 61)

The old flow: you type a prompt, the idle cover vanishes, and the book pops into existence on page 1. It was jarring.

The new flow: idle cover glows violet when you hit enter (`tc-idle-preparing` class, a pulse animation), the book mounts on page 0 (the cover page) with a shimmer overlay and icon pulse, the entrance animation plays over 700ms with a brightness bloom at 60%, then at 800ms the book flips from cover to the first scene with a satisfying animated page turn. Subsequent scenes use standard flip logic.

Getting the timing right took multiple iterations. The clamp effect kept fighting the auto-flip. The cover bounce (`page === 0 && scenes.length > 0`) had to be suppressed during generation. Every `turnToPage()` call in the generation path had to be replaced with animated `flip()`. Small details, big difference in feel.

### Visual Narrative Templates (Session 60)

Adding comic, manga, and webtoon art styles revealed that the image prompt pipeline was optimized for realistic/painterly scenes and fell apart for sequential art. Every image came out as a character portrait because the prompt structure put "Medium shot of CHARACTER" first.

The fix was a visual narrative scene composer that classifies scenes as character-present vs. setting-only and applies different composition rules. Characters get woven into scenes naturally instead of every image being a close-up.

But the real discovery was about negative prompts. Phrases like "comic book panel art" and "halftone dot texture" in the art style suffix triggered Imagen to render speech bubbles and text into the images. We had to strip anything text-adjacent from the prompts. Then we learned that putting `[NO text, NO speech bubbles]` at the start of the prompt was counterproductive because Imagen weights the beginning of prompts most heavily. Moved negative constraints to the end.

Also attempted face-crop portrait extraction using Gemini Vision for bounding box detection and Pillow for cropping. Detection accuracy on comic and manga art was insufficient. Built the infrastructure, disabled the feature, filed it under future work.

### The Director Panel Redesign (Session 62)

The Director Panel started with 9 analysis cards. By Session 62, it was clear that was too much information. Redesigned to 4 focused sections: scene insight pairs that match the book's open spread, a story health card with quality dimension bars, compact story details, and collapsible live notes.

The backend fix that came with this: accumulated scenes now persist across batches so the Director's post-batch analysis covers the entire story, not just the latest batch. The frontend director data merge logic, which was already fragile, was replaced by simply trusting that the latest analysis is complete.

### Streaming Audio & Barge-In (Session 63)

Three improvements to Director Chat latency and conversational feel:

**Streaming PCM audio.** Instead of collecting the Director's full audio response, encoding it as WAV, and sending it as a data URL, the backend now streams raw PCM chunks incrementally via WebSocket. A `useStreamingAudio` hook on the frontend feeds each base64-encoded chunk into Web Audio API `AudioBufferSource` nodes scheduled for gapless playback. The Director's voice starts within 200-400ms of the request instead of 1-2 seconds. The legacy `Audio(dataUrl)` path stays for session greetings and tool call acknowledgments.

**Barge-in.** The microphone stays hot during Director speech (`echoCancellation: true`). VAD detects user speech onset via a new `onVoiceStart` callback, which immediately kills all scheduled Web Audio sources and pauses any legacy Audio element. The user's speech is captured and sent normally. Manual barge-in (tapping the orb during speaking state) also works.

**Mute Director audio.** Tapping the voice orb during Director speech immediately stops all audio playback. Simple and reliable.

VAD silence threshold also dropped from 1200ms to 800ms for snappier auto-send.

**Barge-in noise debouncing.** The initial barge-in implementation was too trigger-happy — a single VAD frame (100ms) with RMS above 0.01 killed the Director's audio. Background noise (fan, typing, cough) easily exceeded that. Fixed with two-layer debouncing: a higher `BARGEIN_THRESHOLD` (0.02, 2x the silence threshold) for onset detection, and a consecutive frame requirement (3 frames, ~300ms) before `onVoiceStart` fires. Brief noise spikes reset the counter. Actual speech still triggers in ~300ms.

**Silent user re-engagement.** The mic goes hot after the Director greets you, but if you don't speak, nothing happens — the VAD auto-stop only fires after speech→silence. Added a 10-second idle timeout: if no speech is ever detected, the recording silently aborts and a system nudge (invisible in chat) asks the Director to re-engage with a creative question or story suggestion. One nudge per silence period, reset when the user actually speaks.

> **Note:** Barge-in and noise debouncing were later removed in Session 65 in favor of a simpler mute-to-stop approach. The streaming audio and silent re-engagement features remain.

### Voice-Reactive Canvas Orb (Session 64)

The CSS-animated voice orb was replaced with a canvas-based organic blob that reacts to real-time audio amplitude. `VoiceOrb.jsx` uses 8 control points with Catmull-Rom spline interpolation, displaced by pseudo-noise (overlapping sine waves at irrational frequency ratios). Amplitude from the mic's `AnalyserNode` (recording) or streaming audio's `AnalyserNode` (Director speaking) drives blob deformation and noise speed.

Asymmetric smoothing (fast attack 0.25-0.35, slow decay 0.05-0.1) makes it feel alive — responsive to voice onset but with organic tail-off between words. Six visual modes blend smoothly via per-frame lerping. Three-layer composition: outer glow blob (CSS blur), main radial-gradient canvas blob, inner specular highlight. The icon overlay fades during speaking — the blob becomes the visualization.

No external dependencies. 72px canvas, DPR capped at 2, `requestAnimationFrame` only. Performance is negligible.

### Session 65: Interleaved Output, i18n, and Demo Polish

Five changes in one session, all driven by hackathon requirements and demo readiness:

**Gemini Native Interleaved Output.** The hackathon requires "Must use Gemini's interleaved/mixed output capabilities." Added `response_modalities: ["TEXT", "IMAGE"]` to `generate_interleaved()` in `gemini_client.py`. The Narrator's primary path now uses `generate_with_images()` which calls this. But the key decision: Imagen 3 is always primary for images (character consistency pipeline), Gemini native image is only a tier-0 fallback when Imagen fails. `_run_interleaved()` tries interleaved first, falls back to `_run_streaming()` on failure.

**Barge-in removal.** The barge-in implementation from Session 63 was too complex and fragile for a demo environment. Replaced with simple mute: tap the voice orb during Director speech to stop playback. No hot mic, no noise debouncing, no false triggers. Clean and reliable.

**Director Chat text input.** A "Type" button in DirectorChat.jsx toggles a text input field for demo safety. If voice recognition fails during the hackathon presentation, the presenter can type messages to the Director. Reuses the existing `send_text()` path.

**Multilingual template cards.** `TEMPLATE_I18N` map in `languages.js` provides translations for all 9 templates across 7 languages (Hindi, Spanish, French, Japanese, German, Portuguese, Chinese). Template names, descriptions, and taglines translate when a non-English language is selected. `language` prop threaded through TemplateChooser → CoverflowCarousel → BookCover → CoverPage.

**Language indicator and generation messages.** Globe pill in ControlBar shows active language when non-English. Fun stage messages during generation: "Summoning the narrator...", "Painting the scene...", "Gathering the portraits...".

---

## The Numbers

| Metric | Count |
|--------|-------|
| Coding sessions | 65 |
| Lines of code (approx.) | ~60,000 |
| Story templates | 9 |
| Art styles | 30+ |
| Supported languages | 8 |
| CI/CD pipeline jobs | 4 |
| Major architecture rewrites | 3 |
| Features completely removed | 3 (ambient music, live voice v1, cast characters) |
| Bugs found in interaction-flow audit | 9 |
| Director Chat rewrites | 3 |
| Hackathon deadline | 1 |

---

## What We'd Do Differently

- **Start with per-scene streaming from day 1.** The batch pipeline (generate all text, then all images, then all audio) was the wrong architecture. We knew it by Session 10 and didn't fix it until Session 54. Forty sessions of working around the wrong abstraction.

- **Read the API docs more carefully, earlier.** The Gemini Live API had native transcription, tool calling, and context compression the entire time. We built manual versions of all three before discovering the native features existed. That's three weeks of unnecessary complexity.

- **Build interaction tests before UI.** The Session 59 audit found 9 bugs by just thinking through user flows. If we'd written those "what happens if the user does X during Y" scenarios as test cases from the start, we would have caught them during development instead of during a dedicated audit session.

- **Ship fewer features, polish more.** The feature graveyard (ambient music, live voice v1, cast characters) represents weeks of work that was ultimately deleted. Each feature was interesting in isolation but didn't make the core experience better. More time on character consistency, image quality, and the reading experience would have been a better investment.

---

## Timeline Visualization

| Day | Date | Sessions | Key Milestones |
|-----|------|----------|---------------|
| Day 1 | Feb 18 | 1-8 | Core pipeline, Imagen 3, flipbook, responsive UI, book shadows |
| Day 2 | Feb 19 | 9-10 | Director panel, structured analysis, image continuity fix |
| Day 3 | Feb 20 | 11-24 | Firebase, Library, Explore, routing, 14 features in one day |
| Day 4 | Feb 21 | 25-42 | Hybrid prompts, multi-lang, portraits, reading mode, PDF export |
| Day 5 | Feb 22 | 43-49 | Decomposition, social features, content filtering, prompt engineering |
| Day 6 | Feb 23 | 50-53 | Subscription tiers, feature cleanup, author attribution |
| Day 7 | Feb 24 | 54-58 | Per-scene streaming, Director Chat, native API rewrite |
| Day 8+ | Feb 25+ | 59-62 | Interaction audit, visual narratives, cinematic opening, panel redesign |
| Day 9 | Mar 10 | 63-65 | Streaming audio, mute, navigation tools, voice-reactive orb, interleaved output, i18n templates |

---

*Built for the [Gemini Live Agent Challenge](https://devpost.com/) hackathon. The codebase lives at [github.com/Dileep2896/reveria](https://github.com/Dileep2896/reveria).*
