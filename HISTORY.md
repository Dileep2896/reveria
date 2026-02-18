# StoryForge Development History

## Week 1 - Foundation

### Day 1 (Feb 18, 2026)

**Session 1: Project Setup & Core Pipeline**

- Initialized monorepo with `/frontend` (React 18 + Vite + Tailwind CSS) and `/backend` (Python 3.12 + FastAPI)
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

**What's Working:**
- Full text generation pipeline: user prompt -> Gemini 2.0 Flash -> streamed scenes -> glass scene cards
- Conversation continuity within a session (story steering)
- Dark/light glassmorphism theme
- Animated logo with forge sparks

**Next Up:**
- Image generation with Imagen 3 (scene illustrations)
- Cloud TTS for narration audio
- Director agent for creative reasoning panel
