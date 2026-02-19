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
- Scene count support (2 or 4 scenes per generation, validated server-side)
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

## Current State (Feb 19, 2026)

### What's Working
- Full text + image generation pipeline: prompt → Gemini 2.0 Flash → streamed scenes → Imagen 3 illustrations → interactive flipbook
- Conversation continuity (story steering/continuation across multiple prompts)
- 6 art styles with visual pills
- Genre quick-start from cover page
- Character consistency via character sheet extraction
- New Story reset (frontend + backend)
- Dark/light glassmorphism theme
- Responsive layout across screen sizes
- Animated logo, scene reveal animations, drop-cap typography
- Keyboard and dot-based flipbook navigation
- Production-ready Docker setup

### What Needs to Be Built (from storyforge-plan.md)
- **Voice Input** — Web Audio API + MediaRecorder for hands-free story steering (`VoiceInput.jsx`, `useVoiceCapture.js`)
- **Cloud TTS** — Google Cloud Text-to-Speech for scene narration with distinct voices (`tts_client.py`, `audioPlayer.js`)
- **Director Agent** — 3rd agent that explains creative reasoning in real-time (`director.py`, wire to `DirectorPanel.jsx`)
- **ADK Orchestration** — Google Agent Development Kit for multi-agent coordination (`orchestrator.py`)
- **Firestore Persistence** — Cloud Firestore for session state, story history, character profiles (`firestore_client.py`)
- **Tension Arc Visualization** — Recharts graph in Director panel showing narrative tension across scenes (`TensionArc.jsx`)
- **Timeline Slider** — Scene timeline navigation in story canvas
- **Scene Count UI** — Expose the scene count selector (backend already supports 2 or 4)
- **Firebase Hosting** — Deploy frontend SPA
- **Cloud Run Deployment** — Deploy backend container
- **Terraform IaC** — Automated cloud deployment scripts

### Known Issues / Improvements Needed
- **Image generation relevance for continuous stories** — When continuing a story with new scenes, the generated images need to be more contextually relevant to the ongoing narrative. Currently each image prompt is engineered per-scene, but continuations may lose visual narrative thread. Need to pass fuller story context and previous scene descriptions to the Illustrator so images maintain narrative coherence across continuation batches.
- **react-pageflip limitations** — Mouse-based page flipping disabled due to unwanted drag behavior on page edges; 21 pre-allocated page slots allow flipping to empty pages (bounced back via `onFlip` handler but animation still shows)
- **Director Panel** — Currently shows static placeholder cards; needs to be wired to a Director Agent backend
