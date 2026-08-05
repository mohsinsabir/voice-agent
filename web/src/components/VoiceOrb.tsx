import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { CallStatus } from "../hooks/useRetellCall";
import "./VoiceOrb.css";

type Rgb = [number, number, number];

type Palette = {
  core: Rgb;
  halo: Rgb;
  rim: Rgb;
};

const PALETTES: Record<CallStatus, Palette> = {
  idle: { core: [109, 139, 255], halo: [47, 227, 176], rim: [177, 132, 255] },
  connecting: { core: [255, 196, 107], halo: [255, 150, 90], rim: [255, 221, 160] },
  connected: { core: [47, 227, 176], halo: [109, 139, 255], rim: [127, 242, 211] },
  agent_speaking: { core: [47, 227, 176], halo: [127, 242, 211], rim: [109, 139, 255] },
  listening: { core: [177, 132, 255], halo: [109, 139, 255], rim: [214, 190, 255] },
  ended: { core: [108, 123, 156], halo: [80, 94, 124], rim: [140, 155, 186] },
  error: { core: [255, 122, 133], halo: [255, 90, 110], rim: [255, 170, 178] },
};

const TAU = Math.PI * 2;

const rgba = (c: Rgb, a: number) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

/**
 * Organic outline built from summed sine harmonics. `wobble` scales how far the
 * surface deviates from a circle, so louder audio produces a more agitated blob.
 */
