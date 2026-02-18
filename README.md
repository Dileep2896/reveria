# StoryForge

**An interactive multimodal story engine powered by Google Gemini & ADK**

StoryForge lets users describe a scenario via voice or text — a mystery, a bedtime story, a historical event — and builds it live. It generates character portraits, scene illustrations, narrated voiceover, and an interactive storyboard, all streaming as interleaved output. Users can interrupt and steer the narrative in real-time, and the story dynamically reshapes.

Built for the [Gemini Live Agent Challenge](https://devpost.com/) — Creative Storyteller Track.

---

## Features

- **Multimodal Storytelling** — Text, images, and audio narration stream together in real-time
- **Voice Steering** — Redirect the story mid-flow with voice commands ("make the villain scarier", "add a plot twist")
- **Director Mode** — A live panel revealing the agent's creative reasoning: why it chose certain imagery, narrative structure decisions, tension arcs
- **Genre & Style Selection** — Mystery, Fantasy, Sci-Fi, Children's, Historical, Horror + visual styles (Watercolor, Noir, Anime, Photorealistic, Storybook)
- **Interleaved Output** — Not sequential (text → image → audio) but woven together as a living storyboard

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                  │
│                     React 18 + Tailwind CSS + Vite                  │
│                                                                     │
│   ┌────────────────────────┐    ┌─────────────────────────────┐     │
│   │     STORY CANVAS       │    │      DIRECTOR MODE          │     │
│   │                        │    │                             │     │
│   │  ● Scene cards         │    │  ● Agent reasoning log     │     │
│   │  ● Generated images    │    │  ● Narrative structure     │     │
│   │  ● Audio narration     │    │  ● "Why this image?"       │     │
│   │  ● Text overlays       │    │  ● Tension arc graph       │     │
│   │  ● Timeline slider     │    │  ● Character profiles      │     │
│   └────────────────────────┘    └─────────────────────────────┘     │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  CONTROL BAR                                                │   │
│   │  [ Voice Input ]  [ Text Input ]  [ Pause ]  [ Redo ]      │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   Voice: Web Audio API → MediaRecorder                              │
│   Comms: WebSocket (wss://) for real-time streaming                 │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                    WebSocket (wss://)
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                      BACKEND (FastAPI)                               │
│                     Google Cloud Run                                 │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  WebSocket Handler                                          │   │
│   │  ● Receives voice/text input                                │   │
│   │  ● Manages session state                                    │   │
│   │  ● Streams interleaved output back to client                │   │
│   └──────────────────────┬──────────────────────────────────────┘   │
│                          │                                          │
│   ┌──────────────────────▼──────────────────────────────────────┐   │
│   │              STORY ORCHESTRATOR (ADK Root Agent)             │   │
│   │                                                              │   │
│   │   ┌──────────────┐  ┌───────────────┐  ┌────────────────┐   │   │
│   │   │   Narrator   │  │  Illustrator  │  │   Director     │   │   │
│   │   │    Agent     │  │    Agent      │  │    Agent       │   │   │
│   │   │              │  │               │  │                │   │   │
│   │   │  Writes      │  │  Generates    │  │  Explains      │   │   │
│   │   │  story text  │  │  scene        │  │  creative      │   │   │
│   │   │  + dialogue  │  │  images       │  │  reasoning     │   │   │
│   │   └──────┬───────┘  └───────┬───────┘  └───────┬────────┘   │   │
│   │          │                  │                   │            │   │
│   └──────────┼──────────────────┼───────────────────┼────────────┘   │
│              │                  │                   │                │
│   ┌──────────▼──────────────────▼───────────────────▼────────────┐   │
│   │                    GOOGLE AI SERVICES                        │   │
│   │                                                              │   │
│   │   Gemini 2.0 Flash       Imagen 3          Cloud TTS        │   │
│   │   (Live API /            (Scene             (Narration      │   │
│   │    Interleaved           illustrations)     voiceover)      │   │
│   │    output)                                                   │   │
│   └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  SESSION STORE — Cloud Firestore                            │   │
│   │  Story state, scene history, character profiles              │   │
│   └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Agent Orchestration Flow

```
                        User Input (voice / text)
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   Story Orchestrator   │
                    │     (ADK Root Agent)    │
                    └────────────┬───────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
     ┌────────────────┐ ┌───────────────┐ ┌────────────────┐
     │ Narrator Agent │ │  Cloud TTS    │ │ Director Agent │
     │                │ │               │ │                │
     │ Story text +   │ │ Narration     │ │ Reasoning      │
     │ scene markers  │ │ audio per     │ │ commentary     │
     └───────┬────────┘ │ paragraph     │ └───────┬────────┘
             │          └───────────────┘         │
             ▼                                    │
     ┌───────────────┐                            │
     │  Illustrator  │                            │
     │    Agent      │                            │
     │               │                            │
     │ Scene images  │                            │
     │ per marker    │                            │
     └───────┬───────┘                            │
             │                                    │
             └────────────────┬───────────────────┘
                              ▼
                    ┌─────────────────┐
                    │ WebSocket Stream │
                    │  (interleaved)   │
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │    Frontend     │
                    │ text + image +  │
                    │ audio + reason  │
                    └─────────────────┘
```

---

## Interleaved Output Example

This is the key differentiator — modalities are *woven together*, not appended sequentially:

```
[TEXT]      "The detective pushed open the creaking door..."
[IMAGE]     → dimly lit doorway, noir style
[AUDIO]     → narration with gravelly voice
[DIRECTOR]  → "Opening with sensory detail (sound) to build tension."

[TEXT]      "Inside, the room was chaos — papers scattered..."
[IMAGE]     → ransacked office interior
[AUDIO]     → narration, tone shifts to urgency
[DIRECTOR]  → "Escalating disorder signals rising stakes."
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + Tailwind CSS + Vite | Story canvas, director mode, controls |
| Voice Input | Web Audio API + MediaRecorder | Capture user voice for steering |
| Real-time Comms | WebSocket (native) | Stream interleaved output to client |
| Backend | Python 3.12 + FastAPI + Uvicorn | WebSocket handler, orchestration |
| Agent Framework | Google ADK | Multi-agent orchestration |
| LLM | Gemini 2.0 Flash (Live API) | Story generation, interleaved output |
| Image Gen | Imagen 3 (via Vertex AI) | Scene illustrations, character portraits |
| Voice Output | Google Cloud Text-to-Speech | Story narration with distinct voices |
| Database | Cloud Firestore | Session state, story persistence |
| Hosting | Google Cloud Run + Firebase Hosting | Backend + frontend deployment |
| Container | Docker | Reproducible builds |

---

## Project Structure

```
storyforge/
├── frontend/
│   ├── src/
│   │   ├── App.jsx                    # Main app — split-panel layout
│   │   ├── components/
│   │   │   ├── StoryCanvas.jsx        # Story display area
│   │   │   ├── SceneCard.jsx          # Scene: image + text + audio
│   │   │   ├── DirectorPanel.jsx      # Agent reasoning sidebar
│   │   │   ├── ControlBar.jsx         # Input controls
│   │   │   ├── TensionArc.jsx         # Narrative tension graph
│   │   │   ├── VoiceInput.jsx         # Hold-to-talk + waveform
│   │   │   ├── GenrePicker.jsx        # Story setup screen
│   │   │   └── StyleSelector.jsx      # Visual style selection
│   │   └── hooks/
│   │       ├── useWebSocket.js        # WebSocket connection hook
│   │       └── useVoiceCapture.js     # Web Audio API hook
│   ├── Dockerfile
│   └── package.json
├── backend/
│   ├── main.py                        # FastAPI + WebSocket endpoint
│   ├── agents/
│   │   ├── orchestrator.py            # ADK root agent
│   │   ├── narrator.py                # Story text generation
│   │   ├── illustrator.py             # Image generation
│   │   └── director.py                # Creative reasoning
│   ├── services/
│   │   ├── gemini_client.py           # Gemini API wrapper
│   │   ├── imagen_client.py           # Imagen 3 via Vertex AI
│   │   ├── tts_client.py              # Cloud Text-to-Speech
│   │   └── firestore_client.py        # Session state
│   ├── models/
│   │   └── story_state.py             # Pydantic models
│   ├── requirements.txt
│   └── Dockerfile
├── infra/
│   ├── main.tf                        # Terraform for Cloud Run + Firestore
│   ├── variables.tf
│   └── outputs.tf
├── docker-compose.yml                 # Local dev environment
└── README.md
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.12+
- Docker (optional, for containerized dev)
- Google Cloud account with APIs enabled

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/storyforge.git
cd storyforge
```

### 2. Backend Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your API keys
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

### 4. Run Locally

```bash
# Terminal 1 — Backend
cd backend && source .venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open **http://localhost:5173** — type a story prompt and see the echo response.

### 5. Run with Docker

```bash
docker compose up --build
```

---

## GCP Setup

```bash
# Authenticate
gcloud auth login
gcloud config set project storyforge-hackathon

# Enable required APIs
gcloud services enable \
  aiplatform.googleapis.com \
  texttospeech.googleapis.com \
  firestore.googleapis.com \
  run.googleapis.com \
  generativelanguage.googleapis.com

# Set application default credentials
gcloud auth application-default login
gcloud auth application-default set-quota-project storyforge-hackathon
```

---

## Environment Variables

```env
GOOGLE_CLOUD_PROJECT=storyforge-hackathon
GEMINI_API_KEY=your-api-key
GEMINI_MODEL=gemini-2.0-flash
VERTEX_AI_LOCATION=us-central1
TTS_VOICE_NAME=en-US-Studio-O
FIRESTORE_COLLECTION=story_sessions
VITE_WS_URL=ws://localhost:8000/ws
```

---

## License

MIT
