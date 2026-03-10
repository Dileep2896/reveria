import { useRef, useEffect } from 'react';

/**
 * Canvas-based voice-reactive orb that responds to real-time audio amplitude.
 * Modes: idle, recording, speaking, loading, watching, waiting
 */

const MODE_COLORS = {
  idle:      { base: '#b48cff', glow: 'rgba(180,140,255,0.3)' },
  recording: { base: '#ef4444', glow: 'rgba(239,68,68,0.35)' },
  speaking:  { base: '#ffa86c', glow: 'rgba(255,168,108,0.35)' },
  loading:   { base: '#b48cff', glow: 'rgba(180,140,255,0.2)' },
  watching:  { base: '#b48cff', glow: 'rgba(180,140,255,0.25)' },
  waiting:   { base: '#ffa86c', glow: 'rgba(255,168,108,0.2)' },
};

export default function VoiceOrb({ mode = 'idle', getAmplitude, size = 72 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const baseRadius = size * 0.28;

    let phase = 0;

    function draw() {
      ctx.clearRect(0, 0, size, size);

      const amp = typeof getAmplitude === 'function' ? getAmplitude() : 0;
      const colors = MODE_COLORS[mode] || MODE_COLORS.idle;

      // Outer glow
      const glowRadius = baseRadius + 8 + amp * 15;
      const gradient = ctx.createRadialGradient(cx, cy, baseRadius * 0.5, cx, cy, glowRadius + 6);
      gradient.addColorStop(0, colors.glow);
      gradient.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius + 6, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Blob shape
      ctx.beginPath();
      const points = 64;
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const wobble =
          Math.sin(angle * 3 + phase) * 1.5 * (0.3 + amp * 0.7) +
          Math.sin(angle * 5 - phase * 1.3) * 0.8 * amp +
          Math.sin(angle * 7 + phase * 0.7) * 0.5 * amp;
        const r = baseRadius + wobble + amp * 6;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const blobGrad = ctx.createRadialGradient(cx - 4, cy - 4, 0, cx, cy, baseRadius + 10);
      blobGrad.addColorStop(0, colors.base);
      blobGrad.addColorStop(1, colors.glow);
      ctx.fillStyle = blobGrad;
      ctx.fill();

      phase += 0.03 + amp * 0.04;
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
