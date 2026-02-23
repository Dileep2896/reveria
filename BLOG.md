# Building StoryForge: An AI-Powered Interactive Story Engine

*How we built a multimodal storytelling platform that generates illustrated, narrated storybooks in real-time using Google's Gemini, Imagen, and Agent Development Kit.*

---

## The Idea

What if you could describe a story - "a mysterious noir detective story set in a rain-soaked city at midnight" - and watch it come alive in seconds? Not just text, but an illustrated storybook with images, narration, and an interactive flipbook you can page through?

That's **StoryForge** - an interactive multimodal story engine built for the [Gemini Live Agent Challenge](https://devpost.com/) (Creative Storyteller Track). Users describe a scenario via voice or text, and a team of AI agents builds it live: generating scene illustrations, narrative text, narrated voiceover, and an interactive storyboard, all streaming as interleaved output.

The killer differentiator? **Director Mode** - a split-screen view where the left panel shows the final story output and the right panel reveals the agent's creative reasoning. Why it chose certain imagery, narrative structure decisions, tension arcs, character development logic. This makes the agent architecture *visible* and understandable.

---

## The Architecture: A Team of Specialist Agents

StoryForge isn't a single monolithic AI call. It's an **orchestra of four specialist agents**, coordinated by Google's Agent Development Kit (ADK):

```
StoryOrchestrator (SequentialAgent)
  ├── Narrator Agent          ← runs first, generates story text
  └── PostNarrationAgent (ParallelAgent)
        ├── Illustrator Agent  ← generates scene images
        ├── Director Agent     ← analyzes creative decisions
        └── TTS Agent          ← synthesizes narration audio
```

The Narrator must complete before the parallel phase begins - because the Illustrator, Director, and TTS all depend on the generated scene text. Once narration is done, all three downstream agents run **concurrently** to minimize latency. The user sees text appear first, then images paint in, audio becomes playable, and the Director panel populates - all streaming over a single WebSocket connection.

### Why Multi-Agent?

A single Gemini call can't do everything well. Story writing needs high creativity (temperature 0.9). Image prompts need precision (temperature 0.3). Character extraction needs determinism (temperature 0.1). Director analysis needs structured JSON output. By splitting these into separate agents with tuned parameters, each does its job optimally.

---

## The Brainstorming Process

### Week 1: Foundation Sprint

**Day 1** was about proving the core pipeline works. Can we get Gemini to generate story text, stream it over WebSocket, split it into scenes, and render it in a flipbook? The answer was yes - within a single day we had text streaming into an interactive book.

**Day 2** brought the first big challenge: **image generation**. Imagen 3 produces stunning illustrations, but the prompts need careful engineering. A naive approach - "generate an image for this scene" - produces inconsistent results. Characters look completely different across scenes. The detective in scene 1 might be a young woman; in scene 2, an old man.

**Day 3** was the Firebase integration marathon. Auth, Firestore persistence, save flows, Library page, Explore page, URL routing - all the infrastructure that makes it a real application, not just a demo.

### The Character Consistency Problem (Our Biggest Challenge)

This was the hardest technical problem we solved. Here's what was happening:

**The naive approach:**
```
Scene text → Gemini ("write an image prompt") → 100-word prompt → Imagen
```

Gemini would receive a scene about "Elena, a woman in her late 20s with pale skin, long dark wavy hair, green eyes, wearing a high-collar black Victorian dress" and compress it to "woman in dark dress" to fit the word limit. Imagen had no idea what Elena actually looked like.

**Our solution: Hybrid Prompt Construction**

We split the image prompt into two stages - Gemini writes the scene composition only, then we **programmatically prepend** character descriptions from a reference sheet:

1. **Character Sheet Extraction** (Gemini, temp 0.1) - reads the full story and outputs structured character descriptions with physical details, clothing, distinguishing features, and color palettes
2. **Character Identification** (Gemini, temp 0.0) - identifies which characters appear in each specific scene
3. **Scene Composition** (Gemini, temp 0.3) - writes ONLY the setting, lighting, mood, camera angle - explicitly told "do NOT describe characters"
4. **Assembly** - character descriptions + scene composition + art style suffix concatenated programmatically

