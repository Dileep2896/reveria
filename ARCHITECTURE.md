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
- `/` — Empty canvas (new story prompt)
- `/story/:storyId` — Story view (redirected here automatically when storyId is set)
- `/story/:storyId?page=N` — Story at specific page (persists across reload)
- `/library` — User's saved/draft stories
- `/explore` — Public stories from all users

### URL ↔ State Sync
- **storyId → URL**: Effect in App.jsx navigates to `/story/:id` when storyId changes (replace)
- **URL → story load**: `useActiveStory(user, urlStoryId)` loads story from URL on boot
- **Page → URL**: `StoryCanvas` updates `?page=N` via `history.replaceState` on every flip
- **URL → page**: `initialPageRef` reads `?page` on mount → sets `startPage` + `currentPage` (no flash)
- Navigation: Library/Explore back buttons → `/story/:id`, New Story → `/`, Logo → `/story/:id`

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
- On `ws.onopen`, sends `resume` with `storyIdRef.current` (handles reconnects for newly created stories)

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
   c. `asyncio.create_task(_generate_image(scene))` — rate-limited by `Semaphore(1)`
   d. `asyncio.create_task(_generate_audio(scene))`
   e. `asyncio.create_task(_director_live(scene))` — per-scene commentary
3. After narrator loop: `await asyncio.gather(*pending_tasks)`
4. Between scenes: check `steering_queue`, inject into narrator history

### Mid-Generation Steering
- Frontend sends `{ type: "steer", content: text }` via WebSocket
- `main.py` pushes to `shared_state.steering_queue` and sends `steer_ack`
- `NarratorADKAgent` pops from queue between scenes, injects `types.Content(role="user")` into narrator history
- Next scene picks up steering via history-based continuity
- ControlBar stays active during generation (steer mode with compass icon)

### Live Director Commentary (Director-as-Driver)
- `director.analyze_scene(scene_text, scene_number, user_prompt, art_style, story_context)`
- Returns JSON: `{ scene_number, thought, mood, tension_level, craft_note, emoji, suggestion }`
- `suggestion`: bold creative direction for what should happen next (cross-batch influence)
- Uses `gemini-2.0-flash`, temp 0.3, 300 max tokens, `response_mime_type="application/json"`
- Sent as `director_live` WS message; frontend shows animated cards in DirectorPanel
- Full director analysis still runs post-batch via `DirectorADKAgent`
- **Cross-batch influence**: `suggestion` stored on `SharedPipelineState.director_suggestion`. At the start of each new batch, `NarratorADKAgent._run_async_impl` prepends `[Director's creative direction: ...]` to narrator input if set, then clears it. Director analysis of batch N shapes batch N+1.

### WS Message Types (New)
- `director_live`: per-scene director commentary during generation
- `steer`: client → server steering command
- `steer_ack`: server → client confirmation of steering applied

### Playful Safety Redirect
- Narrator system prompt: in-character redirect for inappropriate content ("That part of the library is forbidden!")
- `ws_callback` softened: `safety` refusals let narrator redirect play through; only `offtopic` hard-aborts

## Director Chat (Gemini Live API) — Session 55

### Backend: `services/director_chat.py`
- **Model**: `gemini-live-2.5-flash-native-audio` (persistent bidirectional audio session)
- `DirectorChatSession` class manages Gemini Live session lifecycle
- `start(story_context, language, voice_name)`: Opens Live session, sends greeting prompt, returns WAV data URL
- `send_audio(audio_bytes, mime_type)`: Sends user audio, returns Director's audio response
- `send_text(text)`: Sends user text, returns Director's audio response
- `detect_intent(user_text)`: Gemini Flash (temp 0) classifies intent as `generate` or `continue` with confidence score
- `suggest_prompt(story_context)`: Gemini Flash (temp 0.7) generates 2-3 sentence story prompt from conversation
- `close()`: Closes Live session via `__aexit__`
- Audio pipeline: `_collect_audio()` gathers PCM chunks → `_pcm_to_wav()` wraps in WAV header → base64 data URL
- Language-adaptive: Director matches user's spoken language naturally; story prompts locked to story language via `_build_suggest_prompt_system(language)`
- Voice configurable: `voice_name` param passed to `prebuilt_voice_config` in Live session config

### WS Message Types
- `director_chat_start`: `{story_context, language?, voice_name?}` → opens session, returns `director_chat_greeting` with `audio_url`
- `director_chat_audio`: `{audio_data (base64), mime_type}` → sends to Live, returns `director_chat_response` with `audio_url`
- `director_chat_text`: `{content}` → sends text to Live, returns `director_chat_response` with `audio_url` + intent detection
- `director_chat_suggest`: `{story_context}` → returns `director_chat_prompt` with suggested prompt text
- `director_chat_end`: Closes session
- Auto-generate flow: Intent detection analyzes BOTH user message + transcribed Director response; requires Director to have finished exploring (not asking questions) + user confirmation; confidence threshold 0.8

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
