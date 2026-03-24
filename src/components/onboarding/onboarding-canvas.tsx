"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  phase: number;
  speed: number;
  char: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  char: string;
  hue: number;
}

const STAR_CHARS = ["✦", "✧", "·", "*", "⋆", "˚"];
const FLOW_CHARS = ["→", "⇢", "»", "›"];

export function OnboardingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const starsRef = useRef<Star[]>([]);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      initStars();
    };

    const initStars = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      const count = Math.floor((w * h) / 12000);
      starsRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        phase: Math.random() * Math.PI * 2,
        speed: 0.006 + Math.random() * 0.012,
        char: STAR_CHARS[Math.floor(Math.random() * STAR_CHARS.length)],
      }));
    };

    const spawnParticle = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (particlesRef.current.length < 12 && Math.random() < 0.02) {
        particlesRef.current.push({
          x: -10,
          y: 100 + Math.random() * (h - 200),
          vx: 0.3 + Math.random() * 1,
          vy: (Math.random() - 0.5) * 0.2,
          life: 0,
          maxLife: 250 + Math.random() * 350,
          char: FLOW_CHARS[Math.floor(Math.random() * FLOW_CHARS.length)],
          hue: Math.random(), // 0 = blue side, 1 = orange side
        });
      }
    };

    resize();
    window.addEventListener("resize", resize);

    let last = 0;
    const draw = (ts: number) => {
      const dt = Math.min(ts - last, 50);
      last = ts;

      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.textBaseline = "middle";

      // Stars — blend between logo colors
      for (const s of starsRef.current) {
        s.phase += s.speed;
        const alpha = 0.06 + 0.1 * Math.sin(s.phase);
        ctx.globalAlpha = alpha;
        // Gradient from blue (#4a90d9) at top to orange (#e8835a) at bottom
        const t = s.y / h;
        const r = Math.round(74 + (232 - 74) * t);
        const g = Math.round(144 + (131 - 144) * t);
        const b = Math.round(217 + (90 - 217) * t);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.font = `${8 + Math.floor(3 * Math.abs(Math.sin(s.phase)))}px monospace`;
        ctx.fillText(s.char, s.x, s.y);
      }

      // Flow particles
      spawnParticle();
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx * (dt / 16);
        p.y += p.vy * (dt / 16);
        p.life += dt / 16;
        if (p.life > p.maxLife || p.x > w + 20) return false;

        const progress = p.life / p.maxLife;
        const alpha =
          progress < 0.1
            ? progress * 10
            : progress > 0.8
              ? (1 - progress) * 5
              : 1;
        ctx.globalAlpha = alpha * 0.15;
        const r = Math.round(74 + (232 - 74) * p.hue);
        const g = Math.round(144 + (131 - 144) * p.hue);
        const b = Math.round(217 + (90 - 217) * p.hue);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.font = "13px monospace";
        ctx.fillText(p.char, p.x, p.y);
        return true;
      });

      ctx.globalAlpha = 1;
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      style={{ width: "100%", height: "100%" }}
      aria-hidden
    />
  );
}