The final prompt sent to Imagen contains **100% of the character visual details** - nothing lost to summarization:

```
Elena: A woman in her late 20s, pale skin, long dark wavy hair,
green eyes, wearing a high-collar black Victorian dress, silver pendant.

Elena stands at the edge of a moonlit cliff, wind catching her dress.
Fog rolls below, a distant lighthouse beam sweeps across the water.
Low angle, dramatic backlighting, cinematic digital painting.
```

This was a breakthrough moment. Characters suddenly looked consistent across 4, 6, 8 scenes.

---

## Key Technical Decisions

### Streaming Over WebSocket (Not REST)

Story generation takes 15-30 seconds end-to-end. Making the user wait for a complete response would be terrible UX. Instead, we stream everything over a single WebSocket:

- Text arrives chunk-by-chunk as Gemini generates it
- Images arrive as soon as Imagen completes each scene
- Audio arrives per-scene from Cloud TTS
- Director analysis arrives as structured JSON

The frontend renders each modality as it arrives. You see text flowing in, then images "painting" in with a shimmer effect, then audio becoming playable - all progressively. It feels alive.

### The Three-Tier Save System

Saving a story needs an AI-generated title and cover image. But generating those takes 5-10 seconds. We can't make the user wait every time they click Save. Our solution:

- **Tier 1 (instant)**: If `title_generated` flag is set, just update status + timestamp. No API call.
- **Tier 2 (instant)**: If the background WebSocket task already delivered `bookMeta`, use it immediately.
- **Tier 3 (async)**: No metadata available - call the API, show "Generating cover..." spinner.

The background task starts automatically after the first generation batch completes. By the time most users click Save, the title and cover are already ready (Tier 1 or 2). The save feels instant.

### Art Style as a First-Class Citizen

We offer 6 art styles: Cinematic, Watercolor, Comic Book, Anime, Oil Painting, and Pencil Sketch. Each has a rich suffix with rendering-specific details (20-25 words):

```python
ART_STYLES = {
    "cinematic": "cinematic digital painting, highly detailed, dramatic volumetric lighting, "
                 "depth of field, rich color grading, photorealistic textures, 8k render quality...",
    "anime": "anime illustration in Studio Ghibli style, detailed lush backgrounds, "
             "soft cel shading, expressive large eyes, warm natural lighting...",
    "watercolor": "traditional watercolor illustration, soft translucent washes, "
                  "visible paper texture, delicate wet-on-wet brushstrokes...",
    ...
}
```

The art style is:
- Appended to every scene image prompt
- Used in book cover generation
- Persisted per story in Firestore
- Restored when reopening a story from the Library

This means if you created a watercolor story last week, opening it today shows "Watercolor" in the dropdown - and any new scenes you generate will match.

### NSFW Content Handling

AI models sometimes refuse requests they interpret as inappropriate. The problem? Gemini's refusal text ("I am programmed to be a harmless AI assistant...") would get rendered as story scenes - breaking the experience completely.

Our solution: a `ws_callback` wrapper that intercepts every text chunk before it reaches the frontend. If the text matches refusal patterns, we:
1. Stop sending further scene data
2. Send an error toast: "Your prompt was blocked by our safety filters. Please try a different story idea."
3. Abort the pipeline early

The user sees a clean error message, not garbled AI refusal text.

---

## The UI: Glassmorphism Meets Interactive Fiction

### The Flipbook

We use `react-pageflip` for realistic page-turn animations. Each scene is a full page with:
- A scene image (16:9, with shimmer loading state)
- A decorative drop-cap first letter
- Story text with sentence-by-sentence reveal animation
- A compact audio player for narration
- Scene title in italic serif

Pages flip with arrow keys, dot navigation, or swipe gestures. The URL updates via `history.replaceState` so you can bookmark `/story/abc123?page=3` and return exactly there.

### Director Mode

The right panel shows the AI's creative reasoning in real-time:

