"use client";

import { useEffect, useRef } from "react";

interface Lobster {
  x: number;
  y: number;
  speed: number;
  dir: 1 | -1;
  frame: number;
  frameTimer: number;
  size: number;
  opacity: number;
}

interface Star {
  x: number;
  y: number;
  opacity: number;
  phase: number;
  speed: number;
  char: string;
}

const LOBSTER_FRAMES_RIGHT = [
  ">=(°,°)==<",
  ">=(°.°)==<",
];
const LOBSTER_FRAMES_LEFT = [
  ">==(°,°)=<",
  ">==(°.°)=<",
];

const STAR_CHARS = ["✦", "✧", "·", "*", "⋆", "˚", "✸", "✺"];

export function LobsterBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const lobsters = useRef<Lobster[]>([]);
  const stars = useRef<Star[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    const initStars = () => {
      const count = Math.floor((canvas.width * canvas.height) / 8000);
      stars.current = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        opacity: Math.random(),
        phase: Math.random() * Math.PI * 2,
        speed: 0.01 + Math.random() * 0.02,
        char: STAR_CHARS[Math.floor(Math.random() * STAR_CHARS.length)],
      }));
    };

    const initLobsters = () => {
      lobsters.current = Array.from({ length: 6 }, (_, i) => {
        const dir: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
        return {
          x: dir === 1 ? -100 : canvas.width + 100,
          y: 80 + (i * (canvas.height - 160)) / 5 + (Math.random() - 0.5) * 40,
          speed: 0.4 + Math.random() * 0.6,
          dir,
          frame: 0,
          frameTimer: 0,
          size: 11 + Math.floor(Math.random() * 4),
          opacity: 0.12 + Math.random() * 0.12,
        };
      });
    };

    resize();
    initLobsters();
    window.addEventListener("resize", resize);

    let last = 0;
    const draw = (ts: number) => {
      const dt = Math.min(ts - last, 50);
      last = ts;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.textBaseline = "middle";

      // Draw stars
      for (const s of stars.current) {
        s.phase += s.speed;
        const alpha = 0.15 + 0.15 * Math.sin(s.phase);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#a78bfa";
        ctx.font = `${10 + Math.floor(4 * Math.abs(Math.sin(s.phase)))}px monospace`;
        ctx.fillText(s.char, s.x, s.y);
      }

      // Draw lobsters
      for (const l of lobsters.current) {
        l.x += l.speed * l.dir * (dt / 16);
        l.frameTimer += dt;
        if (l.frameTimer > 300) {
          l.frame = (l.frame + 1) % 2;
          l.frameTimer = 0;
        }

        const frames = l.dir === 1 ? LOBSTER_FRAMES_RIGHT : LOBSTER_FRAMES_LEFT;
        const text = `🦞 ${frames[l.frame]}`;

        ctx.globalAlpha = l.opacity;
        ctx.fillStyle = "#c4b5fd";
        ctx.font = `${l.size}px monospace`;
        ctx.fillText(text, l.x, l.y);

        // Wrap around
        if (l.dir === 1 && l.x > canvas.width + 150) {
          l.x = -150;
          l.y = 60 + Math.random() * (canvas.height - 120);
          l.speed = 0.4 + Math.random() * 0.6;
          l.opacity = 0.10 + Math.random() * 0.14;
          l.size = 11 + Math.floor(Math.random() * 4);
        } else if (l.dir === -1 && l.x < -200) {
          l.x = canvas.width + 150;
          l.y = 60 + Math.random() * (canvas.height - 120);
          l.speed = 0.4 + Math.random() * 0.6;
          l.opacity = 0.10 + Math.random() * 0.14;
          l.size = 11 + Math.floor(Math.random() * 4);
        }
      }

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
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden
    />
  );
}
