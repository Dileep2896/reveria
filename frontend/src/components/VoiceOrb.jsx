import { useRef, useEffect } from 'react';

/**
 * Premium voice orb — Siri-inspired multi-blob design.
 *
 * Multiple soft overlapping shapes blend Dream Violet (#b48cff) and
 * Story Amber (#ffa86c) with heavy gaussian blur for an organic,
 * luminous feel. Each blob moves independently for lifelike motion.
 *
 * Modes: idle, recording, speaking, loading, watching, waiting
 */

const TAU = Math.PI * 2;

// Brand palette
const VIOLET   = [180, 140, 255]; // #b48cff
const AMBER    = [255, 168, 108]; // #ffa86c
const DEEP_V   = [139, 92, 246];  // deeper violet
const LIGHT_V  = [212, 168, 255]; // highlight violet
const WARM     = [255, 207, 163]; // warm amber highlight
const RED      = [239, 68, 68];   // recording red
const RED_LIGHT = [255, 120, 100];

// Mode-specific palettes (array of blob colors)
const MODE_PALETTES = {
  idle:      [VIOLET, DEEP_V, AMBER, LIGHT_V],
  recording: [RED, RED_LIGHT, [255, 80, 80], [200, 50, 50]],
  speaking:  [AMBER, WARM, VIOLET, [255, 140, 80]],
  loading:   [VIOLET, LIGHT_V, DEEP_V, [160, 120, 240]],
  watching:  [VIOLET, DEEP_V, LIGHT_V, [140, 100, 220]],
  waiting:   [AMBER, WARM, VIOLET, LIGHT_V],
};

// Mode-specific animation speeds
const MODE_SPEEDS = {
  idle:      { orbit: 0.3,  pulse: 0.4,  wobble: 0.6 },
  recording: { orbit: 0.8,  pulse: 1.2,  wobble: 1.5 },
  speaking:  { orbit: 0.6,  pulse: 0.8,  wobble: 1.0 },
  loading:   { orbit: 1.2,  pulse: 0.6,  wobble: 0.8 },
  watching:  { orbit: 0.2,  pulse: 0.3,  wobble: 0.4 },
  waiting:   { orbit: 0.4,  pulse: 0.5,  wobble: 0.5 },
};

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpColor(a, b, t) { return a.map((v, i) => v + (b[i] - v) * t); }
function rgba(c, a) { return `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`; }

// Simple smooth noise using multiple sine waves
function smoothNoise(t, seed) {
  return (
    Math.sin(t * 1.0 + seed * 1.7) * 0.5 +
    Math.sin(t * 2.3 + seed * 3.1) * 0.3 +
    Math.sin(t * 0.7 + seed * 5.3) * 0.2
  );
}

