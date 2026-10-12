import { useEffect, useRef } from "react";

// Stacked sine lines with a shifting colour gradient, drifting over time, for
// the topographic "sound wave" field. earlyworld's logo is a waveform, so the
// motion is on-theme rather than decorative filler.
const LINES = 28;

export function Waves({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const gradient = () => {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0.0, "rgba(255,126,182,0)");
      g.addColorStop(0.18, "rgba(255,126,182,0.55)"); // pink
      g.addColorStop(0.42, "rgba(169,120,255,0.6)"); // violet
      g.addColorStop(0.64, "rgba(120,150,255,0.6)"); // periwinkle (brand)
      g.addColorStop(0.85, "rgba(90,220,220,0.55)"); // teal
      g.addColorStop(1.0, "rgba(90,220,220,0)");
      return g;
    };

    const draw = (ms: number) => {
      const t = ms * 0.00042;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = gradient();
      for (let i = 0; i < LINES; i++) {
        const baseY = h * 0.08 + (i / (LINES - 1)) * (h * 0.86);
        ctx.beginPath();
        for (let x = 0; x <= w; x += 8) {
          const nx = x / w;
          const amp = 16 + 13 * Math.sin(nx * 3 + i * 0.3);
          const y =
            baseY +
            Math.sin(nx * 6 + t * 2 + i * 0.5) * amp +
            Math.sin(nx * 13 - t * 1.3 + i * 0.22) * amp * 0.3;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    };

    resize();
    let frame = 0;
    const onResize = () => {
      resize();
      if (reduce) draw(0);
    };
    window.addEventListener("resize", onResize);

    if (reduce) {
      draw(0);
    } else {
      const loop = (ms: number) => {
        draw(ms);
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={ref} className={className ? `waves ${className}` : "waves"} aria-hidden="true" />;
}
