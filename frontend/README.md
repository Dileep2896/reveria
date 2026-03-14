# Reveria Frontend

React + Vite single-page application for the Reveria interactive story engine.

## Stack

- **React 18** with Vite bundler
- **CSS** (glassmorphism design system — no Tailwind)
- **Firebase Auth** (Google Sign-In + email/password)
- **Firestore Client SDK** (library, explore, social features)
- **Web Audio API** (voice capture, VAD silence detection, streaming PCM playback)
- **HTMLFlipBook** (react-pageflip) for interactive book layout

## Quick Start

```bash
npm install
npm run dev          # dev server at http://localhost:5173
npm run build        # production build
npm run preview      # preview production build
```

## Environment Variables

Create a `.env` file (or set in CI):

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_WS_URL=ws://localhost:8000/ws
```

## Project Structure

```
src/
├── App.jsx                     # Root — routing, state orchestration, save/publish flows
├── firebase.js                 # Firebase config + Firestore exports
├── routes.js                   # Centralized route constants (ROUTES object)
├── components/
│   ├── StoryCanvas.jsx         # Interactive flipbook (always spread mode)
│   ├── SceneCard.jsx           # Scene: image + text + audio with drop cap
│   ├── DirectorChat.jsx        # Voice/text brainstorming with Director (Gemini Live)
│   ├── DirectorPanel.jsx       # Director reasoning sidebar
│   ├── ControlBar.jsx          # Prompt input + template + art style + voice
│   ├── VoiceOrb.jsx            # Canvas voice-reactive blob (6 visual modes)
│   ├── LibraryPage.jsx         # Personal bookshelf with 3D book cards
│   ├── ExplorePage.jsx         # Public story browser
│   ├── BookDetailsPage.jsx     # Published book view (likes, ratings, comments)
│   ├── ReadingMode.jsx         # Full-screen karaoke narration
│   ├── PortraitGallery.jsx     # Horizontal scroll character portraits
│   ├── SettingsDialog.jsx      # Theme + Director voice settings
│   ├── scene/                  # SceneCard sub-components
│   ├── director/               # DirectorPanel sub-components
│   └── storybook/              # StoryCanvas sub-components (covers, pages)
├── contexts/
│   ├── ThemeContext.jsx         # Dark/light mode
│   ├── SceneActionsContext.jsx  # Per-scene action dispatch
│   └── ToastContext.jsx         # Global toast notifications
├── hooks/
│   ├── useWebSocket.js         # WebSocket connection + story state management
│   ├── wsHandlers.js           # WS message handler dispatch map
│   ├── useVoiceCapture.js      # Web Audio API recording + VAD
│   ├── useStreamingAudio.js    # Gapless PCM streaming playback
│   ├── useStoryNavigation.js   # Page nav, keyboard, URL sync
│   ├── useAuth.js              # Firebase Auth hook
│   └── useUsage.js             # Usage tracking
└── utils/
    └── audioPlayer.js          # Audio queue utility
```

## Key Architecture Patterns

- **WebSocket-first**: All generation, steering, and Director Chat communication flows through a single WebSocket connection with first-message auth
- **Per-scene streaming**: Scene text, images, and audio arrive independently as they complete — no waiting for full batch
- **Separated generation modes**: ControlBar generation (narrator only) vs Director-triggered generation (full Director pipeline)
- **Voice Activity Detection (VAD)**: Web Audio AnalyserNode computes RMS amplitude; auto-stops recording after 800ms of silence post-speech
- **Streaming audio**: Director voice arrives as incremental PCM chunks via WebSocket, played through Web Audio API with gapless scheduling
- **Mute Director**: Tap the voice orb during Director speech to stop all audio playback; recording resumes automatically

## Testing

```bash
npm run build                    # must build first (requires VITE_FIREBASE_* env vars)
npx playwright install chromium
npx playwright test              # 3 smoke tests
```

## Linting

```bash
npx eslint src/
```

## Deployment

Deployed automatically via GitHub Actions to Firebase Hosting on merge to `main`. See `../.github/workflows/ci.yml`.
