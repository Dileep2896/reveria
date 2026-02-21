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
- Concurrent image generation with `asyncio.gather` — all scenes in a batch generate in parallel
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
- Added art style selection — pills in ControlBar send style to backend, appended to Imagen prompts
- Genre quick-start pills populate the input field with genre-appropriate starter prompts
- Story continuation — follow-up prompts continue the narrative with new scenes
- New Story button — resets frontend state and backend session (cancels in-flight tasks, clears Narrator history, recreates Illustrator)
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
  - **Header**: padding, pill sizes, button sizes, theme toggle — all scale with viewport
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
- Attempted spine shadow overlay — removed because it stayed visible during page flips
- Attempted page edge thickness layers — reverted per user feedback
- Fixed image edge alignment:
  - Moved `rounded-lg` + `overflow: hidden` to container div instead of `<img>`
  - Removed glass border and box-shadow from images
  - Set container background to `var(--book-page-bg)` to match page color
  - Added `transform: scale(1.04)` to crop out Imagen's baked-in black letterboxing edges
  - Added `display: block` to eliminate inline image gap

**Session 8: Layout Optimization — More Space for the Book**

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

**Session 9: Director Panel — Structured Data & Collapsible Cards**

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
  - Added `_accumulated_story` to Illustrator — appends each batch's text with `---` separators so `extract_characters()` sees the full cross-batch narrative
  - `extract_characters()` now merges with existing character sheet instead of rebuilding from scratch — sends existing sheet in the prompt with instructions to preserve entries and only add new characters
  - On NONE result or error, existing character sheet is preserved instead of cleared (previous characters still exist in the story)
  - Added `accumulate_story()` calls in both manual pipeline (`main.py`) and ADK pipeline (`orchestrator.py`) before `extract_characters()`
  - Reset naturally clears accumulated state since `Illustrator()` is re-created on "New Story"
- Fixed pageflip empty-page bounce animation:
  - Replaced `flip()` with `turnToPage()` in `onFlip` bounce-back handler — `turnToPage` is instant (no 800ms flip animation)
  - Reduced `setTimeout` delay from 50ms to 0ms for earliest safe execution
  - Touch swipes past content now snap back instantly instead of showing a visible flip-back animation
- Removed scene count of 4 — hardcoded to 2 scenes per generation:
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
  - Optimistic Firestore update (`is_favorite` field) — no loading skeleton on toggle
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

**Session 18: Per-Scene Actions — Regen Image, Regen Scene, Delete**

- Implemented three new scene-level editing operations via WebSocket:
  - **Regen Image**: regenerates only the illustration for a scene (keeps text)
  - **Regen Scene**: rewrites scene text via Gemini + regenerates image + audio in parallel
  - **Delete Scene**: removes scene from Firestore with narrator history tracking
- New backend helper `_rewrite_scene_text()` — uses Gemini with full story context for coherent rewrites
- New WS message types: `regen_start`, `regen_done`, `regen_error`, `scene_deleted`
- Auto-session recovery: scene actions auto-load story from Firestore if WS session was lost
- Narrator history updated on regen/delete to maintain continuity (`[Scene X was rewritten/removed]`)
- `total_scene_count` kept as high-water mark — deleted scene numbers never reused
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

- Fixed Library "New Story" button — now properly auto-saves current story + resets state (was just navigating to `/`)
  - `LibraryPage` accepts `onNewStory` prop instead of using `useNavigate`
  - Both empty-state CTA and "+" card use `onNewStory`
- Page clamping: prevents viewing beyond available scenes on stale URLs or after deletions
- WebSocket connection gating: waits for story state to resolve before opening connection
- Image regen reveal uses distinct animation (`imageRegenReveal`) vs initial load (`imageFadeIn`)
- Text regen animations: `textRegenLine` (blur-dissolve), `textRegenDropCap` (enlarge + glow)

---

## Current State (Feb 20, 2026)

### What's Working
- Full text + image generation pipeline: prompt → Gemini 2.0 Flash → streamed scenes → Imagen 3 illustrations → interactive flipbook
- Conversation continuity (story steering/continuation across multiple prompts)
- Cross-batch character visual consistency via accumulated story text and character sheet merging
- 6 art styles with custom glassmorphism dropdown
- Genre quick-start from cover page
- New Story reset (frontend + backend)
- Dark/light glassmorphism theme
- Responsive layout across screen sizes
- Animated logo, scene reveal animations, drop-cap typography
- Keyboard and dot-based flipbook navigation
- Instant snap-back on touch swipe past content pages
- Production-ready Docker setup
- Voice input via MediaRecorder (`useVoiceCapture.js`) with Gemini transcription
- Cloud TTS narration per scene with compact inline audio player
- Director Agent with structured JSON analysis — narrative arc, characters, tension, visual style
- ADK orchestration pipeline — SequentialAgent → ParallelAgent (Illustrator + Director + TTS)
- Director Panel with glanceable visual summaries and collapsible detail text
- Tension bar chart visualization with per-scene bars and trend indicators
- Per-batch director data tracking — director analysis follows scene pagination
- Firebase Auth (Google Sign-In) and Firestore persistence (stories, scenes, generations)
- Save flow with 3-tier optimization (instant when metadata available, API call only on first save)
- Background book meta generation via WebSocket (`book_meta` message)
- Library page with 3D book cards, favorites, status filters, search, sort
- Explore page with public story browsing, like system, liked filter, search, sort
- Completed book protection — read-only regardless of entry point
- URL-based routing with story resume on page reload
- Image error handling with per-reason user messages
- Per-scene actions: regenerate image, regenerate scene (text+image+audio), delete scene
- Scene titles generated by Narrator (`[SCENE: Title]` markers)
- Configurable scene count (1 or 2 per generation)
- Global toast notification system (success/error/warning/info) with glassmorphism styling
- Header button hover effects (glow lift, shimmer sweep, rotation, press feedback)
- Auto-session recovery for scene actions when WS session is lost

### What Needs to Be Built
- **Firebase Hosting** — Deploy frontend SPA
- **Cloud Run Deployment** — Deploy backend container
- **Terraform IaC** — Automated cloud deployment scripts
- **Demo Video** — 4-minute walkthrough for submission

### Known Issues / Improvements Needed
- **react-pageflip limitations** — Mouse-based page flipping disabled due to unwanted drag behavior on page edges; 21 pre-allocated page slots exist to avoid React reconciliation conflicts
