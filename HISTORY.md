# StoryForge Development History

## Week 1 - Foundation

### Day 1 (Feb 18, 2026)

**Session 1: Project Setup & Core Pipeline**

- Initialized monorepo with `/frontend` (React + Vite + Tailwind CSS) and `/backend` (Python 3.12 + FastAPI)
- Created Docker setup with `docker-compose.yml` and Dockerfiles for both services
- Built WebSocket echo endpoint and verified end-to-end communication
- Set up GCP project (`storyforge-hackathon`) with billing, budget alerts ($5 cap), and Vertex AI API enabled
- Created GitHub repo: https://github.com/Dileep2896/storyforge

**Session 2: UI Design & Gemini Integration**

- Designed glassmorphism theme system with centralized CSS custom properties (`theme.css`)
- Implemented dark/light mode with `ThemeContext` and localStorage persistence
- Built frosted glass UI: header, story canvas, director panel, control bar, scene cards
- Created animated StoryForge logo (book + forge sparks in orange/purple/cyan) as React component
- Added custom SVG favicon and updated page title
- Integrated Gemini 2.0 Flash via Vertex AI for story text generation
- Built Narrator agent with streaming support and conversation history
- Wired Narrator into WebSocket endpoint with scene splitting on `[SCENE]` markers
- Added loading states (bouncing dots, disabled input during generation)
- Verified story steering works (e.g. "make it scarier" continues the same narrative)

**Session 3: Imagen 3 Integration & Flipbook**

- Integrated Imagen 3 (`imagen-3.0-generate-002`) for scene illustrations via Vertex AI
- Built Illustrator agent with two-step pipeline:
  - Character sheet extraction from full story text (Gemini, temperature 0.1) for visual consistency
  - Image prompt engineering (Gemini, temperature 0.3) with character sheet enforcement
  - Imagen 3 generation at 16:9 aspect ratio with safety filters
- Concurrent image generation with `asyncio.gather` - all scenes in a batch generate in parallel
- Built interactive flipbook using `react-pageflip` with 22 fixed page slots (1 cover + 21 content)
- Created `SceneCard` component with dual states:
  - `SceneComposing`: shimmer skeleton with gradient animation and "Painting scene" icon
  - `SceneRevealed`: drop-cap letter, sentence-by-sentence text reveal, decorative star divider