- **Narrative Arc** - Story structure stage (exposition → rising action → climax → resolution) with pacing indicators
- **Characters** - Cast list with roles and personality traits
- **Tension** - Bar chart visualization showing tension levels across scenes with trend arrows
- **Visual Style** - Mood tags and color palette analysis

This isn't just a debugging tool - it's a feature that makes the AI's decision-making transparent and educational.

### The Library

Your personal bookshelf with 3D CSS book cards (perspective transforms, spine shadows, page edges). Books show:
- AI-generated cover images
- Status badges (Draft, Saved, Completed, Published)
- Favorite hearts
- Scene counts and dates

While a cover is being generated, the book shows the scene image with a blur+grayscale filter and an animated "Painting cover..." overlay. When the AI cover arrives via WebSocket, the library auto-refreshes and the crisp cover appears.

---

## New Features: Pushing the Boundaries

### Multi-Language Story Generation

StoryForge doesn't just tell stories in English. Users can generate stories in **8 languages**: English, Spanish, French, German, Japanese, Hindi, Portuguese, and Chinese.

The architecture is elegant - the language selection propagates through the entire pipeline:

1. **Narrator**: A language directive is injected into the system prompt - `"Write ALL narrative text in {language}."` This ensures Gemini generates text in the target language.
2. **TTS**: A `LANGUAGE_VOICES` mapping selects the appropriate Cloud TTS voice - `es-US-Studio-B` for Spanish, `ja-JP-Standard-B` for Japanese, etc.
3. **Persistence**: The language is stored per story in Firestore and restored when reopening from the Library.
4. **Lock Pattern**: Once generation starts, the language is locked for that story. The Director panel shows an amber warning: "Language will be locked once you start generating."

The key insight: language is a pipeline-level concern, not a per-component concern. It flows through `SharedPipelineState` just like art style.

### Reading Mode: Karaoke-Style Narration

Reading Mode transforms the storybook into a cinematic full-screen experience. When you click "Read" on a published or completed story, an overlay takes over:

- **Word-by-word highlighting**: As the TTS audio plays, each word lights up in sync - like karaoke for books. The `timeupdate` event on the `<audio>` element drives the highlight position.
- **Auto-advance**: When a scene's narration ends, Reading Mode waits 1.5 seconds, then smoothly fades to the next scene.
- **Bookmarking**: Your reading position is saved - Firestore for authenticated users, sessionStorage for guests.
- **Keyboard controls**: Space/Right arrow = next scene, Left arrow = previous, Escape = exit.

The segmented progress bar at the top shows scene-by-scene progress, not just a single linear bar. You always know where you are in the story.

### PDF Export: Stories You Can Keep

Every saved story can be exported as a polished PDF storybook using `fpdf2`:

- **Cover page**: Full-bleed cover image with title and author overlaid
- **Scene pages**: Each scene gets a page with its illustration and formatted text
- **Typography**: Decorative separators, consistent font sizing, proper margins
- **Page numbering**: Centered at the bottom of each page
- **Colophon**: Final page with generation metadata

The backend endpoint `GET /api/stories/{story_id}/pdf` downloads images from GCS, composites the PDF in memory, and returns it as a streaming response. Access control ensures only the owner (or anyone for public stories) can download.

### Background Ambient Music

The Director Agent doesn't just analyze mood - it now **drives the soundtrack**. Seven ambient tracks map to the Director's `visual_style.mood` analysis:

| Mood | Sound |
|------|-------|
| Peaceful | Gentle pads, soft bells |
| Mysterious | Low drones, distant echoes |
| Tense | Pulsing bass, staccato strings |
| Chaotic | Dissonant layers, rapid modulations |
| Melancholic | Minor-key piano, slow reverb |
| Joyful | Bright arpeggios, warm harmonics |
| Epic | Orchestral swells, deep brass |

The `useAmbientAudio` hook uses the **Web Audio API** with `AudioContext` and `GainNode` for smooth crossfading. When the Director's mood changes (e.g., from "mysterious" to "tense"), the current track fades out over 1 second, the new track fades in over 2 seconds. Volume is kept subtle at 15% - background ambience, not a concert.

### Character Portrait Gallery

