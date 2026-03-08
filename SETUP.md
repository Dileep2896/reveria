# Reveria — Local Setup Guide

## Prerequisites

- **Python 3.12+**
- **Node.js 20+** and npm
- **Google Cloud SDK** (`gcloud`) — [Install](https://cloud.google.com/sdk/docs/install)
- **GCP Project** with Vertex AI API, Cloud Storage, and Firestore enabled
- **Firebase Project** with Authentication (Google Sign-In) and Firestore

---

## 1. Clone the repo

```bash
git clone https://github.com/Dileep2896/reveria.git
cd storyforge
```

---

## 2. Backend Setup

```bash
cd backend
```

### Create virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash
VERTEX_AI_LOCATION=us-central1
TTS_VOICE_NAME=en-US-Studio-O
FIRESTORE_COLLECTION=story_sessions
GCS_BUCKET=your-gcs-bucket-name
```

### GCP Authentication

The backend needs Google Cloud credentials for Firestore, GCS, and Vertex AI.

**Option A — Application Default Credentials (recommended for local dev):**
```bash
gcloud auth application-default login
```

**Option B — Service Account Key:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

### Firebase Admin SDK

The backend uses Firebase Admin SDK for token verification. It auto-initializes from either:
- Application Default Credentials (if `GOOGLE_APPLICATION_CREDENTIALS` or `gcloud auth` is set)
- The `FIREBASE_PROJECT_ID` env var (falls back to `GOOGLE_CLOUD_PROJECT`)

### Run the backend

```bash
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API is now running at `http://localhost:8000`. Health check: `GET http://localhost:8000/health`

---

## 3. Frontend Setup

Open a new terminal:

```bash
cd frontend
```

### Install dependencies

```bash
npm install
```

### Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your Firebase config:

```env
VITE_FIREBASE_API_KEY=your-firebase-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_WS_URL=ws://localhost:8000/ws
```

You can find these values in the [Firebase Console](https://console.firebase.google.com) → Project Settings → General → Your apps → Web app config.

### Run the frontend

```bash
npm run dev
```

The app is now running at `http://localhost:3000`.

---

## 4. Docker (Alternative)

If you prefer Docker, both services can be started with:

```bash
cd storyforge
docker compose up --build
```

This starts:
- Backend on `http://localhost:8000`
- Frontend on `http://localhost:5173`

Make sure `backend/.env` is configured before running.

---

## Quick Reference

| Command | What it does |
|---------|-------------|
| `cd backend && source .venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload` | Start backend (dev, hot-reload) |
| `cd frontend && npm run dev` | Start frontend (dev, HMR) |
| `cd frontend && npm run build` | Production build → `dist/` |
| `cd frontend && npm run preview` | Preview production build locally |
| `cd frontend && npm run lint` | Run ESLint |
| `cd backend && pytest -v` | Run backend tests (install `requirements-test.txt` first) |
| `cd frontend && npm test` | Run Playwright E2E tests |
| `docker compose up --build` | Start both services via Docker |

---

## Project Structure

```
storyforge/
├── backend/
│   ├── agents/          # ADK agents (narrator, illustrator, director)
│   ├── handlers/        # WebSocket message handlers
│   ├── models/          # Pydantic models
│   ├── routers/         # REST API routers
│   ├── services/        # Business logic (Gemini, Firestore, GCS, TTS)
│   ├── templates/       # Story template configs
│   ├── utils/           # Retry, helpers
│   ├── tests/           # pytest tests
│   ├── main.py          # FastAPI entrypoint + WebSocket
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/       # Custom hooks (WebSocket, save, navigation)
│   │   ├── contexts/    # Theme, Auth contexts
│   │   ├── data/        # Art styles, templates, languages
│   │   └── utils/       # Helpers
│   ├── public/          # Static assets
│   └── Dockerfile
│
├── docker-compose.yml
├── ARCHITECTURE.md      # Technical architecture docs
├── HISTORY.md           # Development history
└── .github/workflows/   # CI/CD (GitHub Actions)
```

---

## Ports

| Service | Dev Port | Docker Port | Cloud |
|---------|----------|-------------|-------|
| Backend | 8000 | 8000 | 8080 (Cloud Run) |
| Frontend | 3000 | 5173 | Firebase Hosting |

---

## Troubleshooting

**"Permission denied" on GCS uploads:**
Make sure your GCP credentials have `Storage Object Admin` role on the bucket.

**Firebase auth errors (4003 WebSocket close):**
Verify `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_PROJECT_ID` match your Firebase project. Ensure Google Sign-In is enabled in Firebase Console → Authentication → Sign-in method.

**Imagen quota errors:**
Imagen 3 has per-minute quotas. The backend has a built-in circuit breaker and semaphore — images will retry or show a placeholder if quota is exhausted.

**"Module not found" on backend:**
Make sure the venv is activated: `source .venv/bin/activate`