- Created `BookNavigation` component with prev/next arrows and dot-based spread indicators
- Implemented cover page with genre quick-start buttons (Mystery, Fantasy, Sci-Fi, Horror, Children's)
- Added `GeneratingContent` state with three-step animated progress indicators
- 6 art style options: Cinematic, Watercolor, Comic Book, Anime, Oil Painting, Pencil Sketch
- Fixed scene count at 2 scenes per generation
- Auto-advance flipbook to new spread on story continuation
- Keyboard navigation (ArrowLeft/ArrowRight, blocked when input focused)
- Page scale CSS variable for proportional font/element sizing

**Session 4: Story Flow & Word Limits**

- Added word limit to Narrator (300 words per scene) to keep content focused
- Added art style selection - pills in ControlBar send style to backend, appended to Imagen prompts
- Genre quick-start pills populate the input field with genre-appropriate starter prompts
- Story continuation - follow-up prompts continue the narrative with new scenes
- New Story button - resets frontend state and backend session (cancels in-flight tasks, clears Narrator history, recreates Illustrator)
- Reset protocol over WebSocket: client sends `{"type": "reset"}`, server acknowledges

**Session 5: Audit & Cleanup**

- Full application audit across frontend, backend, and documentation
- Removed dead backend code:
  - Deleted `models/story_state.py` (unused Pydantic models)
  - Removed `ConnectionManager.send_json()` dead method
  - Removed unused `style` parameter from `imagen_client.py`
  - Moved `asyncio` import to top-level in `imagen_client.py`
  - Removed 5 unused dependencies from `requirements.txt` (google-cloud-aiplatform, google-adk, google-cloud-texttospeech, google-cloud-firestore, aiohttp)
- Pipeline abort on dead connections:
  - `_safe_send()` returns `False` on WebSocket failure
  - `connection_alive` tracking aborts generation pipeline early, saving API budget
- Replaced all 11 `print()` calls with Python `logging` module across `main.py`, `illustrator.py`, `imagen_client.py`
- Frontend cleanup:
  - Removed unused `scenes` prop from `DirectorPanel`
  - Removed dead `directorMessages` branch from `DirectorPanel`
  - Removed unused CSS variables and keyframes from `theme.css`
  - Added explicit `pulse`/`bounce` keyframes in `storybook.css` (not relying on Tailwind)
- Docker production-ready:
  - Frontend Dockerfile: `npm run build` + `serve -s dist` instead of dev server
  - Backend Dockerfile: removed `--reload` flag
  - Added `.dockerignore` files to both services

**Session 6: Responsive UI**

- Made entire UI responsive using CSS `clamp()` for fluid scaling:
  - **Header**: padding, pill sizes, button sizes, theme toggle - all scale with viewport
  - **Director Panel**: width `clamp(220px, 22vw, 320px)`, responsive padding
  - **Control Bar**: all padding, font-sizes, border-radius, icon sizes use `clamp()`
  - **SVG Icons**: replaced hardcoded `width="14" height="14"` with `control-icon` CSS class using `clamp(11px, 1.2vw, 14px)`
  - **Input field**: responsive height `clamp(24px, 3vw, 32px)`
- Director panel hidden on screens < 768px
- Art style label hidden on screens < 768px
- Added responsive styles in `index.css` with named CSS classes

**Session 7: Book Appearance & Image Fix**

- Added book depth shadow on `.stf__wrapper` for a realistic 3D effect
- Added page gutter shadows (inset box-shadows) simulating binding darkness on left/right pages
- Added `book-page-left` and `book-page-right` CSS classes based on page number
- Attempted spine shadow overlay - removed because it stayed visible during page flips
- Attempted page edge thickness layers - reverted per user feedback
- Fixed image edge alignment:
  - Moved `rounded-lg` + `overflow: hidden` to container div instead of `<img>`
  - Removed glass border and box-shadow from images
  - Set container background to `var(--book-page-bg)` to match page color
  - Added `transform: scale(1.04)` to crop out Imagen's baked-in black letterboxing edges
  - Added `display: block` to eliminate inline image gap

**Session 8: Layout Optimization - More Space for the Book**

- Compacted control bar to reclaim vertical space for the flipbook:
  - Reduced all vertical padding, gaps, and margins in control bar, style pills, input wrap, and send button
  - Smaller mic button and input height ranges
  - Tighter gap between style pills row and input row
- User prompt pill (above the book) now fits in one line:
  - Changed `max-width: 560px` → `90%` to use available width
  - Added `white-space: nowrap` + `text-overflow: ellipsis` for guaranteed single line
  - Changed to full pill shape (`border-radius: 999px`)
  - Responsive font size with `clamp(0.7rem, 1.1vw, 0.85rem)`
- Storybook wrapper padding now responsive: `clamp(0.5rem, 1.5vw, 1.5rem)` instead of fixed `1.5rem`
- Navigation dots margin now responsive: `clamp(0.4rem, 1vw, 1rem)` instead of fixed `1rem`

---

### Day 2 (Feb 19, 2026)

**Session 9: Director Panel - Structured Data & Collapsible Cards**

- Rewrote Director backend prompt (`director.py`) to request structured JSON objects instead of plain strings:
  - `narrative_arc`: summary, stage (exposition/rising_action/climax/falling_action/resolution), pacing (slow/moderate/fast), detail
  - `characters`: summary, list of {name, role, trait}, detail
  - `tension`: summary, levels array, trend (rising/falling/steady/volatile), detail
  - `visual_style`: summary, tags (3-5 keywords), mood (peaceful/mysterious/tense/chaotic/melancholic/joyful/epic), detail
- Bumped `max_output_tokens` from 600 → 1000 to accommodate structured fields
- Rewrote `DirectorPanel.jsx` with visual sub-components:
  - `NarrativeArcVisual`: mini SVG arc curve (80x28px) with stage dot, stage pill, color-coded pacing pill
  - `CharactersVisual`: character chips as `Name · Role` pills with trait tooltips
  - `TensionVisual`: trend pill with arrow icon (↗↘→↕) + existing TensionBars bar chart
  - `VisualStyleVisual`: color-coded mood pill + glass-style tag chips
- Added collapsible detail text behind a ChevronToggle (rotates 180° when expanded)
  - Visual summaries always visible; detail text hidden by default, revealed on chevron click
  - Fade-in animation on expand
- Added backward-compat normalizer (`normalizeCardData`): handles old string format, old tension `{description, levels}` format, and new structured objects
- Replaced line-based `ShimmerLines` with pill-shaped `ShimmerVisual` skeleton in analyzing state
- Removed dead `ShimmerLines` component
- Audit: verified frontend build clean, backend syntax valid, data flow intact through orchestrator/WebSocket/App.jsx (no changes needed to pipeline)

**Session 10: Image Continuity & Pageflip Fix**

- Fixed image continuity breaking across story continuations:
  - Added `_accumulated_story` to Illustrator - appends each batch's text with `---` separators so `extract_characters()` sees the full cross-batch narrative
  - `extract_characters()` now merges with existing character sheet instead of rebuilding from scratch - sends existing sheet in the prompt with instructions to preserve entries and only add new characters
  - On NONE result or error, existing character sheet is preserved instead of cleared (previous characters still exist in the story)
  - Added `accumulate_story()` calls in both manual pipeline (`main.py`) and ADK pipeline (`orchestrator.py`) before `extract_characters()`
  - Reset naturally clears accumulated state since `Illustrator()` is re-created on "New Story"
- Fixed pageflip empty-page bounce animation:
  - Replaced `flip()` with `turnToPage()` in `onFlip` bounce-back handler - `turnToPage` is instant (no 800ms flip animation)
  - Reduced `setTimeout` delay from 50ms to 0ms for earliest safe execution
  - Touch swipes past content now snap back instantly instead of showing a visible flip-back animation
- Removed scene count of 4 - hardcoded to 2 scenes per generation:
  - Removed `scene_count` parsing/validation from `main.py` (was allowing 2 or 4)
  - Removed `scene_count` from WebSocket message payload (`useWebSocket.js`)

---

### Day 3 (Feb 20, 2026)

**Session 11: Firebase Auth, Firestore Persistence & Save Flow**

- Implemented Firebase Authentication with Google Sign-In
- Built Firestore persistence layer for stories, scenes, and generations
- Created save flow: `handleSave` (explicit button) and `autoSaveCurrent` (switching books / New Story)
- First-save-only AI meta: `title_generated` flag prevents re-generation of title/cover on subsequent saves
- `persist_story` uses `merge=True` and never touches status/title/cover/is_public
- Story statuses: draft → saved → completed
- Cover generation via Imagen with safety filter fallback to first scene image
- Firestore composite indexes for Library and Explore queries

**Session 12: Library & Explore Pages**

- Built Library page with 3D CSS book cards (perspective, preserve-3d, spine/page edges)
- Skeleton loading states with shimmer animation
- Book status badges (Draft/Saved/Completed/Published) with color coding
- Action buttons: publish/unpublish (globe icon), delete (trash icon)
- Empty state with stacked book visual and "Create a Story" CTA
- Built Explore page for browsing publicly published stories
- Read-only viewing for other users' stories (no ControlBar, no Save)

**Session 13: Routing & Story Resume**

- URL-based routing: `/` (new), `/story/:storyId?page=N` (active), `/library`, `/explore`
- `useActiveStory` hook loads from URL storyId on boot (or falls back to most recent)
- Page parameter sync via `history.replaceState` (no React re-renders on page flip)
- WebSocket resume protocol for reconnecting to in-progress stories

**Session 14: Image Error Handling**

- `imagen_client.generate_image()` returns `(data_url, error_reason)` tuple
- Error reasons: quota_exhausted, safety_filter, timeout, generation_failed, prompt_failed
- Backend sends `reason` field in `image_error` WebSocket messages
- Frontend stores `image_error_reason` on scene object with specific messages in SceneCard
- SceneCard shows text immediately when image is null (doesn't wait for image)

**Session 15: Library Favorites & Status Filters**

- Added favorite toggle (heart button) on each Library book card
  - Standalone `.book-3d-fav` positioned outside action buttons, always visible when favorited
  - Optimistic Firestore update (`is_favorite` field) - no loading skeleton on toggle
  - `translateZ(2px)` fix for click events inside `preserve-3d` containers
- Added filter pills toolbar: All | Favorites | Saved | Completed
- Replaced redundant "Status" sort option with explicit filter pills
- Sort pills reduced to: Recent | Title
- Filter + search work together (e.g. search "dragon" within Favorites)
- Filter empty states with contextual messages ("No favorite stories yet", etc.)
- Loading skeleton now shows toolbar above skeleton grid (no layout shift)
- Darkened status badge backgrounds from `rgba(0,0,0,0.55)` to `0.75`

**Session 16: Explore Page Enhancements**

- Added search bar (searches by title or author name)
- Added sort pills: Recent | Title | Author
- Added like system using Firestore `arrayUnion`/`arrayRemove` on `liked_by` array
  - Heart button with like count on each card (pill-shaped, hover-reveal, always-visible when liked)
  - Optimistic updates with revert on failure
  - Only shown to logged-in users
- Added liked filter toggle (heart circle button in toolbar)
- Filter empty state: "No liked stories yet"
- Responsive layout for mobile (toolbar stacks vertically, 2-column grid)

**Session 17: Completed Book Protection**

- Completed books are now read-only regardless of how they're opened:
  - From Explore (own book): skips WS resume, sets `storyStatus='completed'`
  - From Library: `handleOpenBook` skips WS resume for completed books
  - ControlBar hidden (`storyStatus !== 'completed'`)
  - Save button hidden (same guard)
- Fixed ExplorePage not passing `status`/`is_public` in `onOpenBook` payload
  - Was causing own completed books opened from Explore to default to 'draft' status

**Session 18: Per-Scene Actions - Regen Image, Regen Scene, Delete**

- Implemented three new scene-level editing operations via WebSocket:
  - **Regen Image**: regenerates only the illustration for a scene (keeps text)
  - **Regen Scene**: rewrites scene text via Gemini + regenerates image + audio in parallel
  - **Delete Scene**: removes scene from Firestore with narrator history tracking
- New backend helper `_rewrite_scene_text()` - uses Gemini with full story context for coherent rewrites
- New WS message types: `regen_start`, `regen_done`, `regen_error`, `scene_deleted`
- Auto-session recovery: scene actions auto-load story from Firestore if WS session was lost
- Narrator history updated on regen/delete to maintain continuity (`[Scene X was rewritten/removed]`)
- `total_scene_count` kept as high-water mark - deleted scene numbers never reused
- Frontend `SceneActionsContext` provides `regenImage`, `regenScene`, `deleteScene` to SceneCard
- `sceneBusy` Set tracks which scenes are actively processing
- SceneCard hover reveals action buttons; busy state shows shimmer overlay with "Regenerating..." label
- Deletion uses `sceneDeleteOut` animation (scale/rotate/blur exit, 500ms)

**Session 19: Scene Titles & Narrator Improvements**

- Changed Narrator scene marker format from `[SCENE]` to `[SCENE: <short evocative title>]`
- Both manual and ADK pipelines parse and include `scene_title` (2–5 words) in scene data
- SceneCard displays title in italic serif (`Playfair Display`) below scene badge
- Scene count now configurable (1 or 2) via new ControlBar toggle buttons

**Session 20: Custom Art Style Dropdown & Compact Audio**

- Replaced standard `<select>` with custom glassmorphism dropdown for art style selection
  - Portal-based floating menu positioned near trigger, `styleMenuIn` animation
  - Checkmark on active option, hover highlights
- Extracted compact audio player (`useCompactAudio` hook) with only-one-playing enforcement
  - Small 20x20px button beside scene badge with inline progress bar
  - Replaced full `AudioPlayer` component in SceneCard

**Session 21: Save Optimization & Background Book Meta**

- 3-tier save flow for both `handleSave` and `handleComplete`:
  - Tier 1: `title_generated=true` → just update status (instant, no API call)
  - Tier 2: `bookMeta` arrived from WS background task → use it + set flag (instant)
  - Tier 3: No metadata → call API with spinner, write result, set flag
- Backend now sends `book_meta` WS message when background title/cover generation completes
- Cover generation retry logic: retries once on network/timeout errors, treats `safety_filter` as terminal
- `findFallbackCover()` filters out base64 data URLs, prefers actual GCS URLs

**Session 22: Toast Notification System**

- Built global toast system (`ToastContext` + `ToastProvider`) with React portal rendering
- Toast types: success (green), error (red), warning (amber), info (violet)
- Glassmorphism cards with type-specific left border accent, icon, message, close button
- Auto-dismiss with configurable duration (4s default), progress bar shrinks over time
- Hover pauses countdown; max 5 toasts stacked; slide-in/out animations
- Wired toasts throughout App.jsx:
  - Save success/error, complete success/error, cover generation fallback warning
- Wired toasts in useWebSocket:
  - `book_meta` → info, `quota_exhausted` → warning with cooldown seconds, `error` → error
  - `image_error` with `quota_exhausted` reason → warning (first occurrence per batch only)
- Removed inline `book-error-toast` div from StoryCanvas (errors now go through toast system)

**Session 23: Header Hover Effects & UI Polish**

- Header button (`.header-btn`) hover effects:
  - Glow lift: `translateY(-1px)` + box-shadow with `accent-primary-glow`
  - Shimmer sweep: `::after` pseudo-element with `btnShimmer` animation (0.6s)
  - Active press: `scale(0.97)` for tactile feedback
  - Spring curve: `cubic-bezier(0.34, 1.56, 0.64, 1)`
- Nav segment (`.header-nav-seg`) hover: glow underline via `inset box-shadow`
- Theme toggle (`.header-theme-btn`) hover: 30° rotation + violet glow, scale-down on active
- Dual-page prompt pills: shows separate prompts for left & right pages when different
- Empty page placeholder: "The story continues..." with ornamental dividers
- Enhanced book nav dots: active dot wider (24px) with stronger glow (12px)
- Prompt pill styling: stronger glass background, larger padding, slightly bigger font

**Session 24: Bug Fixes**

- Fixed Library "New Story" button - now properly auto-saves current story + resets state (was just navigating to `/`)
  - `LibraryPage` accepts `onNewStory` prop instead of using `useNavigate`
  - Both empty-state CTA and "+" card use `onNewStory`
- Page clamping: prevents viewing beyond available scenes on stale URLs or after deletions
- WebSocket connection gating: waits for story state to resolve before opening connection
- Image regen reveal uses distinct animation (`imageRegenReveal`) vs initial load (`imageFadeIn`)
- Text regen animations: `textRegenLine` (blur-dissolve), `textRegenDropCap` (enlarge + glow)

---

### Day 4 (Feb 21, 2026)

**Session 25: Cross-Scene Image Consistency - Hybrid Prompt Architecture**

- Rewrote the Illustrator's image prompt pipeline to solve character inconsistency across scenes:
  - **Root cause**: `_create_image_prompt()` asked Gemini to synthesize a full prompt under 100 words. Gemini dropped character details (age, eye color, skin tone, clothing) to fit the limit. Imagen received "woman in dark dress" instead of the full description.
  - **Solution**: Hybrid prompt construction - split into two stages:
    1. `_identify_scene_characters()` - new Gemini call (temp 0.0, ~50 tokens) identifies which characters appear in each scene
    2. `_create_image_prompt()` rewritten - Gemini writes scene composition only (setting, lighting, mood, camera angle), then character descriptions are **prepended verbatim** from the reference sheet
  - New `SCENE_COMPOSER_INSTRUCTION` replaces `PROMPT_ENGINEER_INSTRUCTION` - explicitly tells Gemini "do NOT describe character appearance"
  - New `CHARACTER_IDENTIFIER_INSTRUCTION` - identifies characters present in a scene
  - New `_filter_character_descriptions()` - extracts relevant character blocks from the full reference sheet
  - Final prompt: `character descriptions + scene composition + art style suffix` - 100% of character visual details reach Imagen
- Enhanced `extract_characters()` prompt with distinguishing features and color palettes
- Bumped `max_output_tokens` from 400 → 600 for character extraction

**Session 26: Page Auto-Advance Fix**

- Fixed bug where book doesn't turn to next page on story continuation when current pages are full
- **Root cause**: Clamp effect (`maxValid = scenes.length`) was fighting the auto-advance effect - when auto-advance flipped to page 3, clamp saw `currentPage(3) > scenes.length(2)` and yanked it back
- **Fix**: Added `if (generating) return;` to clamp effect to skip during generation, plus `generating` in dependency array

**Session 27: Image Loading Shimmer Placeholder**

- Enhanced bare shimmer in SceneCard with "Painting scene" icon and label (matching SceneComposing style)
- Guarded `<img>` render with `scene.image_url && scene.image_url !== 'error'` - only mounts when URL exists
- Removed stray `)}` text node that was rendering visibly when image wasn't loaded (exposed by the `<img>` guard change)

**Session 28: Art Style Persistence**

- Fixed art style dropdown resetting to "cinematic" after generation
- **Root cause**: `artStyle` was local state in ControlBar (`useState('cinematic')`) - route switch from `*` to `/story/:storyId` caused remount, resetting state
- **Fix**: Lifted `artStyle` state to App.jsx (same pattern as `controlBarInput`), passed as props to ControlBar
- Added art style restore on story load:
  - `art_style` stored on Firestore story document (not scene documents)
  - `loadStoryById` returns `art_style` from `storyData`
  - `useLibraryBooks` includes `art_style` in book data
  - `handleOpen` in LibraryPage passes `art_style` to `onOpenBook`
  - `handleOpenBook` and `initialState` effect both set `artStyle` from loaded data
  - "New Story" resets artStyle to 'cinematic'

**Session 29: NSFW Content Handling & Pipeline Simplification**

- Added refusal detection for explicit/NSFW content:
  - `_REFUSAL_PATTERNS` list in `main.py` matches AI refusal phrases ("i am programmed to be", "i cannot generate", etc.)
  - `_is_refusal()` function checks text against patterns
  - ADK pipeline's `ws_callback` intercepts refusal text before sending to frontend
  - Frontend receives `type: 'error'` message with user-friendly toast
  - `ContentBlockedError` in `gemini_client.py` catches Gemini safety blocks in `generate_stream`
- Removed entire manual pipeline (`_run_manual_pipeline`, ~230 lines):
  - Made ADK imports required (no try/except fallback)
  - Removed `USE_ADK` flag and conditional dispatch
  - Simplified WebSocket handler

**Session 30: Delete Dialog Loading State**

- Added spinner to delete confirmation button in Library:
  - Rotating spinner SVG inside "Delete" button during deletion
  - "Deleting..." text alongside spinner
  - Both buttons disabled during deletion (already existed)
  - Overlay click-to-close blocked during deletion (already existed)

**Session 31: Library UX - Cover Generation State & Delete Cleanup**

- Added loading state for book covers still being generated in Library:
  - Books with `title_generated=false` show blur+grayscale+dim on cover image (`book-3d-cover--generating` class)
  - Centered paintbrush icon in glowing circle with pulsing accent animation
  - "Painting cover..." pill label below icon
  - Subtle shimmer sweep across overlay
- Auto-refresh Library when `bookMeta` arrives via WebSocket:
  - `bookMeta` prop passed from App.jsx to LibraryPage
  - Effect triggers `refresh()` when bookMeta changes
- Auto-persist bookMeta to Firestore when WS message arrives:
  - New effect in App.jsx writes title + cover_image_url + `title_generated: true` immediately
  - Library refresh then picks up the updated data, shimmer disappears
- Delete active story cleanup:
  - `onActiveStoryDeleted` callback clears WS state, story status, art style, and navigates to `/`
  - No more stale URL after deleting active book

**Session 32: Cover Art Style Matching**

- Improved cover generation to match the story's art style:
  - `_gen_cover()` now imports `ART_STYLES` from illustrator and uses the full suffix (e.g., "anime illustration, Studio Ghibli style, detailed backgrounds") instead of just the key ("anime")
  - Prompt explicitly instructs: "The image MUST match this art style" and "End the prompt with: {suffix}"
  - Added "Do NOT include any text, titles, words, or lettering" to prevent text artifacts on covers

**Session 33: Header Button Disable During Cover Generation**

- Disabled "New Story", "Save", and "Complete Book" buttons during `saving` or `generatingCover`:
  - Added `disabled` prop + opacity/cursor styling to New Story and Complete Book buttons
  - Save button already had this behavior
- Added "Generating AI title & cover..." info toast when Tier 3 cover generation starts (both Save and Complete flows)

**Session 34: Multi-Language Story Generation**

- Added 8-language support: English, Spanish, French, German, Japanese, Hindi, Portuguese, Chinese
- Backend: `narrator.py` inserts language directive into system prompt; `tts_client.py` maps language→voice (e.g. `es-US-Studio-B`, `ja-JP-Standard-B`)
- `orchestrator.py` passes language through `SharedPipelineState` to Narrator + TTS agents
- `main.py` reads `language` from WS message, persists to Firestore, restores on resume
- Frontend: Language dropdown in ControlBar (same glassmorphism pattern as art style), localized placeholder text
- Language persisted per story in Firestore, restored on Library open, reset to English on New Story

**Session 35: Animated Page Transitions**

- Added entrance animation when book first appears on StoryCanvas
- `entranceReady` state transitions from hidden to visible after scene hydration
- CSS: `bookEntrance` keyframe - `translateY(30px) scale(0.95)` → `translateY(0) scale(1)` with cubic-bezier easing
- Preloaded scenes (from Library) get a subtle `fadeIn 0.4s` instead of full reveal animation

**Session 36: Share Link for Published Stories**

- New REST endpoint `GET /api/public/stories/{story_id}` - no auth required, checks `is_public`, returns sanitized story data
- Frontend: Share button in header copies public URL to clipboard (visible when published + storyId exists)
- Unauthenticated story viewing: when `!user && urlStoryId`, fetch public story and render StoryCanvas in read-only mode with "Sign in to create" CTA
- Fixed timing: added `!authLoading` guard to prevent premature public fetch during Firebase auth resolution

**Session 37: Story Export to PDF**

- New backend service `pdf_export.py` using `fpdf2` - generates polished storybook PDF
- Cover page with image/dark background, scene pages with illustrations + text, decorative separators, page numbering, colophon
- Endpoint `GET /api/stories/{story_id}/pdf` with auth (owner or public story)
- Frontend: PDF download button in header, fetches with auth token, creates blob → download
- Added `fpdf2>=2.7.0` to requirements.txt

**Session 38: Reading Mode (Published Books Only)**

- New component `ReadingMode.jsx` - full-screen immersive overlay
- Word-by-word narration highlighting (karaoke-style sync with audio)
- Pause/play controls, bookmarking (Firestore for authenticated, sessionStorage for guests)
- Segmented progress bar showing scene-by-scene progress
- Auto-advance to next scene after narration ends (1.5s delay)
- Keyboard controls: Space/Right = next, Left = prev, Escape = exit
- Fade transitions between scenes

**Session 39: Background Music / Ambience (Removed in Session 53)**

- New hook `useAmbientAudio.js` - Web Audio API with `AudioContext` + `GainNode`
- 7 mood-mapped ambient tracks in `/public/ambient/`: peaceful, mysterious, tense, chaotic, melancholic, joyful, epic
- Crossfade between moods (1s fade-out, 2s fade-in), ambient volume 15%
- Music toggle button in header (speaker icon)
- Auto-switches mood when Director's `visual_style.mood` changes
- Initially had 2-second placeholder files; replaced with proper 30-second synthesized ambient tracks (~240KB each)

**Session 40: Character Portrait Gallery**

- Backend `_generate_portraits()`: Parses character sheet, generates face portrait prompts, generates 1:1 images via Imagen, uploads to GCS
- Auto-extracts characters from story if `_character_sheet` is empty (fallback for stories where `extract_characters` returned NONE)
- All error paths send `portraits_done` so frontend loading never gets stuck
- WS handler: `generate_portraits` message type; relaxed guard (no longer requires pre-existing character sheet)
- Frontend: `PortraitGalleryCard` in DirectorPanel - circular thumbnails (56px) with name labels, "Generate Portraits" button
- Portraits persisted to Firestore and restored from Library (fixed: LibraryPage now includes `portraits` + `language` in `onOpenBook`)
- Portrait generation hidden for completed/published books

**Session 41: Gemini Live Voice Conversation (Removed in Session 53)**

- Backend `gemini_live.py`: `LiveSession` class using `gemini-2.0-flash-live-001` model
- System prompt: creative story collaborator; detects `[STORY_PROMPT]` prefix for auto-fill
- WS message types: `live_start`, `live_stop`, `live_audio_chunk`, `live_text`
- Frontend `useLiveVoice.js`: AudioContext + MediaRecorder for continuous 16kHz PCM streaming
- ControlBar: "Live" toggle, conversation transcript display, auto-fill prompt on `live_prompt_ready`

**Session 42: Complete/Publish Flow & Bug Fixes**

- Added confirmation dialogs for Complete and Publish actions
- Publishing is now permanent (can't unpublish) - button becomes non-interactive "Published" badge
- Delete all scenes → auto-delete entire book from Firestore + GCS, send `story_deleted` WS message
- Fixed stuck splash screen after deleting all scenes (`hasBeenPopulatedRef` prevents re-triggering `isHydrating`)
- Language lock warning in Director empty state: "Language will be locked once you start generating"

---

### Day 5 (Feb 22, 2026)

**Session 43: Director Analysis Fixes & Scene Action UX**

- Fixed Director tension bars showing wrong number of bars vs actual scenes
- Strengthened Director prompt to enforce exact scene count in tension levels array
- Added backend validation: pad or trim tension `levels` array to match `scene_count`
- Added `sceneTitles` prop to DirectorPanel → TensionVisual → TensionBars for scene title labels
- Fixed React hooks order violation: converted `activeBatchSceneTitles` from `useMemo` to plain IIFE (was after early return)
- Reorganized scene action buttons: "Regenerate image" stays on image overlay, "Regenerate scene" + "Delete scene" moved to scene header row (right-aligned, appear on page hover)
- Replaced `ActionBtn` tooltip with portal-based fixed-position tooltip using `createPortal` + `getBoundingClientRect()` - escapes all `overflow:hidden` ancestors
- Removed Fork Story feature entirely (frontend SceneCard, App.jsx, SceneActionsContext; backend fork endpoint + ForkRequest model)

**Session 44: Deep Decomposition (Round 2)**

- Broke 7 monolithic files (500–800 lines) into ~22 smaller modules, all under ~320 lines:
  - **Phase A**: Extracted CSS from ReadingMode.jsx → `reading-mode.css`, DirectorPanel.jsx → `director-panel.css`
  - **Phase B**: SceneCard.jsx (782→128) → `scene/SceneComposing`, `scene/SceneHeader`, `scene/SceneImageArea`, `scene/SceneTextArea`
  - **Phase C**: StoryCanvas.jsx (617→319) → `storybook/CoverPage`, `storybook/EmptyPageContent`, `storybook/GeneratingContent`, `hooks/useStoryNavigation`, `hooks/useBookSize`
  - **Phase D**: App.jsx (557→324) → `SplashScreen`, `SignInScreen`, `hooks/useAppEffects`
  - **Phase E**: DirectorPanel.jsx (525→138) → `director/DirectorEmptyState`, `director/DirectorAnalyzing`, `director/DirectorCardList`
  - **Phase F**: useWebSocket.js (462→233) → `hooks/wsHandlers.js` (message handler dispatch map)
  - **Phase G**: main.py (650→407) → `handlers/scene_actions.py`, `handlers/live_session.py`, `handlers/ws_resume.py`

**Session 45: Scene Deletion, Regen & UX Bug Fixes**

- **Director updates on scene delete**: Removed deleted scene number from `generations[].sceneNumbers` AND spliced corresponding `tension.levels` entry - Director panel now re-renders with correct data
- **Library updates on scene delete**: Backend now counts remaining scenes and updates Firestore `total_scene_count` after deletion
- **Delete scene confirmation dialog**: Added portal-based confirmation dialog (matching Library's style) with scene title, warning, Cancel/Delete buttons
- **Regen scene preserves old image**: `is_regen` text handler no longer clears `image_url` - old image stays visible with busy overlay while new one generates
- **Regen image error preserves old image**: If regen fails but scene already has an image, old image is kept (no "Illustration unavailable")
- **Regen scene language fix**: Frontend now sends `language` in regen_scene WS message; `scene_rewrite.py` includes "Write entirely in {language}" instruction; TTS receives correct language for voice selection
- **Writing skeleton animation**: New `WritingSkeleton` component with animated drop-cap block, 8 staggered skeleton lines with shimmer sweep + typing cursor glow, used in both `SceneComposing` (initial generation) and `SceneTextArea` (regen overlay)

---

**Session 46: Social Features - Likes, Ratings & Comments**

- Built full social interaction system on BookDetailsPage (`/book/:storyId`):
  - **Likes**: Reused existing `liked_by` array on story docs, optimistic toggle with `arrayUnion`/`arrayRemove`
  - **Star Ratings (1-5)**: New subcollection `stories/{id}/ratings/{uid}`, denormalized `rating_sum`/`rating_count` on story doc for instant display
  - **Comments**: New subcollection `stories/{id}/comments/{autoId}`, denormalized `comment_count` on story doc
- New backend router `routers/social.py` with 5 endpoints:
  - `POST /api/stories/{id}/rate` - upsert rating with atomic `Increment` updates
  - `GET /api/public/stories/{id}/social` - returns avg rating, count, user rating, comment count
  - `POST /api/stories/{id}/comments` - create comment (author info from Firebase token)
  - `GET /api/public/stories/{id}/comments` - list comments (newest first, limit 50)
  - `DELETE /api/stories/{id}/comments/{cid}` - delete own comment or any comment on own story
- Updated `book_details.py` to include `rating_avg`, `rating_count`, `comment_count` in public response
- Frontend: social stats row (heart+count, stars+avg, comment icon+count), inline star rating with hover preview, comment form + list with delete button
- **Pre-populated data**: Rating avg/count/commentCount loaded from initial story fetch (no delayed pop-in)
- Comprehensive skeleton loading for BookDetailsPage (back button, cover, title, author, tags, stats, social, synopsis, actions, comments)
- Share button moved inline next to title for visitor view

**Session 47: Explore Page Skeleton Redesign**

- Replaced 3D book skeleton with simple flat card skeleton (rounded rectangle cover + text lines)
- Gentle opacity shimmer animation with staggered fade-in per card
- Removed shadow artifacts from loading state

**Session 48: Content Filtering - Multilingual Pre-Pipeline Validation**

- Fixed issue where narrator produced refusal text as scene content (with images) for off-topic/non-story prompts
- Added `validate_prompt()` pre-filter using Gemini Flash for fast multilingual classification (STORY/REJECT)
- Expanded `is_refusal()` patterns to cover Hindi, Spanish, French, German, Japanese refusal phrases
- Pre-filter runs BEFORE expensive pipeline - rejects coding questions, homework, recipes, etc.
- Fails open on errors (allows prompt through) to avoid blocking legitimate requests

**Session 49: Prompt Engineering - Character Consistency & Quality Improvements**

- **Enhanced character sheet format** - extraction prompt now requests hex color codes for all colors, face shape + features, detailed outfit with colors, signature items/accessories, and dominant color palette per character
- **Anti-drift language** - explicit instruction block between character descriptions and scene composition in image prompts: "Render each character EXACTLY as described above - same colors, same outfit, same signature items"
- **Richer art style suffixes** - expanded from 5-8 words to 20-25 words per style with rendering-specific details (volumetric lighting, paper texture, cel shading, impasto brushstrokes, cross-hatching, etc.)
- **Consistency anchors in scene composition** - new CONSISTENCY ANCHORS section in scene composer prompt instructs Gemini to mention signature accessories by name, reference same location names, and use consistent time-of-day cues
- **Language-aware title generation** - `gen_title()` now accepts language parameter; non-English stories get "The title MUST be in {language}" instruction; removed "children's story" hardcode; language flows from WS message through `auto_generate_meta()` to `gen_title()`
- Bumped scene composition word limit from 80 → 100 words for richer descriptions
- Bumped character extraction `max_output_tokens` from 600 → 1000 for detailed format
- Bumped title `max_output_tokens` from 20 → 30 and word limit from 4 → 6 for non-Latin scripts

---

### Day 6 (Feb 23, 2026)

**Session 50: Subscription Tiers & Admin Dashboard**

- Built subscription tier system (free/standard/pro) with per-tier usage limits:
  - Generations per day, scene regens, PDF exports — all configurable per tier
  - Backend `services/usage.py` tracks daily usage in Firestore
  - `routers/usage.py` serves current usage + limits to frontend
  - `routers/admin.py` exposes admin-only endpoints for viewing users and updating tiers
- Frontend `SubscriptionPage.jsx` displays current tier, usage stats, and tier comparison
- Frontend `AdminDashboard.jsx` for admin users to search/view users and change tiers
- New hooks: `useUsage.js` (usage polling), `useAdminUsers.js` (admin user management)
- Auth system expanded: email/password sign-up with Firebase email verification (`VerifyEmailScreen`)
- `AuthContext` now handles `createUserWithEmailAndPassword`, `sendEmailVerification`, `signInWithEmailAndPassword`, `sendPasswordResetEmail`

**Session 51: Pro User Visual Indicators & UX Polish**

- Added tier-based visual indicators in `ProfileMenu.jsx`:
  - **Header avatar (32px)**: Pro = amber border + `proGlow` pulse animation, Standard = violet border + static glow, Free = default glass border
  - **Dropdown avatar (40px)**: Same ring color treatment per tier
  - **Tier pill**: Pro = amber pill with star icon ("PRO"), Standard = violet pill with bolt icon ("STANDARD"), Free = no pill
- Added `@keyframes proGlow` in `index.css` (subtle amber pulse)
- `App.jsx` derives `userTier` from `usage?.usage?.tier || 'free'` and passes through `AppHeader` → `ProfileMenu`
- Hidden usage counter pill in ControlBar for Pro users (999 limit is meaningless)

**Session 52: Ambient Audio, Portrait Gallery & Light Mode Fixes**

- **Ambient audio fix** _(feature later removed in Session 53)_: Changed `muted`/`mutedRef` defaults from `false` to `true` in `useAmbientAudio.js`
  - Root cause: Browser autoplay policy blocks AudioContext created from `useEffect` (no user gesture)
  - Button now shows muted initially; first user click provides gesture to resume AudioContext
- **Portrait gallery**: Changed from `flexWrap: wrap` grid to horizontal scrolling row (`overflowX: auto`, `flexShrink: 0` on items)
  - Added `.portrait-scroll` custom scrollbar styles in `index.css`
- **Light mode book shadow fix**:
  - `storybook.css`: Replaced hardcoded dark shadow values with CSS variables (`var(--book-shadow)` for depth, `var(--book-edge-shadow)` for gutters)
  - `StoryCanvas.jsx`: Imported `useTheme`, set `react-pageflip`'s `maxShadowOpacity` to `0.12` in light mode (was hardcoded `0.5`)
  - Root cause of sharp shadow: react-pageflip renders its own canvas-based shadow independent of CSS

**Session 53: Feature Cleanup & Author Attribution**

- Removed ambient sound feature entirely:
  - Deleted `useAmbientAudio.js` hook, ambient MP3 assets from `public/ambient/`
  - Removed ambient prop from `App.jsx`, `AppHeader.jsx`, `useAppEffects.js`
  - Removed music toggle button from AppHeader
- Removed Gemini Live Voice feature entirely:
  - Deleted `useLiveVoice.js` hook, `handlers/live_session.py`, `services/gemini_live.py`
  - Removed live session handlers from `main.py` WebSocket endpoint
  - Removed `live_sessions_today` from usage tracking (`services/usage.py`)
  - Removed live UI (toggle button, transcript overlay, ready prompt) from `ControlBar.jsx`
  - Removed `liveHandlerRef` from `useWebSocket.js` and `wsHandlers.js`
- Fixed "Anonymous" author name on BookDetailsPage:
  - `verify_token()` now supports `full=True` to return decoded Firebase token with name/picture
  - `main.py` WS handler extracts `author_name` and `author_photo_url` from decoded token
  - `persist_story()` writes author info on initial story doc creation
  - Frontend publish flow uses `email.split('@')[0]` as fallback when `displayName` is null
- Added regenerate meta (cover + title) for stories with failed meta generation
  - Backend `POST /api/stories/{story_id}/regenerate-meta` endpoint
  - Library shows "Generate Cover" button on books with missing covers

**Session 54: Per-Scene Streaming, Live Director & Mid-Generation Steering**

- **Per-scene image/audio streaming**: Restructured ADK pipeline — moved image and audio generation from separate `IllustratorADKAgent`/`TTSADKAgent` into `NarratorADKAgent._run_async_impl` loop. Each scene fires `asyncio.create_task` for image (rate-limited via semaphore), audio, and director live commentary as soon as its text is ready. Character extraction runs once on first scene. `PostNarrationAgent` now only contains `DirectorADKAgent` for full analysis.
- **Live Director commentary**: Added `analyze_scene()` method to `Director` class — lightweight per-scene JSON analysis (thought, mood, tension_level, craft_note, emoji) using Gemini Flash (temp 0.3, 300 tokens). Frontend `DirectorPanel` shows animated live commentary cards during generation with emoji, mood badge, tension meter, and craft notes. Cards animate in with `directorLiveIn` keyframe.
- **Mid-generation steering**: ControlBar input stays active during generation — when user types and sends, it sends `type: "steer"` instead of `type: "generate"`. Backend pushes steer text to `SharedPipelineState.steering_queue`, checked between scenes in narrator loop and injected into narrator history. Compass icon replaces spinner when text is present during generation. `steer_ack` WS message triggers toast.
- **Playful safety redirect**: Updated narrator system prompt with in-character redirect instruction for inappropriate content ("That part of the library is forbidden! Let's explore this mysterious path instead..."). Softened `ws_callback` — `safety` refusals now let narrator's redirect play out; only `offtopic` refusals hard-abort.
- **Architecture diagram**: Updated `BLOG.md` and `README.md` architecture diagrams to show new per-scene streaming loop with parallel task spawning, steering injection, and live commentary.
- Files modified: `backend/agents/orchestrator.py`, `backend/agents/director.py`, `backend/agents/narrator.py`, `backend/main.py`, `frontend/src/hooks/wsHandlers.js`, `frontend/src/hooks/useWebSocket.js`, `frontend/src/components/ControlBar.jsx`, `frontend/src/components/DirectorPanel.jsx`, `frontend/src/components/director-panel.css`, `frontend/src/App.jsx`, `BLOG.md`, `README.md`
- **Director-as-driver**: Director's per-scene `analyze_scene()` now returns a `suggestion` field — a proactive creative direction for the next scene. Stored on `SharedPipelineState` and injected into the Narrator's input at the start of the next batch. Director is now a creative collaborator, not just an observer.
- **Delete endpoint resilience**: Wrapped `decrement_usage` in try/except so transient Firestore gRPC errors don't crash the delete endpoint.
- **Director panel width**: Bumped from `clamp(220px, 22vw, 320px)` to `clamp(260px, 24vw, 380px)`.

---

### Day 7 (Feb 24, 2026)

**Session 55: Director Chat, Settings Dialog & VAD Auto-Send**

- **Director Chat via Gemini Live API**: Built full voice brainstorming feature using `gemini-live-2.5-flash-native-audio`:
  - New `DirectorChatSession` class in `services/director_chat.py` manages persistent Live API sessions
  - Supports both voice input (base64 audio) and text input
  - `start()` sends story context + greeting prompt, returns WAV audio response
  - `send_audio()` / `send_text()` for ongoing conversation
  - `detect_intent()` uses Gemini Flash (temp 0) to classify if user wants to generate a scene
  - `suggest_prompt()` generates a story prompt from conversation context
  - PCM → WAV conversion (`_pcm_to_wav()`) for browser playback
  - WS message types: `director_chat_start`, `director_chat_audio`, `director_chat_text`, `director_chat_suggest`, `director_chat_end`
  - Frontend `DirectorChat.jsx` with voice orb, message list, text input, action buttons

- **Auto-Send on Silence (VAD)**: Added Web Audio API Voice Activity Detection to `useVoiceCapture.js`:
  - `AnalyserNode` + `getFloatTimeDomainData()` computes RMS levels on 100ms polling interval
  - Detects speech (RMS > 0.01 threshold) → silence transition
  - Auto-stops `MediaRecorder` after 1.2s of continuous silence following detected speech
  - Enables natural conversation flow: speak → pause → auto-send → Director responds
  - Manual tap-to-send still works as override
  - Graceful degradation: if AudioContext fails, falls back to manual stop

- **Settings Dialog**: New `SettingsDialog.jsx` component (replaces standalone theme toggle):
  - **Appearance section**: Light/Dark toggle pills with sun/moon SVG icons
  - **Director Voice section**: 2-column grid of 8 curated voice chips:
    - Charon (Deep & dramatic), Kore (Warm & nurturing), Fenrir (Bold & commanding), Aoede (Lyrical & expressive), Puck (Playful & energetic), Orus (Calm & wise), Leda (Elegant & refined), Zephyr (Breezy & casual)
  - Follows `CompleteBookDialog` pattern (fixed overlay, backdrop blur, `dialogPop` animation)
  - Voice preference persisted to `localStorage('storyforge-director-voice')`
  - `AppHeader.jsx`: Replaced theme toggle (sun/moon) with gear icon → opens Settings Dialog

- **Language-Aware Director Chat**: Director speaks in the story's language:
  - `_build_system_prompt(language)` appends "You MUST speak and respond ONLY in {language}" for non-English
  - `start()` accepts `language` and `voice_name` parameters
  - Frontend passes `{ language, voiceName: directorVoice }` to `startDirectorChat`
  - Backend `main.py` extracts language + voice from `director_chat_start` WS message

- **Powered by Gemini badge**: Subtle branding in Director Chat with Gemini gradient sparkle SVG (9px, 0.45 opacity, hover 0.7)

- Files modified: `frontend/src/hooks/useVoiceCapture.js`, `frontend/src/components/DirectorChat.jsx`, `frontend/src/components/director-panel.css`, `frontend/src/components/AppHeader.jsx`, `frontend/src/App.jsx`, `frontend/src/hooks/useWebSocket.js`, `backend/services/director_chat.py`, `backend/main.py`
- Files created: `frontend/src/components/SettingsDialog.jsx`

**Session 56: Gemini Native Audio, Director Intelligence & UX Polish**

- **Gemini Native Audio TTS** — Replaced Google Cloud TTS with Gemini Live API (`gemini-2.5-flash-native-audio`) for story narration:
  - New `services/gemini_tts.py` — uses Live API sessions for expressive audiobook-style narration
  - System prompt instructs natural expression, pacing variation, emotional depth matching scene mood
  - Per-language voice selection: Kore (English/Spanish/Hindi/Portuguese), Leda (French), Orus (German), Aoede (Japanese/Chinese)
  - Drop-in replacement: same `synthesize_speech(text, voice_name, language)` signature
  - ReadingMode karaoke fallback: heuristic word tracking (weight by word length + punctuation) when timestamps unavailable
  - Eliminates separate Cloud TTS dependency/billing

- **Voice Preview in Settings** — Clicking a Director voice chip generates a live audio preview:
  - Backend: `generate_voice_preview(voice_name)` creates short-lived Live session, each voice says a unique personality-matched intro line
  - Endpoint: `GET /api/voice-preview/{voice_name}` with voice name validation
  - Frontend: Loading spinner on chip while generating, animated audio bars while playing, abort on voice switch

- **Director-Driven Intent Detection** — Director now controls when to generate (not premature user-word triggers):
  - Updated Director system prompt: instructs to explore the idea first (ask about characters, setting, mood, conflict), only confirm when fleshed out
  - Director's audio responses now transcribed for intent analysis (not just user words)
  - `detect_intent(user_text, director_text)` analyzes BOTH sides of the conversation
  - Stricter criteria: Director must NOT be asking questions + user must explicitly confirm + confidence threshold raised to 0.8
  - Conversation log now stores Director transcripts (not just "[voice response]")

- **Director Chat lifecycle fixes**:
  - "No active Director chat session" error toast suppressed — race condition messages silently ignored on backend
  - Toast notifications: "Director mode entered" (success) / "Director mode ended" (info)
  - Auto-end Director Chat on navigation away from story canvas (Library, Explore, etc.)

- **Scene count simplification** — Removed 1/2 scene toggle from ControlBar, hardcoded to 1 scene per generation across full stack

- **Language selector moved to book cover** — Glassmorphism dropdown picker on "Begin Your Story" cover page (globe icon, upward-opening menu, click-outside close)

- **Token expiry handling** — Auth failure recovery for both WebSocket and REST:
  - WS: Close code 4003 detection, `authFailedRef` prevents infinite retry, token change triggers reconnect
  - REST: `getValidToken()` utility in AuthContext, all fetch calls use fresh tokens
  - 5 REST endpoints updated in useStoryActions and BookDetailsPage

- **UI polish**:
  - Director Panel: "Next Direction" merged into scene note card (inline with divider, not separate nested card)
  - Cover page: Updated subtitle/hint text for all 8 languages
  - 404 page: New `NotFoundPage.jsx` with book icon, themed buttons, wired to catch-all route
  - Error boundary: Restyled with CSS variable theming, background orbs, glass card, accent buttons
  - Textarea max height (120px overflow scroll), mic disabled during generation, SceneCard regen timeout (60s)

- Files created: `backend/services/gemini_tts.py`, `frontend/src/components/NotFoundPage.jsx`
- Files modified: `backend/main.py`, `backend/services/director_chat.py`, `backend/agents/orchestrator.py`, `backend/handlers/scene_actions.py`, `frontend/src/App.jsx`, `frontend/src/hooks/useWebSocket.js`, `frontend/src/hooks/wsHandlers.js`, `frontend/src/contexts/AuthContext.jsx`, `frontend/src/hooks/useStoryActions.js`, `frontend/src/components/BookDetailsPage.jsx`, `frontend/src/components/ControlBar.jsx`, `frontend/src/components/StoryCanvas.jsx`, `frontend/src/components/DirectorPanel.jsx`, `frontend/src/components/SettingsDialog.jsx`, `frontend/src/components/ErrorBoundary.jsx`, `frontend/src/components/storybook.css`, `frontend/src/data/languages.js`

**Session 57: Director Notes Hydration Fix + Bug Audit Polish**

- **Director notes not appearing when opening book from Library** — Root cause: `LibraryPage.jsx` `handleOpen` was building generation objects WITHOUT `directorLiveNotes` field (only had `directorData` and `sceneNumbers`). This meant per-scene Director live notes (emoji, mood, audio commentary) were empty when opening from Library. Also, the `load()` function in `useWebSocket.js` never called `setDirectorData()` to hydrate the standalone director data state from persisted generations.
  - Added `directorLiveNotes: data.director_live_notes || []` to LibraryPage generation objects
  - Added `directorData` hydration loop in both `load()` and initial hydration effect in `useWebSocket.js`
- Files modified: `frontend/src/components/LibraryPage.jsx`, `frontend/src/hooks/useWebSocket.js`

---

## Current State (Feb 24, 2026)

### What's Working

- Full text + image generation pipeline: prompt → Gemini 2.0 Flash → streamed scenes → Imagen 3 illustrations → interactive flipbook
- Conversation continuity (story steering/continuation across multiple prompts)
- **Hybrid image prompt architecture** - character descriptions reach Imagen verbatim (not summarized by Gemini)
- Cross-batch character visual consistency via accumulated story text and character sheet merging
- 6 art styles with custom glassmorphism dropdown - **persisted per story** and restored on load
- Genre quick-start from cover page
- New Story reset (frontend + backend)
- Dark/light glassmorphism theme
- Responsive layout across screen sizes
- Animated logo, scene reveal animations, drop-cap typography
- Keyboard and dot-based flipbook navigation
- Instant snap-back on touch swipe past content pages
- Production-ready Docker setup
- Voice input via MediaRecorder (`useVoiceCapture.js`) with Gemini transcription
- Gemini native audio narration per scene (via Live API) with compact inline audio player
- Director Agent with structured JSON analysis - narrative arc, characters, tension, visual style
- ADK orchestration pipeline (single pipeline, manual removed) - NarratorADKAgent with per-scene streaming loop (image + audio + live commentary tasks spawned per scene) → PostNarrationAgent (DirectorADKAgent)
- Director Panel with glanceable visual summaries and collapsible detail text
- Tension bar chart visualization with per-scene bars and trend indicators
- Per-batch director data tracking - director analysis follows scene pagination
- Firebase Auth (Google Sign-In) and Firestore persistence (stories, scenes, generations)
- Save flow with 3-tier optimization (instant when metadata available, API call only on first save)
- Background book meta generation via WebSocket (`book_meta` message) - auto-persisted to Firestore
- **NSFW/safety content filtering** - refusal detection intercepts harmful content before reaching frontend
- Library page with 3D book cards, favorites, status filters, search, sort
  - **Cover generation state**: blur+shimmer overlay with paintbrush icon while cover generates
  - **Auto-refresh**: Library updates when bookMeta arrives via WebSocket
  - **Delete dialog**: spinner on confirm button with loading state
  - **Active story delete**: clears WS state + navigates to clean URL
- Explore page with public story browsing, like system, liked filter, search, sort
- Completed book protection - read-only regardless of entry point
- URL-based routing with story resume on page reload
- Image error handling with per-reason user messages
- **Image loading shimmer**: "Painting scene" icon + shimmer while Imagen generates
- Per-scene actions: regenerate image, regenerate scene (text+image+audio), delete scene
- Scene titles generated by Narrator (`[SCENE: Title]` markers)
- Single-scene generation per batch
- Global toast notification system (success/error/warning/info) with glassmorphism styling
- Header button hover effects (glow lift, shimmer sweep, rotation, press feedback)
- **Header button guards**: New Story, Save, Complete Book disabled during cover generation
- Auto-session recovery for scene actions when WS session is lost
- **Cover art style matching** - book covers use the same art style suffix as scene images
- Page auto-advance fix - clamp effect generation-aware to prevent fighting auto-flip
- Multi-language story generation (8 languages) with language-specific TTS voices
- Animated book entrance transitions
- Share link for published stories (public URL, unauthenticated viewing)
- PDF export with cover page, scene images, and polished typography
- Reading Mode - full-screen immersive with karaoke-style narration sync
- Character portrait gallery with auto-extraction fallback
- Complete/Publish confirmation dialogs (publish is permanent)
- Auto-delete book when all scenes removed
- Portal-based tooltips for scene action buttons
- **Scene delete confirmation dialog** with portal overlay matching Library design
- **Scene regen preserves old image** during regeneration (no flash of "unavailable")
- **Scene regen respects language** - rewritten text and TTS use story's language
- **Writing skeleton animation** - animated typing cursor + skeleton lines during text generation
- **Director auto-updates on scene deletion** - tension bars and scene numbers stay accurate
- **Library scene count updates on deletion** - Firestore `total_scene_count` synced
- **Social features on BookDetailsPage** - likes, 1-5 star ratings, comments with optimistic UI
  - Denormalized counts on story doc (rating_sum, rating_count, comment_count) for instant display
  - Story author can delete any comment; commenters can delete own
  - Pre-populated social stats from initial story fetch (no delayed pop-in)
- **Content filtering** - multilingual pre-pipeline validation via Gemini Flash + expanded refusal patterns
- **Enhanced prompt engineering** for character consistency:
  - Character sheets with hex color codes, face details, signature items, dominant color palette
  - Anti-drift language in image prompts ("Render EXACTLY as described")
  - Richer art style suffixes (20-25 words with rendering-specific details)
  - Consistency anchors in scene composition (signature items, location names, time-of-day)
  - Language-aware title generation (titles in story's language, not always English)
- **Subscription tiers** (free/standard/pro) with per-tier usage limits and tracking
- **Admin dashboard** for user tier management
- **Email/password auth** with email verification flow
- **Pro user visual indicators** - tier-based avatar glow, tier pills in profile dropdown
- **Usage counter** hidden for Pro users (unlimited generation)
- **Portrait gallery** horizontal scrolling layout
- **Theme-aware book shadows** - light mode uses softer shadows (CSS variables + react-pageflip opacity)
- **Author attribution** captured from Firebase Auth token on story creation
- **Regenerate meta** (title + cover) for failed book meta generation
- **Per-scene streaming** — image + audio generation fires per-scene (not batch), reducing perceived latency
- **Live Director commentary** — per-scene creative notes stream during generation with mood, tension, craft observations
- **Mid-generation steering** — users can steer the story while it generates (injected between scenes via narrator history)
- **Playful safety redirect** — narrator redirects inappropriate requests in-character instead of hard error toast
- **Director-as-driver** — Director's per-scene `analyze_scene()` returns a `suggestion` field injected into next batch's Narrator input (proactive creative collaborator)
- **Delete endpoint resilience** — `decrement_usage` wrapped in try/except to survive transient Firestore gRPC errors
- **Director Chat** — Real-time voice brainstorming with the Director via Gemini Live API (`gemini-live-2.5-flash-native-audio`), with persistent sessions, intent detection, and prompt suggestion
- **VAD auto-send** — Web Audio API `AnalyserNode` detects 1.2s of silence after speech, auto-stops recording for natural conversation flow
- **Settings Dialog** — Centralized theme + Director voice settings (8 voices: Charon, Kore, Fenrir, Aoede, Puck, Orus, Leda, Zephyr), replaces standalone theme toggle
- **Language-aware Director Chat** — Director speaks in the story's language; voice selection persisted to localStorage
- **Powered by Gemini** — Subtle branding badge in Director Chat panel
- **Voice preview in Settings** — click a Director voice chip to hear a sample
- **Director-driven intent detection** — Director controls when to trigger generation (explores idea fully before suggesting)
- **Token expiry handling** — WS auth failure recovery + REST getValidToken()
- **404 page** with themed StoryForge design
- **Error boundary** styled to match app theme

### What Needs to Be Built

- **Demo Video** - 4-minute walkthrough for submission

---

## Next Session Plans

- **Book Layout Preference**: Single-page / two-page spread toggle — let users choose their preferred reading layout. With single-page mode, the Director Panel can be wider for better analysis display.
- **Multi-Voice Narration**: Different voices for narrator vs dialogue characters based on gender and age. Instead of one narrator voice, dialogues get character-appropriate voices for immersive audiobook experience.
- **Custom Character Portraits from Photos**: Users can upload their own photos to create personalized characters in the story — enabling auto-biographies and self-insert stories with AI-generated illustrations based on real faces. we will also add privacy policy for fair use of personal photo below the image attached section