After generating a story, the Director Panel offers a "Generate Portraits" button. This triggers a pipeline:

1. **Parse character sheet** from the Illustrator's accumulated reference sheet (or auto-extract from story text if the sheet is empty)
2. **Build portrait prompts** - "Close-up face portrait of {name}: {description}, {art_style}"
3. **Generate via Imagen 3** at 1:1 aspect ratio
4. **Upload to GCS** and send `portrait` WebSocket messages per character
5. **Display** as a grid of circular thumbnails with name labels

The auto-extraction fallback was a critical fix. Some stories (especially ones with unnamed characters like "the detective" or "the ghost") returned NONE from the initial character extraction. The portrait system now re-extracts from the full story text as a fallback.

### Gemini Live Voice: Brainstorming Mode

The most ambitious feature: **real-time voice conversation** with Gemini for brainstorming story ideas.

How it works:
1. User clicks "Live" to start a session - opens a Gemini Live API connection (`gemini-2.0-flash-live-001`)
2. User speaks into the microphone - `useLiveVoice.js` captures 16kHz PCM audio via `AudioContext` + `MediaRecorder`
3. Audio chunks stream to the backend via WebSocket → forwarded to Gemini Live
4. Gemini responds with text (displayed as conversation bubbles above the control bar)
5. When Gemini detects the user is ready, it emits `[STORY_PROMPT]` - the prompt auto-fills in the input field
6. User confirms → normal generation pipeline runs

The system prompt instructs Gemini to be a "creative story collaborator" - it asks questions, suggests plot twists, helps refine ideas. When it senses the user has a clear vision, it synthesizes everything into a story prompt.

### Share Links & Public Viewing

Published stories get shareable URLs. Click the Share button → copies `{origin}/story/{storyId}` to clipboard. When an unauthenticated user opens this URL:

1. Frontend detects `!user && urlStoryId`
2. Fetches `GET /api/public/stories/{storyId}` (no auth required)
3. Renders StoryCanvas in read-only mode (no ControlBar, no Director Panel)
4. Shows a "Sign in to create your own" CTA banner

The backend sanitizes the response - no user UIDs, no narrator history, no internal state. Just the story content.

### Portal-Based Tooltips

A seemingly small but technically interesting challenge: custom tooltips on scene action buttons were getting clipped by `overflow: hidden` on parent containers (the book page inner wrapper, the image container).

The solution uses React's `createPortal` to render tooltips directly on `document.body` with `position: fixed`:

```jsx
function ActionBtn({ label, children }) {
  const ref = useRef(null);
  // On hover, getBoundingClientRect() → fixed position above button
  // createPortal renders on document.body → escapes all overflow clipping
}
```

The tooltip measures its trigger element's position with `getBoundingClientRect()` and positions itself with `position: fixed` - completely outside the DOM hierarchy. No parent can clip it.

### Social Features: Likes, Ratings & Comments

Published stories aren't just for reading - they're for community interaction. The BookDetailsPage (`/book/:storyId`) now supports:

- **Heart-based likes** using the existing `liked_by` array pattern from ExplorePage, with optimistic Firestore updates
- **1-5 star ratings** with hover preview, per-user upsert (ratings subcollection + denormalized `rating_sum`/`rating_count` on the story doc)
- **Threaded comments** with author avatars, timestamps, and delete permissions (comment author + story author)

The key UX challenge was eliminating "delayed pop-in" - social stats (ratings, comment count) appearing a second after the page loaded. We solved this by **denormalizing counts directly on the story document** and pre-populating the UI from the initial data fetch. The `/social` endpoint is only needed for the user's own rating, which arrives shortly after.

### Multilingual Content Filtering

A subtle but critical bug: when users submitted non-story prompts (coding questions, math homework) in non-English languages, the narrator would generate refusal text - and that text would get rendered as actual story scenes, complete with AI-generated illustrations of the refusal message. Not a great look.

The fix has two layers:

1. **Pre-pipeline validation** - A Gemini Flash classifier (`validate_prompt()`) runs before the expensive generation pipeline. It's fast (~200ms), multilingual, and classifies prompts as `STORY` or `REJECT`. This catches coding questions, recipes, homework, and general knowledge queries in any language.

