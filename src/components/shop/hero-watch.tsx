"use client";

import { useEffect, useRef } from "react";

const round = (n: number) => Math.round(n * 100) / 100;

const ticks = Array.from({ length: 60 }, (_, i) => {
  const angle = (i * 6 * Math.PI) / 180;
  const big = i % 5 === 0;
  const r1 = big ? 92 : 98;
  const r2 = 104;
  return {
    i,
    big,
    x1: round(150 + Math.sin(angle) * r1),
    y1: round(200 - Math.cos(angle) * r1),
    x2: round(150 + Math.sin(angle) * r2),
    y2: round(200 - Math.cos(angle) * r2),
  };
});

/** Decorative watch whose hands show the real time. Shows a fixed 10:10 until mounted and under reduced motion it does not move. */
export function HeroWatch({ className }: { className?: string }) {
  const hour = useRef<SVGGElement>(null);
  const minute = useRef<SVGGElement>(null);
  const second = useRef<SVGGElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const draw = () => {
      const now = new Date();
      const s = now.getSeconds() + now.getMilliseconds() / 1000;
      const m = now.getMinutes() + s / 60;
      const h = (now.getHours() % 12) + m / 60;
      hour.current?.setAttribute("transform", `rotate(${h * 30} 150 200)`);
      minute.current?.setAttribute("transform", `rotate(${m * 6} 150 200)`);
      second.current?.setAttribute("transform", `rotate(${s * 6} 150 200)`);
      if (!reduce) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <svg viewBox="0 0 300 400" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id="hero-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E8CE98" />
          <stop offset="1" stopColor="#8E6E3E" />
        </linearGradient>
        <radialGradient id="hero-face" cx=".5" cy=".4">
          <stop offset="0" stopColor="#2b2822" />
          <stop offset="1" stopColor="#0c0b09" />
        </radialGradient>
      </defs>
      <rect x="100" y="0" width="100" height="400" rx="30" fill="#2a2620" />
      <rect x="262" y="176" width="20" height="40" rx="6" fill="url(#hero-gold)" />
      <circle cx="150" cy="200" r="128" fill="url(#hero-gold)" />
      <circle cx="150" cy="200" r="116" fill="#0c0b09" />
      <circle cx="150" cy="200" r="108" fill="url(#hero-face)" />
      {ticks.map((t) => (
        <line
          key={t.i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={t.big ? "#D9BC84" : "#5b554a"}
          strokeWidth={t.big ? 2.4 : 1}
        />
      ))}
      <text x="150" y="150" textAnchor="middle" fontSize="15" letterSpacing="5" fill="#D9BC84" fontFamily="var(--font-playfair), serif">
        LISVA
      </text>
      <g ref={hour} stroke="#fff" strokeLinecap="round" transform="rotate(305 150 200)">
        <line x1="150" y1="200" x2="150" y2="160" strokeWidth="6" />
      </g>
      <g ref={minute} stroke="#fff" strokeLinecap="round" transform="rotate(60 150 200)">
        <line x1="150" y1="200" x2="150" y2="124" strokeWidth="4" />
      </g>
      <g ref={second} stroke="#D9BC84" strokeLinecap="round" transform="rotate(180 150 200)">
        <line x1="150" y1="222" x2="150" y2="110" strokeWidth="1.8" />
      </g>
      <circle cx="150" cy="200" r="7" fill="url(#hero-gold)" />
    </svg>
  );
}
