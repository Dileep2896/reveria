# Reveria Architecture Notes

## Book Meta Generation (Title + Cover)

### Endpoint: `POST /api/generate-book-meta`
- Auth: `Authorization: Bearer <firebase-id-token>`
- Input: `{ scene_texts: string[], art_style: string, story_id: string }`
- Output: `{ title: string, cover_image_url: string | null }`
- Title: Gemini generates max 4 words, fallback "Untitled"
- Cover: Gemini creates image prompt → Imagen generates 3:4 portrait → uploads to GCS `stories/{id}/cover.png`
- Title + cover run concurrently via `asyncio.gather`

### Auto-Generation (Background Task)
- Triggered after first batch (`batch_index == 0`) completes in WebSocket handler
- `asyncio.create_task(_auto_generate_meta(...))` runs in background
- Reuses `_gen_title()` and `_gen_cover()` helpers shared with REST endpoint
- Race guard: checks `title_generated` flag before writing to Firestore
- Falls back to first scene image if cover generation fails

### Frontend Save Flows
1. **handleSave** (Save button click):
   - Reads Firestore doc → checks `title_generated` flag
   - If already generated: just set `status: 'saved'` + `updated_at` (fast path)
   - If not: call `/api/generate-book-meta` → write title + cover + `title_generated: true`
   - Button states: Save → "Generating cover..." → "Saving..." → "Saved!"

2. **autoSaveCurrent** (switching books / New Story / Library nav / Explore nav):
   - Same logic but no visual feedback (no button state changes)
   - Called from: `handleOpenBook`, "New Story" button, Library/Explore nav (async + awaited)

### Critical Rule
When `title_generated` is true, NEVER overwrite `title` or `cover_image_url`. Only update `status` and `updated_at`.

## Routing

All route paths are centralized in `src/routes.js` as the `ROUTES` constant — single source of truth for all navigation, `<Route path>` definitions, `navigate()` calls, `<Link to>` targets, and `pathname.startsWith()` checks.

```js
export const ROUTES = {
  HOME: '/',
  STORY: (id) => `/story/${id}`,
  STORY_PREFIX: '/story/',
  LIBRARY: '/library',
  EXPLORE: '/explore',
  BOOK: (id) => `/book/${id}`,
  BOOK_PREFIX: '/book/',
  SUBSCRIPTION: '/subscription',
  TERMS: '/terms',
  ADMIN: '/admin',
};
```

- `/` — Empty canvas (new story prompt)
- `/story/:storyId` — Story view (redirected here automatically when storyId is set)
- `/story/:storyId?page=N` — Story at specific page (persists across reload)
- `/library` — User's saved/draft stories
- `/explore` — Public stories from all users
- `/book/:storyId` — Public BookDetailsPage (likes, ratings, comments)
- `/subscription` — Subscription tier page
- `/terms` — Terms of Service
- `/admin` — Admin dashboard (admin-only)

### URL ↔ State Sync
- **storyId → URL**: Effect in useAppEffects.js navigates to `ROUTES.STORY(storyId)` when storyId changes (replace)
- **URL → story load**: `useActiveStory(user, urlStoryId)` loads story from URL on boot
- **Page → URL**: `StoryCanvas` updates `?page=N` via `history.replaceState` on every flip
- **URL → page**: `initialPageRef` reads `?page` on mount. New stories (no `/story/:id` in URL) start at page 0 (cover); resumed stories start at page 1 or URL `?page=N`
- **Trailing slash normalization**: `pathname.replace(/\/+$/, '') || '/'` applied in App.jsx and useAppEffects.js
- **SPA navigation**: All internal links use `<Link>` or `navigate()` (no `<a href>` causing full page reloads)
- Navigation: Library/Explore back buttons → `ROUTES.STORY(id)`, New Story → `ROUTES.HOME`, Logo → `ROUTES.STORY(id)`

### Cinematic Book Opening (First Prompt)
When a user sends their first prompt, the transition is cinematic rather than a hard cut:
1. **T=0** (Send pressed): Idle BookCover starts pulsing violet glow (`tc-idle-preparing` class, `idleCoverPulse` animation)
2. **T≈500-1000ms** (`generating=true`): HTMLFlipBook mounts on **cover page** (page 0). Cover shows faux spine (14px `::before` on `.stf__wrapper`), left-page clip-path (`inset(0 0 0 50%)`) hides blank left page, book shadow visible. Shimmer overlay + icon pulse. Entrance animation plays (600ms `bookEntrance` with brightness bloom at 50%)
3. **T≈350ms**: `flip(1)` fires — overlaps with entrance animation for one fluid motion. `setCurrentPage(1)` removes `book-cover-centered` class: clip-path opens (0.5s), wrapper slides right (0.8s), faux spine unmounts
4. **T≈800-1500ms**: First scene text arrives on left page, page flip animation (700ms) completes