2. **Post-generation pattern matching** - Expanded `is_refusal()` with patterns in Hindi, Spanish, French, German, and Japanese. This catches edge cases where the narrator slips through the pre-filter.

The pre-filter **fails open** on errors - if Gemini Flash has an issue, the prompt goes through rather than blocking a legitimate request. Better to occasionally process a non-story prompt than to block real stories.

### Advanced Prompt Engineering for Character Consistency

This was the culmination of deep research into image generation best practices for consistent characters across scenes. Five targeted improvements:

**1. Character DNA Format**

The character extraction prompt was upgraded from vague descriptors to a precise visual DNA format with hex color codes:

```
Elena: [gender: woman], [age: late 20s], [skin: pale ivory #F5E6D3],
[hair: dark wavy #2A1810 shoulder-length], [face: oval, green #4A7C59 eyes,
high cheekbones], [outfit: black #1A1A2E Victorian dress, silver moon pendant],
[signature items: silver moon pendant, lace gloves],
[palette: #1A1A2E, #F5E6D3, #4A7C59, #C0C0C0]
```

This gives Imagen specific, unambiguous visual targets instead of subjective descriptions like "pretty woman in dark clothing."

**2. Anti-Drift Anchoring**

Between the character block and scene composition, we inject:

> "IMPORTANT: Render each character EXACTLY as described above - same colors, same outfit, same signature items. Do not alter, omit, or reinterpret any character detail."

This explicit instruction fights the tendency of image models to "drift" from reference descriptions, especially in complex multi-character scenes.

**3. Richer Art Style Suffixes**

Each art style suffix expanded from ~6 words to ~22 words with rendering-specific details:

| Style | Before | After |
|-------|--------|-------|
| Cinematic | "cinematic digital painting, highly detailed, dramatic lighting" | "cinematic digital painting, highly detailed, dramatic volumetric lighting, depth of field, rich color grading, photorealistic textures, 8k render quality, concept art style, atmospheric perspective" |
| Watercolor | "watercolor illustration, soft washes, delicate brushstrokes" | "traditional watercolor illustration, soft translucent washes, visible paper texture, delicate wet-on-wet brushstrokes, gentle color bleeding at edges, hand-painted look, luminous highlights, muted pastel palette" |

**4. Consistency Anchors in Scene Composition**

The scene composer prompt now instructs Gemini to explicitly mention distinguishing accessories and props by name ("Luna's red scarf", "Kai's wooden staff"), reference the same location names across scenes, and use consistent time-of-day/weather cues.

**5. Language-Aware Titles**

Title generation was hardcoded to "children's story" and always produced English titles - even for Hindi or Japanese stories. Now `gen_title()` accepts a language parameter, and non-English stories get titles in their native language.

---

## Lessons Learned

### 1. Prompt Engineering is Architecture

The difference between "write an image prompt" and our hybrid construction pipeline is the difference between inconsistent images and visual coherence. The prompt isn't just a string - it's a carefully designed data pipeline with filtering, concatenation, and style injection.

### 2. Streaming Changes Everything

Progressive rendering transforms the UX from "waiting for a black box" to "watching creation happen." Text flowing in, images painting, audio appearing - it feels collaborative, not transactional.

### 3. ADK's Agent Composition is Powerful

Google's ADK let us compose agents like LEGO blocks. `SequentialAgent` for ordering dependencies, `ParallelAgent` for concurrent execution. The shared state pattern (mutable Python object passed by reference) solved the communication problem cleanly.

### 4. The "Tier" Pattern for Async Operations

Any time you have a slow operation that might already be cached/precomputed, the three-tier pattern works beautifully: (1) check cache, (2) check background result, (3) compute on-demand. Saves are instant 90% of the time.

### 5. Safety at the Pipeline Level

Content filtering can't be an afterthought. It needs to be baked into the streaming pipeline - intercepting, not just logging. A single refusal chunk can corrupt the entire frontend state if it reaches the React components.

