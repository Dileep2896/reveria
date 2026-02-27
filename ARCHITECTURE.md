# StoryForge Architecture Notes

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
- **URL → page**: `initialPageRef` reads `?page` on mount → sets `startPage` + `currentPage` (no flash)
- **Trailing slash normalization**: `pathname.replace(/\/+$/, '') || '/'` applied in App.jsx and useAppEffects.js
- **SPA navigation**: All internal links use `<Link>` or `navigate()` (no `<a href>` causing full page reloads)
- Navigation: Library/Explore back buttons → `ROUTES.STORY(id)`, New Story → `ROUTES.HOME`, Logo → `ROUTES.STORY(id)`

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

## Character Portraits (Auto-Generated)

### Backend Flow
- After each story batch persist + meta task, `main.py` reads existing portrait names from Firestore
- Spawns `_generate_portraits(existing_names=...)` as background task
- `portrait_service.py` filters characters by `existing_names` (case-insensitive) — only new characters get portraits
- Sends `portraits_loading` WS message at start, individual `portrait` messages, then `portraits_done`
- GCS index: `900 + len(existing_names) + idx` to avoid overwriting existing portrait files
- Firestore persistence: reads old `portraits` array, appends new results, merges back

### Frontend
- `PortraitGallery` — no Generate/Regenerate button; renders when portraits exist or loading
- `wsHandlers.js` handles `portraits_loading` → `setPortraitsLoading(true)`, `portraits_done` → `false`
- `sendPortraitRequest` removed from `useWebSocket`; manual WS handler in `main.py` kept as dead code

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
   c. `asyncio.create_task(_generate_image(scene))` — rate-limited by module-level `Semaphore(1)` in `imagen_client.py`
   d. `asyncio.create_task(_generate_audio(scene))`
   e. `asyncio.create_task(_director_live(scene))` — **only when `director_enabled=True`**
3. After narrator loop: `await asyncio.gather(*pending_tasks)`
4. Between scenes: check `steering_queue` (`asyncio.Queue`), inject into narrator history

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
- `generation_wrapup(scene_count)`: Post-generation wrap-up — Director summarizes and invites continuation. Lock-wrapped. Strips `tool_calls`.
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
  │   ├── SKIP standalone live_commentary()
  │   └── proactive_comment(scene_text) → same Live session reacts
  │       └── Audio sent as director_chat_response (plays in chat thread)
  ├── Pipeline done → generation_wrapup(scene_count)
  │   └── Director summarizes + asks "what next?" → audio in chat
  └── Frontend orb auto-resumes recording after 800ms
```

#### Backend Changes
- `SharedPipelineState.director_enabled`: Set from `from_director` message flag; gates all Director work
- `SharedPipelineState.director_chat_session`: Only set when `director_enabled=True`
- `_director_live()` in orchestrator: only fires when `director_enabled=True`. Checks `s.director_chat_session`; if active, routes voice through `proactive_comment()` instead of `live_commentary()`. Falls back to standalone on failure.
- `main.py`: passes `director_chat=director_chat` + `director_enabled=from_director` kwargs to `_run_adk_pipeline()`; calls `generation_wrapup()` after persist + batch_index increment (only when `from_director=True`)

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

### Frontend: Settings Dialog
- `SettingsDialog.jsx`: Theme toggle (Light/Dark) + Director voice selection (8 voices in 2-column grid)
- Voice preference: `localStorage('storyforge-director-voice')`, default `Charon`
- `App.jsx`: `settingsOpen` state, `directorVoice` state, `handleSetDirectorVoice` callback
- `AppHeader.jsx`: Settings gear icon replaces theme toggle button (both admin and main headers)
- Voices: Charon, Kore, Fenrir, Aoede, Puck, Orus, Leda, Zephyr

### Gemini Native Audio (Story Narration)
- `services/gemini_tts.py` replaces Cloud TTS — uses `gemini-2.5-flash-native-audio` via Live API
- System prompt: "Professional audiobook narrator — vary tone to match mood, dramatic for tense moments, gentle for quiet scenes"
- Per-language voices: Kore (English/Spanish/Hindi/Portuguese), Leda (French), Orus (German), Aoede (Japanese/Chinese)
- Returns `(data_url, None)` — no word-level timestamps (ReadingMode uses heuristic fallback)
- Used by: `orchestrator._generate_audio()` and `handlers/scene_actions.py` (scene regen)

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

## Director Chat Security Enhancements

### Audio Screening Tool-Call Suppression
- `director_chat.py` `send_audio()`: When post-screening fails AND `result["tool_calls"]` is non-empty, calls `_reject_tool_call()` for each tool call, returns with `tool_calls: []`
- `_reject_tool_call(tc)`: Sends rejection `FunctionResponse` + consumes model's ack. Called inside `_session_lock`.

### Tool Call Prompt Screening
- `director_chat_handlers.py`: Before processing `generate_story` tool call, runs `_screen_input()` on the prompt argument.
- If flagged: rejects via `respond_to_tool_call(tc, success=False)` — model gets cancellation reason.
- Applied to both `handle_director_chat_audio` and `handle_director_chat_text`.

## Future Work

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
