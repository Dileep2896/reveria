import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './demo-overlay.css';

/**
 * Context-aware architecture overlay for demo recording.
 * Toggle with backtick (`) key. Auto-selects relevant diagram.
 */
export default function DemoOverlay({ generating, chatActive, chatLoading }) {
  const [open, setOpen] = useState(false);
  const [manualSlide, setManualSlide] = useState(null);
  const manualSlideRef = useRef(null);
  const backtickHeld = useRef(false);

  // Keep ref in sync for use inside event handlers
  manualSlideRef.current = manualSlide;

  // Default to pipeline, auto-switch when Director chat opens
  const autoSlide = chatActive ? 'director' : 'pipeline';
  const activeSlide = manualSlide || autoSlide;

  useEffect(() => {
    const down = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

      if (e.key === '`') {
        e.preventDefault();
        backtickHeld.current = true;
        // Toggle open/close only on bare backtick (no number combo)
        // Actual toggle happens on keyup if no number was pressed
      }

      // ` + 1/2/3/4/5 to switch slides (works whether open or not)
      if (backtickHeld.current && '12345'.includes(e.key)) {
        e.preventDefault();
        const slides = { '1': 'pipeline', '2': 'director', '3': 'cloud', '4': 'cicd', '5': 'evolution' };
        const target = slides[e.key];
        if (open && manualSlideRef.current === target) {
          // Same slide pressed again — close
          setOpen(false);
          setManualSlide(null);
        } else {
          setManualSlide(target);
          if (!open) setOpen(true);
        }
        backtickHeld.current = 'combo'; // mark that a combo was used
      }

      if (e.key === 'Escape' && open) {
        setOpen(false);
        setManualSlide(null);
      }
    };

    const up = (e) => {
      if (e.key === '`') {
        // Only toggle if backtick was pressed alone (no number combo)
        if (backtickHeld.current === true) {
          setOpen(p => {
            if (p) setManualSlide(null);
            return !p;
          });
        }
        backtickHeld.current = false;
      }
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="demo-overlay" onClick={() => { setOpen(false); setManualSlide(null); }}>
      <div className="demo-overlay-card" onClick={e => e.stopPropagation()}>
        <div className="demo-slide">
          {activeSlide === 'pipeline' && <PipelineSlide generating={generating} />}
          {activeSlide === 'director' && <DirectorSlide chatActive={chatActive} chatLoading={chatLoading} />}
          {activeSlide === 'cloud' && <CloudSlide />}
          {activeSlide === 'cicd' && <CICDSlide />}
          {activeSlide === 'evolution' && <EvolutionSlide />}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ═══════════════════════════════════════════
   Animated SVG arrows with flowing dots
   ═══════════════════════════════════════════ */

const DASH_ANIM_V = { animation: 'dashFlowV 0.8s linear infinite' };
const DASH_ANIM_H = { animation: 'dashFlowH 0.8s linear infinite' };

function FlowArrowDown() {
  return (
    <div className="demo-arrow-v">
      <svg width="2" height="32" viewBox="0 0 2 32">
        <line x1="1" y1="0" x2="1" y2="32" stroke="#b48cff" strokeWidth="2"
          strokeDasharray="4 4" style={DASH_ANIM_V} opacity="0.7" />
      </svg>
      <svg width="10" height="6" viewBox="0 0 10 6">
        <path d="M1 1l4 4 4-4" stroke="#b48cff" strokeWidth="1.5" fill="none"
          strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      </svg>
    </div>
  );
}

function FlowArrowRight({ bidir }) {
  return (
    <div className="demo-arrow-h">
      {bidir && (
        <svg width="8" height="10" viewBox="0 0 8 10">
          <path d="M7 1L3 5l4 4" stroke="#b48cff" strokeWidth="1.5" fill="none"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        </svg>
      )}
      <svg width="40" height="2" viewBox="0 0 40 2">
        <line x1="0" y1="1" x2="40" y2="1" stroke="#b48cff" strokeWidth="2"
          strokeDasharray="4 4" style={DASH_ANIM_H} opacity="0.7" />
      </svg>
      <svg width="8" height="10" viewBox="0 0 8 10">
        <path d="M1 1l4 4-4 4" stroke="#b48cff" strokeWidth="1.5" fill="none"
          strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      </svg>
    </div>
  );
}

function FlowArrowFork() {
  return (
    <div className="demo-arrow-fork">
      <svg width="100%" height="32" viewBox="0 0 300 32" preserveAspectRatio="none">
        <path d="M150 0 V16 M150 16 H30 M150 16 H270 M30 16 V32 M150 16 V32 M270 16 V32"
          stroke="#b48cff" strokeWidth="1.5" fill="none"
          strokeDasharray="4 4" style={DASH_ANIM_V} opacity="0.6" />
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Shared node component
   ═══════════════════════════════════════════ */

function Node({ label, sub, detail, badge, active, pulse, accent, large, className = '' }) {
  const cls = [
    'demo-node',
    active && 'active',
    pulse && 'pulse',
    large && 'large',
    accent && `accent-${accent}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      {badge && <span className={`demo-node-badge${accent ? ` badge-${accent}` : ''}`}>{badge}</span>}
      <span className="demo-node-label">{label}</span>
      <span className="demo-node-sub">{sub}</span>
      {detail && <span className="demo-node-detail">{detail}</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════
   SLIDE 1: ADK Agent Pipeline
   ═══════════════════════════════════════════ */
function PipelineSlide({ generating }) {
  return (
    <>
      <h3 className="demo-slide-title">ADK Agent Pipeline · Interleaved Output</h3>
      <p className="demo-slide-sub">
        <strong>Gemini native interleaved output</strong> generates text + images in a single call · Imagen 3 upgrades quality
      </p>

      <div className="demo-flow-v">
        {/* Input */}
        <Node
          label="User Prompt"
          sub="Natural language input"
          detail="Pre-filtered by Gemini Flash safety classifier"
          badge="INPUT"
          active
          accent="blue"
        />

        <FlowArrowDown />

        {/* Narrator — interleaved */}
        <Node
          label="Gemini Interleaved Output"
          sub='response_modalities: ["TEXT", "IMAGE"]'
          detail="Single API call produces story text + illustrations together"
          badge="NATIVE"
          active={generating}
          pulse={generating}
          large
          accent="violet"
        />

        <FlowArrowFork />

        {/* Parallel upgrade tasks */}
        <div className="demo-flow-parallel">
          <Node
            label="Imagen 3 Upgrade"
            sub="Vertex AI · 1024×1024"
            detail="Visual DNA + character anchoring · Gemini image as fallback"
            badge="QUALITY"
            active={generating}
            pulse={generating}
            accent="orange"
          />
          <Node
            label="Gemini Native Audio"
            sub="Gemini 2.5 Flash"
            detail="Multi-voice narration per character"
            badge="AUDIO"
            active={generating}
            pulse={generating}
            accent="green"
          />
          <Node
            label="Director Analysis"
            sub="Gemini Flash · per-scene"
            detail="Mood, tension, craft notes, suggestion"
            badge="ANALYSIS"
            active={generating}
            pulse={generating}
          />
        </div>

        <FlowArrowDown />

        {/* Output */}
        <Node
          label="WebSocket Stream"
          sub="Real-time to browser"
          detail="Text → Image → Audio → Director notes per scene"
          badge="OUTPUT"
          active
          accent="orange"
        />
      </div>

      <div className="demo-tech-pills">
        <Pill label="Interleaved Output" hl />
        <Pill label="Google ADK" hl />
        <Pill label="Gemini 2.5 Flash" hl />
        <Pill label="Imagen 3 Upgrade" />
        <Pill label="Gemini Native Audio" hl />
        <Pill label="Visual DNA" />
        <Pill label="Per-scene streaming" />
        <Pill label="Tier 0/1/2 Fallback" />
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════
   SLIDE 2: Director Chat — Gemini Live API
   ═══════════════════════════════════════════ */
function DirectorSlide({ chatActive, chatLoading }) {
  const live = chatActive || true; // always show as active for visual appeal
  return (
    <>
      <h3 className="demo-slide-title">Gemini Live API · Director Chat</h3>
      <p className="demo-slide-sub">
        Persistent bidirectional audio with <strong>server-side VAD</strong>, <strong>native tool calling</strong>, <strong>session resumption</strong>, and <strong>security screening</strong>
      </p>

      <div className="demo-flow-h">
        <Node label="Your Voice" sub="AudioWorklet · 16kHz Int16 PCM" badge="MIC" active={live} accent="green" />
        <FlowArrowRight bidir />
        <Node
          label="Gemini Live Session"
          sub="gemini-live-2.5-flash-native-audio"
          detail="Server-side VAD · native transcription · sliding window compression"
          badge="LIVE API"
          active={live}
          pulse={chatLoading}
          large
          accent="violet"
        />
        <FlowArrowRight />
        <Node label="generate_story" sub="Model-triggered · ADK pipeline" badge="TOOL" active={live} accent="orange" />
      </div>

      <div className="demo-live-features">
        <div className="demo-live-col">
          <h4 className="demo-live-heading">Streaming Architecture</h4>
          <Feature text="AudioWorklet captures Float32 → Int16 PCM off-main-thread" />
          <Feature text="Continuous chunks via send_realtime_input() (~100ms intervals)" />
          <Feature text="Server-side VAD: HIGH start sensitivity, LOW end, 300ms silence" />
          <Feature text="Native input + output audio transcription" />
          <Feature text="Session resumption tokens for auto-reconnect on disconnect" />
        </div>
        <div className="demo-live-col">
          <h4 className="demo-live-heading">Intelligence & Safety</h4>
          <Feature text="Native tool calling: model decides when to trigger generation" />
          <Feature text="Proactive Director comments injected during story generation" />
          <Feature text="director_suggestion steers the Narrator's next scene" />
          <Feature text="2-layer security: input pre-screen + output post-screen" />
          <Feature text="Text input fallback for demo-safe voice alternative" />
        </div>
      </div>

      <div className="demo-tech-pills">
        <Pill label="Gemini Live API" hl />
        <Pill label="Server-Side VAD" hl />
        <Pill label="Native Tool Calling" hl />
        <Pill label="AudioWorklet" hl />
        <Pill label="Native Transcription" hl />
        <Pill label="Session Resumption" />
        <Pill label="Security Screening" />
        <Pill label="SlidingWindow" />
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════
   SLIDE 3: Cloud Infrastructure
   ═══════════════════════════════════════════ */
function CloudSlide() {
  return (
    <>
      <h3 className="demo-slide-title">Google Cloud Architecture</h3>
      <p className="demo-slide-sub">
        Production deployment on GCP with WebSocket streaming, circuit breakers, and atomic state
      </p>

      <div className="demo-infra">
        {/* Left: Frontend */}
        <div className="demo-infra-col">
          <div className="demo-infra-header">Frontend</div>
          <InfraBox label="Firebase Hosting" sub="React SPA · global CDN" badge="CDN" />
          <InfraBox label="WebSocket Client" sub="First-message JWT auth" badge="WS" />
        </div>

        {/* Arrow: Frontend → Backend */}
        <div className="demo-infra-arrow">
          <svg width="100%" height="6" viewBox="0 0 40 6" preserveAspectRatio="none">
            <line x1="0" y1="3" x2="34" y2="3" stroke="#b48cff" strokeWidth="1.5"
              strokeDasharray="4 3" style={DASH_ANIM_H} opacity="0.5" />
            <path d="M33 0.5l4 2.5-4 2.5" stroke="#b48cff" strokeWidth="1.2" fill="none" opacity="0.5" />
          </svg>
        </div>

        {/* Center: Backend */}
        <div className="demo-infra-col demo-infra-col-center">
          <div className="demo-infra-header">Backend · Cloud Run</div>
          <InfraBox label="FastAPI + WebSocket" sub="Async handlers · auto-scaling" badge="COMPUTE" accent="violet" />
          <div className="demo-infra-row">
            <InfraBox label="ADK Agents" sub="Narrator · Director" badge="ADK" small accent="violet" />
            <InfraBox label="Gemini Live" sub="Director Chat sessions" badge="LIVE" small accent="orange" />
          </div>
          <div className="demo-infra-row">
            <InfraBox label="Circuit Breaker" sub="Per-user quota tracking" badge="RESILIENCE" small />
            <InfraBox label="Retry + Backoff" sub="Transient error recovery" badge="RESILIENCE" small />
          </div>
        </div>

        {/* Arrow: Backend → Services */}
        <div className="demo-infra-arrow">
          <svg width="100%" height="6" viewBox="0 0 40 6" preserveAspectRatio="none">
            <line x1="0" y1="3" x2="34" y2="3" stroke="#b48cff" strokeWidth="1.5"
              strokeDasharray="4 3" style={DASH_ANIM_H} opacity="0.5" />
            <path d="M33 0.5l4 2.5-4 2.5" stroke="#b48cff" strokeWidth="1.2" fill="none" opacity="0.5" />
          </svg>
        </div>

        {/* Right: Services */}
        <div className="demo-infra-col">
          <div className="demo-infra-header">Google Cloud Services</div>
          <InfraBox label="Gemini API" sub="2.5 Flash · Live · Vision" badge="AI" accent="violet" />
          <InfraBox label="Vertex AI Imagen 3" sub="1024×1024 · safety filters" badge="AI" accent="orange" />
          <InfraBox label="Gemini Native Audio" sub="Multi-voice TTS via Gemini" badge="AUDIO" accent="green" />
          <InfraBox label="Firestore" sub="Stories · usage · social" badge="DB" />
          <InfraBox label="Cloud Storage" sub="Images · audio · portraits" badge="MEDIA" />
          <InfraBox label="Firebase Auth" sub="Google sign-in · JWT" badge="AUTH" />
        </div>
      </div>

      <div className="demo-tech-pills">
        <Pill label="Google Cloud" hl />
        <Pill label="Cloud Run" hl />
        <Pill label="WebSocket streaming" />
        <Pill label="Per-user circuit breakers" />
        <Pill label="Atomic Firestore transactions" />
        <Pill label="Signed URL fallback" />
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════
   SLIDE 4: CI/CD Pipeline
   ═══════════════════════════════════════════ */
function CICDSlide() {
  return (
    <>
      <h3 className="demo-slide-title">Automated CI/CD Pipeline</h3>
      <p className="demo-slide-sub">
        GitHub Actions runs <strong>tests, builds, and deploys</strong> on every push to main
      </p>

      <div className="demo-flow-v">
        {/* Trigger */}
        <Node
          label="git push main"
          sub="GitHub Actions trigger"
          detail="Concurrency group cancels stale runs"
          badge="TRIGGER"
          active
          accent="blue"
        />

        <FlowArrowFork />

        {/* Parallel test jobs */}
        <div className="demo-flow-parallel">
          <Node
            label="Backend Tests"
            sub="Python 3.12 · pytest"
            detail="8 smoke tests · mocked Firebase"
            badge="TEST"
            active
            pulse
            accent="green"
          />
          <Node
            label="Frontend Tests"
            sub="Node 20 · ESLint · Vite"
            detail="Lint + build + Playwright e2e"
            badge="TEST"
            active
            pulse
            accent="green"
          />
        </div>

        <FlowArrowDown />

        {/* Gate */}
        <Node
          label="All Tests Pass"
          sub="Required status checks"
          badge="GATE"
          active
          accent="violet"
        />

        <FlowArrowFork />

        {/* Parallel deploy jobs */}
        <div className="demo-flow-parallel">
          <Node
            label="Cloud Run Deploy"
            sub="gcloud run deploy --source"
            detail="Dockerfile · auto-scaling · us-central1"
            badge="DEPLOY"
            active
            pulse
            accent="orange"
          />
          <Node
            label="Firebase Hosting"
            sub="npm run build + firebase deploy"
            detail="Production env from GitHub Secrets"
            badge="DEPLOY"
            active
            pulse
            accent="orange"
          />
        </div>

        <FlowArrowDown />

        {/* Live */}
        <Node
          label="Production Live"
          sub="Cloud Run + Firebase CDN"
          detail="Zero-downtime deployment"
          badge="LIVE"
          active
          accent="violet"
        />
      </div>

      <div className="demo-tech-pills">
        <Pill label="GitHub Actions" hl />
        <Pill label="Cloud Run" hl />
        <Pill label="Firebase Hosting" hl />
        <Pill label="Dockerfile" />
        <Pill label="deploy.sh" />
        <Pill label="Playwright e2e" />
        <Pill label="pytest" />
        <Pill label="Service Account IAM" />
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════
   SLIDE 5: Iterative Evolution
   ═══════════════════════════════════════════ */

const EVOLUTION_TRACKS = [
  {
    title: 'Image Generation',
    accent: 'orange',
    steps: [
      { label: 'Separate API calls', desc: 'Text first, then image — disjointed, slow' },
      { label: 'Interleaved output', desc: 'Gemini generates text + image in single call (native modality)' },
      { label: 'Imagen 3 upgrade', desc: 'Parallel quality upgrade; Gemini image as tier-0 fallback' },
      { label: 'Character DNA', desc: 'Hex colors, face shapes, signature items, anti-drift anchors' },
      { label: 'Visual DNA', desc: 'Anchor portraits → Gemini Vision → 150-word appearance descriptors' },
    ],
  },
  {
    title: 'Audio Narration',
    accent: 'green',
    steps: [
      { label: 'Google Cloud TTS', desc: 'Robotic Wavenet voices, separate billing' },
      { label: 'Gemini Native Audio', desc: 'Audiobook-quality, emotion-aware narration' },
      { label: 'Per-scene streaming', desc: 'Audio fires as each scene completes, not batch' },
      { label: 'Verbatim enforcement', desc: '[SCRIPT] markers prevent model from paraphrasing' },
    ],
  },
  {
    title: 'Director Intelligence',
    accent: 'violet',
    steps: [
      { label: 'Post-batch analysis', desc: 'Reactive observer, analyzed after generation' },
      { label: 'Per-scene live notes', desc: 'Mood, tension, craft notes stream during generation' },
      { label: 'Director-as-Driver', desc: 'Suggestion field injected into Narrator next prompt' },
      { label: 'Gemini Live API', desc: 'Bidirectional voice, native tool calling, zero extra API calls' },
      { label: 'Client-side VAD', desc: 'Web Audio silence detection for natural conversation flow' },
      { label: 'Server-side VAD', desc: 'Eliminated client VAD — Gemini handles speech detection natively' },
      { label: 'AudioWorklet streaming', desc: 'Off-thread PCM capture → send_realtime_input, zero latency' },
      { label: 'Voice-Reactive Orb', desc: 'Canvas blob reacts to real-time audio amplitude from mic & speaker' },
    ],
  },
  {
    title: 'Pipeline Architecture',
    accent: 'blue',
    steps: [
      { label: 'Batch sequential', desc: 'All text, then all images, then all audio' },
      { label: 'Interleaved + parallel', desc: 'Gemini native text+image, then per-scene audio/analysis tasks' },
      { label: 'Mid-gen steering', desc: 'Users steer story direction during active generation' },
      { label: 'Tiered fallback', desc: 'Imagen → Gemini native image → graceful degradation' },
    ],
  },
];

const ACCENT_COLORS = {
  orange: '#ffa86c',
  green: '#34d399',
  violet: '#b48cff',
  blue: '#60a5fa',
};

function EvolutionSlide() {
  return (
    <>
      <h3 className="demo-slide-title">Iterative Evolution</h3>
      <p className="demo-slide-sub">
        How we <strong>brainstormed and improved</strong> each system through 64+ development sessions
      </p>

      <div className="demo-evo-grid">
        {EVOLUTION_TRACKS.map((track) => {
          const color = ACCENT_COLORS[track.accent];
          return (
            <div key={track.title} className="demo-evo-track">
              <div className="demo-evo-track-header" style={{ color }}>
                <span className="demo-evo-track-dot" style={{ background: color }} />
                {track.title}
              </div>
              <div className="demo-evo-steps">
                {track.steps.map((step, i) => (
                  <div key={i} className="demo-evo-step">
                    {i > 0 && (
                      <div className="demo-evo-connector">
                        <svg width="2" height="10" viewBox="0 0 2 10">
                          <line x1="1" y1="0" x2="1" y2="10" stroke={color} strokeWidth="1.5"
                            strokeDasharray="2 2" style={DASH_ANIM_V} opacity="0.4" />
                        </svg>
                      </div>
                    )}
                    <div className="demo-evo-step-card" style={{ borderColor: `${color}20` }}>
                      <div className="demo-evo-step-num" style={{ background: `${color}18`, color }}>{i + 1}</div>
                      <div className="demo-evo-step-content">
                        <span className="demo-evo-step-label">{step.label}</span>
                        <span className="demo-evo-step-desc">{step.desc}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="demo-tech-pills">
        <Pill label="64+ Sessions" hl />
        <Pill label="Interleaved Output" hl />
        <Pill label="Character DNA" />
        <Pill label="Visual DNA" hl />
        <Pill label="Anchor Portraits" />
        <Pill label="Per-scene streaming" hl />
        <Pill label="Native Tool Calling" />
        <Pill label="Gemini Vision" />
      </div>
    </>
  );
}

/* ──── Shared sub-components ──── */

function Feature({ text }) {
  return (
    <div className="demo-feat-item">
      <span className="demo-feat-dot" />
      <span className="demo-feat-text">{text}</span>
    </div>
  );
}

function Pill({ label, hl }) {
  return <span className={`demo-tech-pill${hl ? ' highlight' : ''}`}>{label}</span>;
}

function InfraBox({ label, sub, badge, small, accent }) {
  return (
    <div className={`demo-infra-box${small ? ' small' : ''}${accent ? ` accent-${accent}` : ''}`}>
      {badge && <span className={`demo-infra-badge${accent ? ` badge-${accent}` : ''}`}>{badge}</span>}
      <span className="demo-infra-label">{label}</span>
      <span className="demo-infra-sub">{sub}</span>
    </div>
  );
}