### 6. Language is a Pipeline Concern

Supporting multiple languages isn't a UI feature - it's an architectural concern that touches every agent. The narrator, TTS, and persistence layer all need language awareness. Making it a field on `SharedPipelineState` (alongside art style) was the cleanest pattern.

### 7. Portals Solve DOM Containment Problems

When UI elements need to visually escape their container (tooltips, modals, dropdown menus), React's `createPortal` + `getBoundingClientRect` is the right pattern. Fixed positioning relative to viewport coordinates sidesteps all CSS containment issues.

### 8. Auto-Extraction Fallbacks Matter

AI models don't always return what you expect. When character extraction returns NONE (unnamed characters, abstract scenarios), having a fallback that re-extracts from the full story text prevents features like portraits from silently failing.

### 9. Modular Code Scales, Monoliths Don't

We started with big files for speed - SceneCard.jsx hit 782 lines, useWebSocket.js hit 462. Every bug fix became an archaeology expedition. Breaking them into focused modules (SceneHeader, SceneImageArea, WritingSkeleton, wsHandlers) made each piece testable and comprehensible in isolation. The rule: if you can't understand a file in one screen, it's too big.

### 10. Regen UX Needs Optimistic Patterns

When users regenerate a scene, the naive approach (clear → loading → new) creates jarring flashes. The better pattern: keep the old content visible with a loading overlay, replace atomically when the new content arrives. If generation fails, the old content is still there. Same philosophy as optimistic UI updates in collaborative apps.

### 11. Denormalize for Instant UI

Social features taught us that subcollection queries (even fast ones) create visible pop-in. Denormalizing counts (`rating_sum`, `rating_count`, `comment_count`) directly on the parent document means the data arrives with the initial fetch - zero additional round trips, zero delayed rendering.

### 12. Content Filtering is a Two-Layer Problem

A single filter isn't enough. Pre-pipeline validation (Gemini Flash classifier) catches most bad prompts cheaply. But some slip through - the narrator might still produce refusal text in edge cases. Post-generation pattern matching catches these. Both layers are needed, and both must be multilingual.

### 13. Character Consistency Requires Structural Solutions

You can't prompt-engineer your way to consistent characters with a single Gemini call. The solution is structural: separate character extraction from scene composition, prepend descriptions verbatim (no summarization), add anti-drift anchoring, and use hex color codes instead of subjective color names. Each of these individually helps a little; together they transform consistency.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React + Tailwind CSS + Vite | Story canvas, director mode, library, explore |
| Real-time | WebSocket (native) | Stream interleaved output |
| Backend | Python 3.12 + FastAPI + Uvicorn | WebSocket handler, orchestration |
| Agent Framework | Google ADK | Multi-agent orchestration |
| LLM | Gemini 2.0 Flash (Vertex AI) | Story generation, prompt engineering, analysis |
| Image Gen | Imagen 3 (Vertex AI) | Scene illustrations, book covers |
| Voice | Web Audio API + Cloud TTS | Input capture + narration |
| Auth | Firebase Authentication | Google Sign-In |
| Database | Cloud Firestore | Story persistence, user libraries, likes, ratings, comments |
| Storage | Google Cloud Storage | Scene images, cover images |
| PDF Generation | fpdf2 | Storybook PDF export |
| Ambient Audio | Web Audio API | Mood-based background music |
| Live Voice | Gemini 2.0 Flash Live API | Real-time voice brainstorming |
| Hosting | Cloud Run + Firebase Hosting | Containerized deployment |

---

## What's Next

- **Portrait-as-reference pipeline** - Using Imagen 3's subject customization API (`imagen-3.0-capability-001`) to feed character portrait images back as reference images for scene generation, achieving true visual consistency
- **Demo video** for hackathon submission
- **Firebase Hosting** - deploy frontend SPA
- **Cloud Run** - deploy backend container

---

## Try It

StoryForge is open source: [github.com/Dileep2896/storyforge](https://github.com/Dileep2896/storyforge)

Built for the Gemini Live Agent Challenge - Creative Storyteller Track.

*Describe a story. Watch it come alive.*