export default function VoiceOrb({ mode = 'idle', getAmplitude, size = 72 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef({
    smoothAmp: 0,
    time: 0,
    prevMode: mode,
    modeT: 1,
    // 4 blob states
    blobs: [
      { phase: 0,     seed: 1.0 },
      { phase: TAU/4,  seed: 2.7 },
      { phase: TAU/2,  seed: 4.3 },
      { phase: 3*TAU/4, seed: 6.1 },
    ],
    prevPalette: MODE_PALETTES.idle,
    prevSpeeds: MODE_SPEEDS.idle,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const pxSize = size * dpr;
    canvas.width = pxSize;
    canvas.height = pxSize;

    const st = stateRef.current;
    const cx = size / 2;
    const cy = size / 2;
    const baseR = size * 0.22;

    // Detect mode change
    if (st.prevMode !== mode) {
      // Snapshot current interpolated palette
      st.prevPalette = st.prevPalette.map((c, i) =>
        lerpColor(c, (MODE_PALETTES[st.prevMode] || MODE_PALETTES.idle)[i], st.modeT)
      );
      st.prevSpeeds = {
        orbit: lerp(st.prevSpeeds.orbit, (MODE_SPEEDS[st.prevMode] || MODE_SPEEDS.idle).orbit, st.modeT),
        pulse: lerp(st.prevSpeeds.pulse, (MODE_SPEEDS[st.prevMode] || MODE_SPEEDS.idle).pulse, st.modeT),
        wobble: lerp(st.prevSpeeds.wobble, (MODE_SPEEDS[st.prevMode] || MODE_SPEEDS.idle).wobble, st.modeT),
      };
      st.modeT = 0;
      st.prevMode = mode;
    }

    let lastTime = performance.now();

    function draw(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // Smooth amplitude
      let rawAmp = 0;
      try { rawAmp = typeof getAmplitude === 'function' ? (getAmplitude() || 0) : 0; } catch { rawAmp = 0; }
      const attack = rawAmp > st.smoothAmp ? 14 : 5;
      st.smoothAmp += (rawAmp - st.smoothAmp) * Math.min(1, attack * dt);
      const amp = st.smoothAmp;

      // Mode transition (smooth over ~0.4s)
      st.modeT = Math.min(1, st.modeT + dt * 2.5);
      const mt = st.modeT;
      // Ease in-out
      const eased = mt < 0.5 ? 2 * mt * mt : 1 - Math.pow(-2 * mt + 2, 2) / 2;

      const palette = MODE_PALETTES[mode] || MODE_PALETTES.idle;
      const speeds = MODE_SPEEDS[mode] || MODE_SPEEDS.idle;
      const curPalette = palette.map((c, i) => lerpColor(st.prevPalette[i] || c, c, eased));
      const curSpeeds = {
        orbit: lerp(st.prevSpeeds.orbit, speeds.orbit, eased),
        pulse: lerp(st.prevSpeeds.pulse, speeds.pulse, eased),
        wobble: lerp(st.prevSpeeds.wobble, speeds.wobble, eased),
      };

      st.time += dt;
      const t = st.time;

      // Clear
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      // === Layer 1: Deep ambient glow ===
      const glowR = baseR * (2.2 + amp * 0.6);
      const glowGrad = ctx.createRadialGradient(cx, cy, baseR * 0.2, cx, cy, glowR);
      const glowColor = lerpColor(curPalette[0], curPalette[2], 0.3 + Math.sin(t * 0.5) * 0.2);
      glowGrad.addColorStop(0, rgba(glowColor, 0.15 + amp * 0.1));
      glowGrad.addColorStop(0.4, rgba(glowColor, 0.06 + amp * 0.04));
      glowGrad.addColorStop(1, rgba(glowColor, 0));
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, TAU);
      ctx.fillStyle = glowGrad;
      ctx.fill();

      // === Layer 2: Soft blobs (the magic) ===
      // Draw 4 overlapping blurred ellipses that orbit the center
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      for (let i = 0; i < 4; i++) {
        const blob = st.blobs[i];
        const color = curPalette[i];

        // Orbit — each blob has its own orbit path
        blob.phase += dt * curSpeeds.orbit * (0.7 + i * 0.2);
        const orbitR = baseR * (0.25 + amp * 0.15 + smoothNoise(t * curSpeeds.wobble, blob.seed) * 0.15);
        const bx = cx + Math.cos(blob.phase) * orbitR;
        const by = cy + Math.sin(blob.phase * (0.8 + i * 0.1)) * orbitR;

        // Blob size — breathes and reacts to amplitude
        const breathing = smoothNoise(t * curSpeeds.pulse, blob.seed + 10) * 0.15;
        const blobR = baseR * (0.65 + breathing + amp * 0.25);

        // Draw soft radial gradient blob
        const grad = ctx.createRadialGradient(bx, by, 0, bx, by, blobR);
        const opacity = 0.35 + amp * 0.2;
        grad.addColorStop(0, rgba(color, opacity));
        grad.addColorStop(0.5, rgba(color, opacity * 0.5));
        grad.addColorStop(1, rgba(color, 0));

        ctx.beginPath();
        ctx.arc(bx, by, blobR, 0, TAU);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();

      // === Layer 3: Core — bright center that ties blobs together ===
      const coreR = baseR * (0.55 + amp * 0.15 + Math.sin(t * curSpeeds.pulse) * 0.04);
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      const coreColor = lerpColor(curPalette[0], curPalette[1], 0.5 + Math.sin(t * 0.7) * 0.3);
      coreGrad.addColorStop(0, rgba([255, 255, 255], 0.5 + amp * 0.2));
      coreGrad.addColorStop(0.3, rgba(coreColor, 0.6 + amp * 0.15));
      coreGrad.addColorStop(0.7, rgba(coreColor, 0.2));
      coreGrad.addColorStop(1, rgba(coreColor, 0));
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, TAU);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // === Layer 4: Specular highlight (glass effect) ===
      const specX = cx - baseR * 0.12;
      const specY = cy - baseR * 0.15;
      const specR = baseR * 0.3;
      const specGrad = ctx.createRadialGradient(specX, specY, 0, specX, specY, specR);
      specGrad.addColorStop(0, `rgba(255,255,255,${0.25 + amp * 0.1})`);
      specGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(specX, specY, specR, 0, TAU);
      ctx.fillStyle = specGrad;
      ctx.fill();

      // === Layer 5: Mode-specific accents ===

      // Speaking: pulsing outer ring synced to amplitude
      if (mode === 'speaking' && amp > 0.01) {
        const ringR = baseR * (1.15 + amp * 0.4) + Math.sin(t * 3) * 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, TAU);
        ctx.strokeStyle = rgba(curPalette[2], 0.12 + amp * 0.2);
        ctx.lineWidth = 1.5 + amp * 2;
        ctx.stroke();
      }

      // Loading: rotating arc segments
      if (mode === 'loading') {
        ctx.save();
        ctx.translate(cx, cy);
        for (let i = 0; i < 3; i++) {
          ctx.rotate(t * 2.5 + i * TAU / 3);
          ctx.beginPath();
          ctx.arc(0, 0, baseR * 1.1, 0, Math.PI * 0.4);
          ctx.strokeStyle = rgba(curPalette[i % curPalette.length], 0.3 + i * 0.1);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.restore();
      }

      // Recording: subtle outer pulse ring
      if (mode === 'recording') {
        const pulsePhase = (t * 2) % 1;
        const pulseR = baseR * (1.0 + pulsePhase * 0.6);
        const pulseAlpha = (1 - pulsePhase) * 0.2;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseR, 0, TAU);
        ctx.strokeStyle = rgba(RED, pulseAlpha);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Watching: slow eye-like horizontal oscillation
      if (mode === 'watching') {
        const eyeX = Math.sin(t * 0.8) * baseR * 0.12;
        const eyeR = baseR * 0.12;
        const eyeGrad = ctx.createRadialGradient(cx + eyeX, cy, 0, cx + eyeX, cy, eyeR);
        eyeGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
        eyeGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.beginPath();
        ctx.arc(cx + eyeX, cy, eyeR, 0, TAU);
        ctx.fillStyle = eyeGrad;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [mode, getAmplitude, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, display: 'block' }}
    />
  );
}