function traceBlob(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  t: number,
  wobble: number,
  seed: number,
) {
  const steps = 96;
  ctx.beginPath();
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * TAU;
    const noise =
      Math.sin(angle * 3 + t * 1.05 + seed) * 0.5 +
      Math.sin(angle * 5 - t * 0.72 + seed * 2.1) * 0.3 +
      Math.sin(angle * 2 + t * 1.63 + seed * 3.4) * 0.2;
    const r = radius * (1 + noise * wobble);
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

type VoiceOrbProps = {
  status: CallStatus;
  levelRef: RefObject<number>;
  waveRef: RefObject<Float32Array>;
};

export default function VoiceOrb({ status, levelRef, waveRef }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let frame = 0;
    let t = 0;

    // Palette is eased between states so status changes glide instead of snapping.
    let current: Palette = { ...PALETTES[statusRef.current] };
    const idleBins = new Float32Array(waveRef.current?.length ?? 56);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const render = () => {
      frame = window.requestAnimationFrame(render);
      if (width === 0 || height === 0) return;

      const state = statusRef.current;
      const target = PALETTES[state];
      current = {
        core: mixRgb(current.core, target.core, 0.06),
        halo: mixRgb(current.halo, target.halo, 0.06),
        rim: mixRgb(current.rim, target.rim, 0.06),
      };

      const speaking = state === "agent_speaking";
      const connecting = state === "connecting";
      const dormant = state === "idle" || state === "ended" || state === "error";

      if (!reduceMotion) t += connecting ? 0.032 : 0.013;

      // Agent audio drives the orb while it talks; otherwise it breathes on its own.
      const audioLevel = levelRef.current ?? 0;
      const breathe = (Math.sin(t * 1.35) + 1) / 2;
      const level = speaking ? audioLevel : breathe * (dormant ? 0.1 : 0.2);

      const cx = width / 2;
      const cy = height / 2;
      const unit = Math.min(width, height);
      const base = unit * 0.2 * (1 + level * 0.16);

      ctx.clearRect(0, 0, width, height);

      // 1. Ambient halo.
      const halo = ctx.createRadialGradient(cx, cy, base * 0.35, cx, cy, unit * 0.52);
      halo.addColorStop(0, rgba(current.halo, 0.34 + level * 0.3));
      halo.addColorStop(0.45, rgba(current.core, 0.13 + level * 0.14));
      halo.addColorStop(1, rgba(current.core, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, height);

      // 2. Waveform rim, from real samples when speaking and a travelling wave otherwise.
      const bins = waveRef.current ?? idleBins;
      const count = bins.length;
      const innerRadius = base * 1.42;
      ctx.lineCap = "round";
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * TAU - Math.PI / 2;
        const idle = (Math.sin(t * 2.1 + i * 0.42) + 1) / 2;
        const magnitude = speaking
          ? bins[i]
          : idle * (connecting ? 0.34 : dormant ? 0.11 : 0.18);
        const length = unit * 0.018 + magnitude * unit * 0.135;
        const x1 = cx + Math.cos(angle) * innerRadius;
        const y1 = cy + Math.sin(angle) * innerRadius;
        const x2 = cx + Math.cos(angle) * (innerRadius + length);
        const y2 = cy + Math.sin(angle) * (innerRadius + length);
        ctx.strokeStyle = rgba(current.rim, 0.2 + magnitude * 0.7);
        ctx.lineWidth = Math.max(1.5, unit * 0.0075);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // 3. Stacked translucent blobs, additively blended into a liquid core.
      ctx.globalCompositeOperation = "lighter";
      const layers: Array<{ scale: number; seed: number; alpha: number; color: Rgb }> = [
        { scale: 1.16, seed: 0.0, alpha: 0.16, color: current.halo },
        { scale: 1.02, seed: 2.3, alpha: 0.22, color: current.core },
        { scale: 0.86, seed: 4.7, alpha: 0.3, color: current.rim },
      ];
      for (const layer of layers) {
        const radius = base * layer.scale;
        const gradient = ctx.createRadialGradient(
          cx - radius * 0.25,
          cy - radius * 0.3,
          radius * 0.1,
          cx,
          cy,
          radius * 1.25,
        );
        gradient.addColorStop(0, rgba(layer.color, layer.alpha + level * 0.28));
        gradient.addColorStop(1, rgba(layer.color, 0));
        ctx.fillStyle = gradient;
        traceBlob(ctx, cx, cy, radius, t, 0.05 + level * 0.2, layer.seed);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      // 4. Bright inner core with a specular highlight.
      const core = ctx.createRadialGradient(
        cx - base * 0.3,
        cy - base * 0.34,
        base * 0.06,
        cx,
        cy,
        base * 0.94,
      );
      core.addColorStop(0, rgba([255, 255, 255], 0.9));
      core.addColorStop(0.32, rgba(current.core, 0.72 + level * 0.24));
      core.addColorStop(1, rgba(current.core, 0.05));
      ctx.fillStyle = core;
      traceBlob(ctx, cx, cy, base * 0.72, t * 1.3, 0.04 + level * 0.12, 1.6);
      ctx.fill();

      // 5. Rotating orbital ring.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.35);
      ctx.strokeStyle = rgba(current.rim, 0.24);
      ctx.lineWidth = 1;
      ctx.setLineDash([unit * 0.012, unit * 0.05]);
      ctx.beginPath();
      ctx.arc(0, 0, base * 1.78, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // 6. Orbiting motes.
      const motes = 5;
      for (let i = 0; i < motes; i += 1) {
        const angle = t * 0.55 + (i / motes) * TAU;
        const orbit = base * (1.78 + Math.sin(t * 0.9 + i) * 0.07);
        const x = cx + Math.cos(angle) * orbit;
        const y = cy + Math.sin(angle) * orbit * 0.94;
        const size = unit * 0.006 * (1 + level);
        ctx.fillStyle = rgba(current.rim, 0.5 + level * 0.35);
        ctx.beginPath();
        ctx.arc(x, y, size, 0, TAU);
        ctx.fill();
      }
    };

    frame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [levelRef, waveRef]);

  return (
    <div className={`orb orb--${status}`} data-status={status}>
      <canvas ref={canvasRef} className="orb__canvas" aria-hidden="true" />
      <div className="orb__ripple" aria-hidden="true" />
      <div className="orb__ripple orb__ripple--delayed" aria-hidden="true" />
    </div>
  );
}