Key implementation:
- Faux spine: CSS `::before` on `.stf__wrapper` with `overflow: visible`, 14px gradient matching template spine color
- Left-page clip: `.book-cover-centered .stf__wrapper { clip-path: inset(0 0 0 50%); }` — reveals via transition when class removed
- Center offset: `translateX(calc(var(--book-page-w) * -0.5 - 7px))` accounts for spine width
- `firstGenFlipDone` ref in `StoryCanvas` tracks the cover→content flip; scene 2+ uses standard flip logic
- `useStoryNavigation` accepts `generating` flag — suppresses cover-bounce during generation
- Resumed stories (`/story/:id`) skip the cover entirely (start at page 1)
- Post-generation remount (`canvasKey` changes) resets with `scenes.length > 0` → `startPage=1`

## Image Error Handling

### Backend Pipeline
- `imagen_client.generate_image()` returns `(data_url, error_reason)` tuple
- `illustrator.generate_for_scene()` propagates the tuple
- Error reasons: `quota_exhausted`, `safety_filter`, `timeout`, `generation_failed`, `prompt_failed`
- `image_error` WS messages include `reason` field

### Frontend Display
- `useWebSocket` stores `image_error_reason` on scene object
- `SceneCard`: shows `SceneRevealed` as soon as `scene.text` exists (doesn't wait for image)
- `SceneRevealed`: `noImage` flag (`!scene.image_url && !isError`) triggers text reveal immediately
- Error messages: quota → "Image quota reached — try again later", safety → "Image blocked by safety filter", timeout → "Image generation timed out", default → "Illustration unavailable"
- Preloaded scenes with null image_url show "Illustration unavailable" placeholder (not shimmer)

## WebSocket Reconnection
- `storyIdRef` in `useWebSocket` tracks current story ID (stays in sync via `story_id` message + `load()` + `reset()`)
- On `ws.onopen`, sends `{type:'auth', token}` first (first-message auth), then `resume` with `storyIdRef.current` (handles reconnects for newly created stories)

## Firestore Document Structure (stories collection)

### Top-level fields
- `uid`, `status` (draft/saved/deleted), `created_at`, `updated_at`
- `title`, `cover_image_url`, `title_generated` (set by save flows or auto-gen)
- `art_style`, `total_scene_count`, `narrator_history`, `illustrator_state`
- `is_public`, `published_at`, `author_name`, `author_photo_url` (set by publish)

### Subcollections
- `scenes/{scene_number}`: text, image_url, audio_url, prompt, batch_index
- `generations/{batch_index}`: prompt, director_data, scene_numbers[]

### Status Management
- `useActiveStory` queries `status in ['draft', 'saved']` (not just draft)
- `handleOpenBook` only updates `updated_at` (never flips status)
- Status only changes explicitly: Save button → 'saved', publish → public
- **Delete resilience**: `routers/stories.py` wraps `decrement_usage` in try/except so transient Firestore gRPC errors ("Stream removed") don't 500 the delete response after successful deletion

### Story Loading & Director State Hydration
- Two code paths load stories: `useActiveStory` (page load/reload) via `loadStoryById()`, and Library click via `handleOpen` → `load()`. Both must include all generation fields (`directorData`, `directorLiveNotes`, `sceneNumbers`).
- `LibraryPage.jsx` `handleOpen` reads full generation data from Firestore (including `directorData`, `directorLiveNotes`, `sceneNumbers`) and passes it through `load()` in `useWebSocket`
- `load()` and the initial hydration effect in `useWebSocket` both hydrate `directorData` (standalone state) and `directorLiveNotes` from persisted generations
- If either path omits generation fields, the Director panel will appear empty after loading a previously generated story

## Composite Indexes Required
1. `stories`: (uid ASC, status ASC, updated_at DESC) — Library page
2. `stories`: (is_public ASC, published_at DESC) — Explore page

## Character Portraits & Visual DNA

### Anchor Portraits
- Generated BEFORE scene images in `narrator_agent.py`
- Imagen generates portrait → Gemini Vision analyzes → visual DNA stored on `illustrator._visual_dna[name_lower]`
- Hero character skipped for anchor portraits; post-batch portraits dedup against anchors
- Firestore persist: `ArrayUnion` on story doc `portraits` field. GCS index: `900 + idx` for anchors

### Visual DNA
- `analyze_visual_dna()` extracts 100-150 word natural-language description from portrait (temp 0.1, 250 tokens)
- Prefers visual DNA over raw character sheet lines for scene prompts
- State persistence: `_visual_dna` dict serialized via `illustrator.serialize_state()`. `_anchor_portraits` transient (cleared on restore)

### Portrait Detection (Face-Crop from Scene Images)
- `detect_and_crop_portraits()`: sends scene image + character names to Gemini Vision
- Gemini returns bounding boxes for character upper-body regions (`CHARACTER_REGION_INSTRUCTION`)
- Pillow crops + pads to 512x512 square portraits
- Guaranteed visual consistency (portrait IS the scene character), zero extra Imagen calls

### Frontend
- `PortraitGallery.jsx`: horizontal scroll layout (`overflowX: auto`), shows only when portraits exist or loading

## GCS Structure
- Scene media: `stories/{story_id}/scenes/{scene_number}/{image|audio}.{ext}`
- Book cover: `stories/{story_id}/cover.png`

## User Avatar System

`UserAvatar.jsx` — reusable component for all avatar displays across the app:
- If `photoURL` exists → renders `<img>` with the photo
- If no photo → renders a `boring-avatars` marble gradient SVG, seeded by user's display name (deterministic — same name = same avatar)
- Color palette: `['#f59e0b', '#a78bfa', '#6366f1', '#ec4899', '#14b8a6']` — matches app accent theme
- Used in: ProfileMenu (header 28px + dropdown 36px), ExplorePage (24px), BookDetailsPage (28px), BookCommentSection (28px), AdminUserTable (32px), UserDetailModal (56px)
- Zero network requests — renders client-side as SVG via the `boring-avatars` package

## Per-Scene Streaming Pipeline (Session 54)

### Pipeline Structure
- `SequentialAgent`: `NarratorADKAgent` → `PostNarrationAgent` (only `DirectorADKAgent` for full analysis)
- `IllustratorADKAgent` and `TTSADKAgent` removed as separate agents
- Image, audio, and live director tasks fire per-scene inside `NarratorADKAgent._run_async_impl`

### NarratorADKAgent Per-Scene Loop
1. Narrator streams text, scenes parsed as they complete
2. For each completed scene → `_on_scene_ready()`:
   a. Send scene text via `ws_callback`
   b. Extract characters once (first scene only) via `illustrator.extract_characters()`
   c. **Visual narrative templates** (comic/manga/webtoon): `asyncio.create_task(_generate_image_then_audio(scene))` — sequential: image first, then audio from overlay text only
   d. **Storybook templates**: `asyncio.create_task(_generate_image(scene))` + `asyncio.create_task(_generate_audio(scene))` — parallel
   e. `asyncio.create_task(_director_live(scene))` — **only when `director_enabled=True`**
3. After narrator loop: `await asyncio.gather(*pending_tasks)`
4. Between scenes: check `steering_queue` (`asyncio.Queue`), inject into narrator history

### Visual Narrative Pipeline (Comic/Manga/Webtoon)
Visual narrative templates use a different per-scene flow than storybook:
- **Scene composition**: `VISUAL_NARRATIVE_SCENE_COMPOSER_INSTRUCTION` classifies scenes as character-present vs. setting-only, applies different composition rules (characters 60%+ of frame for character scenes)
- **Character fallback**: If character identification returns empty but scene has dialog or character name references, full character sheet is injected
- **Prompt structure**: Text-free prefix → Characters → scene composition → art style (with `text-free panel art`) → negative constraints at END
- **Text-free image enforcement (triple layer defense)**:
  1. **Scene composer instruction**: `ABSOLUTELY NO TEXT IN THE IMAGE` rule in `VISUAL_NARRATIVE_SCENE_COMPOSER_INSTRUCTION`
  2. **Imagen prompt prefix**: `"Clean illustration without any text, speech bubbles, captions, or written words."` at START of prompt (Imagen weights beginning most)
  3. **Art style suffix**: All comic/manga/webtoon styles include `"text-free panel art"` (e.g. `classic_comic`, `shonen_manga`, `romantic_webtoon`, etc.)
  4. **Negative constraints**: `[NO text, NO speech bubbles, NO dialog bubbles, NO captions, NO letters, NO words, NO writing, NO sound effects]` at end
- **Sequential image→audio**: Audio waits for image generation to complete, then builds TTS script from overlay text only (~20 words), not full scene prose (~50 words)
- **Split DNA**: Character descriptions split into physical traits (permanent) vs. style traits (outfit, changeable). When scene text contains outfit-change keywords, style traits are stripped to avoid conflicts

### Split DNA (Character Description Filtering)
`illustrator._filter_character_descriptions()` accepts `scene_text` parameter:
- Regex detects outfit-change keywords: `wearing`, `donned`, `changed into`, `disguise`, `armor`, `costume`, etc.
- When detected: strips `[outfit: ...]`, `[signature items: ...]`, `[clothing: ...]` bracketed sections from character descriptions
- Physical traits (face, hair, skin, build) always preserved
- Prevents image prompt conflicts when narrative describes clothing changes

### Image Composition Strategy
The image pipeline separates character definition from scene composition:

**Character DNA (one-time extraction)**
- `illustrator.extract_characters()` runs once on first scene completion
- Gemini analyzes full narrative → character descriptions (hex color codes, face shape, signature items, dominant palette)
- Character sheet extracted once per story to maintain visual consistency across all scenes

**Scene Composition (per-scene)**
- `SCENE_COMPOSER_WITH_CHARACTERS_INSTRUCTION` balances two goals:
  1. Show what the narrative describes: if text mentions an email, show the screen; if a chase, show the streets
  2. Weave character appearance naturally into the scene, not as an isolated portrait
- Structured prompt: SCENE FRAMING → ENVIRONMENT & ACTION → CHARACTERS IN SCENE → MOOD & LIGHTING
- Word limit: 100 words (environment/action ≥ 50% of prompt)
- Prevents portrait bloat: "Do NOT make every image a portrait or close-up of a character's face"
- Encourages compositional variety: camera angles, framing, and environmental focus shift per scene

**Imagen Execution**
- Character DNA prepended verbatim to scene composition prompt
- Anti-drift anchor between character block and scene composition
- Per-user Imagen semaphore serializes all calls (prevents quota contention)

### Mid-Generation Steering
- Frontend sends `{ type: "steer", content: text }` via WebSocket
- `main.py` pushes to `shared_state.steering_queue` (`asyncio.Queue`) via `.put_nowait()` and sends `steer_ack`
- `NarratorADKAgent` checks queue between scenes with `.get_nowait()`, injects `types.Content(role="user")` into narrator history
- Next scene picks up steering via history-based continuity
- ControlBar stays active during generation (steer mode with compass icon)

### Live Director Commentary (Director-as-Driver) — Director-Triggered Only
- **Only fires when `SharedPipelineState.director_enabled=True`** (set from `from_director` message flag)
- `director.analyze_scene(scene_text, scene_number, user_prompt, art_style, story_context)`
- Returns JSON: `{ scene_number, thought, mood, tension_level, craft_note, emoji, suggestion }`
- `suggestion`: bold creative direction for what should happen next (cross-batch influence)
- Uses `gemini-2.0-flash`, temp 0.3, 300 max tokens, `response_mime_type="application/json"`
- Sent as `director_live` WS message; frontend shows animated cards in DirectorPanel
- Full director analysis still runs post-batch via `DirectorADKAgent` (also gated on `director_enabled`)
- **Cross-batch influence**: `suggestion` stored on `SharedPipelineState.director_suggestion`. Injected into narrator input at start of next batch only when `director_enabled` is True.
- **Director Chat routing**: When `director_chat_session` is active, `_director_live()` skips standalone `live_commentary()` and routes voice through `proactive_comment()` instead. Structured data (`director_live` WS message) still sent either way.

### ControlBar vs Director Generation (Separated)
- **ControlBar generation** (`from_director=false`, default): Narrator + Illustrator + TTS only. No Director involvement — no `analyze_scene()`, no `live_commentary()`, no post-batch `analyze()`, no `proactive_comment()`, no `generation_wrapup()`.
- **Director-triggered generation** (`from_director=true`): Full pipeline with all Director features.
- Frontend: `directorAutoGenerate` effect in `App.jsx` sends `fromDirector: true` in send options → `useWebSocket.js` maps to `msg.from_director` in the WS message.
- Backend: `main.py` reads `from_director` from message, passes as `director_enabled` kwarg to `_run_adk_pipeline()`. Sets `shared_state.director_enabled` and only passes `director_chat_session` when enabled.
- Gating points: suggestion injection (orchestrator), `_director_live()` task creation, `DirectorADKAgent._run_async_impl`, `generation_wrapup` in main.py.

### WS Message Types (New)
- `director_live`: per-scene director commentary during generation
- `steer`: client → server steering command
- `steer_ack`: server → client confirmation of steering applied

### Playful Safety Redirect
- Narrator system prompt: in-character redirect for inappropriate content ("That part of the library is forbidden!")
- `ws_callback` softened: `safety` refusals let narrator redirect play through; only `offtopic` hard-aborts

## Director Chat (Gemini Live API) — Rewritten with Native Features

### Backend: `services/director_chat.py`
- **Model**: `gemini-live-2.5-flash-native-audio` (persistent bidirectional audio session)
- `DirectorChatSession` class manages Gemini Live session lifecycle
- **`_session_lock`** (`asyncio.Lock`): Serializes all Live session access — prevents concurrent sends (e.g. two scenes completing close together, or rapid user messages from network jitter)
- **Typed `LiveConnectConfig`** with native features:
  - `tools=[Tool(function_declarations=[GENERATE_STORY_TOOL])]` — model decides when to generate
  - `input_audio_transcription=AudioTranscriptionConfig()` — native user speech transcription
  - `output_audio_transcription=AudioTranscriptionConfig()` — native model speech transcription
  - `context_window_compression=ContextWindowCompressionConfig(sliding_window=SlidingWindow())` — handles long sessions
- `start(story_context, language, voice_name)`: Opens Live session, sends greeting prompt, returns response dict
- `send_audio(audio_bytes, mime_type)`: Sends user audio (lock-wrapped), returns `{audio_url, input_transcript, output_transcript, tool_calls}`
- `send_text(text)`: Sends user text (lock-wrapped), returns same response dict format
- `respond_to_tool_call(tool_call, success)`: Sends `FunctionResponse` back so model can acknowledge (lock-wrapped); returns follow-up audio
- `request_suggestion(story_context)`: Asks the Live session directly for a story prompt (lock-wrapped, no extra API call)
- `proactive_comment(scene_text, scene_number)`: During generation, sends scene to Live session for in-conversation Director reaction. Lock-wrapped. Strips `tool_calls` from response. Returns response dict.
- `generation_wrapup(scene_count, scene_texts)`: Post-generation wrap-up — Director reacts to scene content and invites continuation. Receives actual scene text for context. Lock-wrapped. Strips `tool_calls`.
- `_collect_response(session, timeout)`: Collects audio chunks + native transcriptions + tool calls from receive loop
- `_trim_log()`: Caps `conversation_log` at 20 non-system entries (prevents unbounded growth)
- `close()`: Closes Live session via `__aexit__`
- Audio pipeline: `_collect_audio()` (voice preview only) gathers PCM chunks → `_pcm_to_wav()` → base64 data URL
- Language-adaptive: Director matches user's spoken language naturally
- Voice configurable: `voice_name` param passed to `prebuilt_voice_config` in Live session config
- **Session lifecycle**: `main.py` closes any existing session before creating a new one on `director_chat_start` (prevents orphaned Gemini API connections)

### GENERATE_STORY_TOOL (Function Declaration)
- Declared at module level, included in Live session config
- Model calls it ONLY when brainstorming is complete + user confirmed + not still asking questions
- Returns `{prompt: "vivid 2-3 sentence story prompt"}` in the tool call args
- System prompt includes explicit tool usage instructions with strict conditions
- ~60-70% reliability in audio mode; manual "Suggest" button via `request_suggestion()` as fallback

### What Was Eliminated (vs. Previous Architecture)
| Before | After |
|--------|-------|
| `detect_intent()` — Gemini Flash call per interaction | Native tool calling (model decides) |
| `suggest_prompt()` — Gemini Flash call when generating | Tool call includes the prompt |
| User audio transcription — `transcribe_audio()` per message | Native `input_audio_transcription` |
| Director audio transcription — `transcribe_audio()` per message | Native `output_audio_transcription` |
| `generation_triggered` flag (racy, never resets) | Gone — model handles atomically |
| 3-5 extra API calls per interaction | 0 extra calls |
| Unbounded `conversation_log` | Capped at 20 entries + API-level context compression |

### WS Message Types
- `director_chat_start`: `{story_context, language?, voice_name?}` → opens session, returns `director_chat_started` with `audio_url`
- `director_chat_audio`: `{audio_data (base64), mime_type}` → sends to Live, returns `director_chat_response` with `audio_url` + `director_chat_user_transcript` (from native transcription) + optionally `director_chat_generate` (if tool called)
- `director_chat_text`: `{content}` → sends text to Live, returns `director_chat_response` with `audio_url` + optionally `director_chat_generate`
- `director_chat_suggest`: `{story_context}` → asks Live session for prompt → returns `director_chat_suggestion`
- `director_chat_cancel_generate`: Logs cancellation (no flag to reset)
- `director_chat_end`: Closes session
- Auto-generate flow: Model calls `generate_story` tool → handler sends `FunctionResponse` → model says "Generating!" → `director_chat_generate` sent to frontend with prompt/art_style/scene_count/language

### Seamless Director Chat During Generation

When Director Chat is active and the user triggers generation (via `generate_story` tool call, which sets `from_director=true`), the Director stays engaged throughout:

#### Flow
```
Director Chat active → generate_story tool fires → generation starts
  ├── Frontend orb → "watching" state (eye icon + accent-primary pulse)
  ├── Scene N text completes:
  │   ├── analyze_scene() runs (structured data: mood, tension, emoji, suggestion)
  │   ├── SKIP standalone live_commentary() (no per-scene voice)
  │   └── SKIP proactive_comment() — prevents audio overlap with wrapup
  ├── Pipeline done → generation_wrapup(scene_count, scene_texts)
  │   └── Director reacts to scene + asks "what next?" → single audio in chat
  └── Frontend orb auto-resumes recording after 800ms
```

#### Backend Changes
- `SharedPipelineState.director_enabled`: Set from `from_director` message flag; gates all Director work
- `SharedPipelineState.director_chat_session`: Only set when `director_enabled=True`
- `_director_live()` in orchestrator: only fires when `director_enabled=True`. When `director_chat_session` is active, per-scene voice (`proactive_comment()` and `live_commentary()`) is SKIPPED — only `generation_wrapup()` provides voice. Structured data (`director_live` WS message) still sent either way.
- `main.py`: passes `director_chat=director_chat` + `director_enabled=from_director` kwargs to `_run_adk_pipeline()`; calls `generation_wrapup(scene_count, scene_texts)` after persist + batch_index increment (only when `from_director=True`)

#### Frontend Changes
- `DirectorChat.jsx`: new `generating` prop → `watching` orbState; auto-resume suppressed during generation; auto-resumes 800ms after generation ends via `prevGenerating` ref
- `DirectorPanel.jsx`: forwards `generating` to DirectorChat; live note auto-play suppressed when `chatActive` (audio comes through chat thread instead)
- `director-panel.css`: `.watching` orb styles — accent-primary rings, spinning animation, pulsing glow, eye icon animation

#### Edge Cases
- ControlBar generation (`from_director=false`): zero Director involvement — just narrator + images + audio
- Director Chat NOT active but `from_director=true`: standalone `analyze_scene()` + `live_commentary()` flow runs
- `proactive_comment()` failure: falls back to standalone `live_commentary()` for that scene
- Accidental tool calls during proactive comment: stripped from result (`result["tool_calls"] = []`)
- Session lock contention: scenes queue up rather than racing
- Wrap-up only fires when `current_batch_scenes` is non-empty

### Frontend: VAD (Voice Activity Detection)
- `useVoiceCapture.js`: Web Audio API `AnalyserNode` + `getFloatTimeDomainData()` for RMS computation
- Constants: `SILENCE_THRESHOLD = 0.01`, `SILENCE_DURATION_MS = 1200`, `VAD_POLL_INTERVAL_MS = 100`
- Detects speech → silence transition; auto-stops `MediaRecorder` after 1.2s of continuous silence post-speech
- Graceful degradation: try/catch around AudioContext — manual stop still works if VAD fails

### Book Layout & Scene Count
- **Always spread mode**: `singlePage` hardcoded to `false` in `App.jsx`. Book Layout toggle removed from SettingsDialog. No `bookLayout` state or localStorage.
- **Single scene generation**: Scene count hardcoded to 1 per generation. The "Crafting your story..." generating placeholder is disabled (`const showGenerating = false` in `StoryCanvas.jsx`). Scenes arrive directly on their page without a preview placeholder.

### Frontend: Settings Dialog
- `SettingsDialog.jsx`: Theme toggle (Light/Dark) + Director voice selection (8 voices in 2-column grid)
- Voice preference: `localStorage('storyforge-director-voice')`, default `Charon`
- `App.jsx`: `settingsOpen` state, `directorVoice` state, `handleSetDirectorVoice` callback
- `AppHeader.jsx`: Settings gear icon replaces theme toggle button (both admin and main headers)
- Voices: Charon, Kore, Fenrir, Aoede, Puck, Orus, Leda, Zephyr

### Gemini Native Audio (Story Narration)
- `services/gemini_tts.py` replaces Cloud TTS — uses `gemini-2.5-flash-native-audio` via Live API
- System prompt: Text-to-speech engine with `[SCRIPT]`/`[/SCRIPT]` markers — reads EVERY word exactly as written, no additions or paraphrasing
- Per-language voices: Kore (English/Spanish/Hindi/Portuguese), Leda (French), Orus (German), Aoede (Japanese/Chinese)
- Returns `(data_url, None)` — no word-level timestamps (ReadingMode uses heuristic fallback)
- **Visual narrative TTS**: For comic/manga/webtoon templates, audio reads only the condensed overlay text (~20 words), not the full scene prose (~50 words). Built via `scene["_tts_script"]` from overlay text sorted in reading order.
- Used by: `narrator_agent._generate_audio()` (storybook: parallel with image), `narrator_agent._generate_image_then_audio()` (visual narrative: sequential after image), `handlers/scene_actions.py` (scene regen)

### Voice Preview
- `GET /api/voice-preview/{voice_name}` — creates short-lived Live session, voice says personality-matched intro line
- `VOICE_PREVIEW_LINES` dict: each voice has unique preview text matching its personality
- Frontend: `SettingsDialog.jsx` fetches preview on voice chip click, shows loading spinner → animated audio bars

### Token Expiry Handling
- WS: Close code `4003` signals auth failure; `authFailedRef` prevents infinite retry loop; token change effect reconnects
- REST: `AuthContext.getValidToken()` returns fresh token via `getIdToken()`; used by `useStoryActions` and `BookDetailsPage`

### 404 & Error Boundary
- `NotFoundPage.jsx`: Themed 404 with book icon, "Write a new story" / "Explore stories" buttons
- `ErrorBoundary.jsx`: CSS variable theming with hardcoded fallbacks (theme context may not be available), background orbs, glass card
- Route: Explicit `<Route path="*">` catch-all separate from story canvas routes

## Backend Resilience (Session 55)

### Non-Blocking WebSocket Loop
- `handle_generate` runs as `asyncio.create_task()` — WS loop continues processing steer/director/regen messages during generation
- `generation_task` tracked in WS handler scope; duplicate requests rejected if task still running
- Scene actions (`regen_image`, `regen_scene`, `delete_scene`) accept `is_generating` kwarg — return error if True
- `generation_task` cancelled in `finally` block on disconnect

### Per-User Imagen Circuit Breaker
- `imagen_client._user_quota_exhausted: dict[str, float]` — per-user circuit breaker (keyed by uid, default `"__global__"`)
- On quota exhaustion: `_user_quota_exhausted[uid] = time.monotonic()`. On success: `.pop(uid, None)`
- Retry jitter: `delay = base * (2 ** attempt) + random.uniform(0, base * 0.3)`
- `uid` threaded: `SharedPipelineState.uid` → `NarratorADKAgent` → `illustrator.generate_for_scene(uid=)` → `generate_image(uid=)`

### Centralized Imagen Semaphore
- Module-level lazy `asyncio.Semaphore(1)` in `imagen_client.py` via `_get_semaphore()`
- Wraps entire `generate_image()` body — all callers (narrator, portraits, scene regen, cover) serialized
- Removed: instance `_image_sem` from `NarratorADKAgent`

### Retry Infrastructure
- `utils/retry.py`: `is_transient(exc)` (429/500/503/unavailable/deadline), `with_retries(coro_factory, attempts, skip_exc_types)`
- `gemini_client.py`: `generate_stream` has 3-attempt retry loop for transient errors (NOT `ContentBlockedError`); `transcribe_audio` wrapped in `with_retries()`
- `storage_client.py`: `gcs_retry.Retry(deadline=60.0)` on all `upload_from_string()` and `blob.delete()` calls

### GCS Robustness
- `_make_public_or_sign(blob)`: tries `make_public()`, falls back to 7-day signed URL via `generate_signed_url(version="v4")`
- `delete_story_media`: deletes blobs individually with retry (not batch `bucket.delete_blobs()`)

### Thread-Safe SharedPipelineState
- `steering_queue`: `asyncio.Queue[str]` (was `list[str]`) — `.put_nowait()` in `main.py`, `.get_nowait()` in narrator
- `_live_notes_lock`: `asyncio.Lock()` guards `director_live_notes.append()` and snapshot before `persist_story()`

### Atomic Usage Tracking
- `increment_usage` / `decrement_usage` use `@firestore.async_transactional` — read+check+write inside transaction
- Automatic contention retry (Firestore transactions retry up to 5 times by default)

### Batched Firestore Deletions
- `delete_story` subcollection deletion: 450-doc batches via `db.batch()` (Firestore max 500)
- Loop: stream → `batch.delete(ref)` → `batch.commit()` → break when < 450 docs

### TTS Silence Insertion
- `multi_voice_tts._generate_silence_pcm(duration_ms, sample_rate=24000)` — silent 16-bit LE PCM
- On segment failure: insert proportional silence (`min(max(word_count * 100, 300), 3000)` ms) instead of skipping
- ALL segments fail → single-voice fallback still works

### Efficient Scene Counting
- `scene_actions.py` handle_delete_scene: `.select([]).stream()` for counting remaining scenes (downloads doc refs only, no field data)

## WebSocket Authentication

### First-Message Auth (Preferred)
- Frontend: `new WebSocket(WS_URL)` (no token in URL). In `onopen`, sends `{type:'auth', token}` before resume message.
- Backend: Accepts connection first. If no `?token` query param, waits up to 10s for `{type:'auth', token:'...'}` first message.
- Validates token via `verify_token(token, full=True)`. Closes with 4003 on failure.

### Query Param Auth (Legacy, Backward Compat)
- Backend still checks `websocket.query_params.get("token")` first.
- If present, uses it directly (no first-message wait).
- Deploy order: backend first (supports both), then frontend.

## Interaction-Flow Resilience (Session 59 Audit)

### Director Tool Call During Generation
- When `state.is_generating` is true and Director issues `generate_story` tool call, handlers MUST reject with `respond_to_tool_call(tc, success=False)` — silently dropping corrupts the Gemini Live session (model expects `FunctionResponse` for every tool call)
- Applied to both `handle_director_chat_audio` and `handle_director_chat_text`

### Director Session Expiry Detection
- `send_audio()` / `send_text()` exception handlers set `self._session = None` and return `{"session_dead": True}`
- WS handlers check `result.get("session_dead")` → send `{"type": "director_chat_error", "content": "...", "fatal": True}`
- Frontend `director_chat_error` handler: only tears down chat UI when `data.fatal` is true (transient errors just show toast)

### Non-Blocking Hero Photo Analysis
- `handle_hero_photo` runs as `asyncio.create_task()` — WS loop stays responsive during 30s photo analysis
- Backend version counter (`hero_version`) discards stale analysis results if user removed hero mode while analyzing
- Every exit path (success, failure, timeout, version mismatch) sends `hero_status` WS message to prevent stuck UI
- 30-second `asyncio.wait_for()` timeout on Gemini Vision API call

### Usage Counter Leak Prevention
- `handle_generate` catches `asyncio.CancelledError` (inherits from `BaseException`, not `Exception`) to rollback usage counters on disconnect
- Pre-incremented `generate` and `create_story` usage both decremented in `CancelledError` handler

### Stale Message Guards
- After `reset()`, `storyIdRef.current` is null — all scene-scoped WS handlers (`text`, `image`, `audio`, `scene_deleted`) check this before applying data
- Prevents wrong-story scene data from rendering after story switch

### Frontend Race Condition Guards
- `useSaveStory.js`: Synchronous `saveLockRef` (useRef) prevents double-click save — set before any async work, cleared in `finally`
- `useWebSocket.js`: `sceneBusy` state (regen spinners) cleared on WS disconnect to prevent stuck indicators
- `generation_flow.py`: `shared_state.director_live_notes = []` cleared at pipeline start to prevent cross-batch note duplication
- `DirectorChat.jsx`: 2-second fallback timer auto-resumes recording if browser autoplay policy blocks Director audio

## Director Chat Security Enhancements

### Audio Screening Tool-Call Suppression
- `director_chat.py` `send_audio()`: When post-screening fails AND `result["tool_calls"]` is non-empty, calls `_reject_tool_call()` for each tool call, returns with `tool_calls: []`
- `_reject_tool_call(tc)`: Sends rejection `FunctionResponse` + consumes model's ack. Called inside `_session_lock`.

### Tool Call Prompt Screening
- `director_chat_handlers.py`: Before processing `generate_story` tool call, runs `_screen_input()` on the prompt argument.
- If flagged: rejects via `respond_to_tool_call(tc, success=False)` — model gets cancellation reason.
- Applied to both `handle_director_chat_audio` and `handle_director_chat_text`.

## Future Work

### Character Consistency via Visual Anchor API
- Use Imagen's `ControlReferenceImage` with `CONTROL_TYPE_FACE_MESH` to reference first scene's character render in subsequent scenes
- Dynamic weight adjustment — boost character description weight when visual drift is detected
- Cross-scene visual DNA — extract visual features from generated images and feed back into prompts

### Multi-Voice Narration
- Map characters to Gemini voice presets based on personality traits from Director's character analysis
- Dialogue scenes sound like distinct people instead of one narrator

### Floating Director Orb for Mobile
- Move DirectorChat voice orb out of sidebar into a floating FAB (bottom-right) on mobile
- Tap to expand into bottom-sheet drawer showing live transcript
- Voice input is most natural on mobile — ensures Director Mode is accessible on phones
- Requires: responsive breakpoint detection, draggable FAB component, bottom-sheet animation

### Cinematic Video Scenes (Veo 2)
- Use Google Veo 2 API to generate short video clips for high-tension climax scenes
- Trigger: tension_level >= 8 from Director's analyze_scene()
- Wrap `<video>` in animated golden "Cinematic" border
- Auto-play on page flip, seamless loop, cross-fade over blurred placeholder
- Distinguish video scenes from static illustrations as a narrative reward
- Requires: Veo 2 API integration, video upload to GCS, new WS message type, video player component
