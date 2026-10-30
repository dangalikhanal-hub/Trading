"use client";

import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";

const arcLength = Math.PI * 50;

function labelFor(value: number) {
  if (value >= 75) return "Extreme Greed";
  if (value >= 55) return "Greed";
  if (value >= 45) return "Neutral";
  if (value >= 25) return "Fear";
  return "Extreme Fear";
}

function toneFor(value: number) {
  if (value >= 55) return "text-emerald-400";
  if (value >= 45) return "text-amber-400";
  return "text-rose-400";
}

export default function FearGreedGauge() {
  const [value, setValue] = useState(68);

  useEffect(() => {
    const id = window.setInterval(() => {
      setValue((current) => Math.max(0, Math.min(100, current + (Math.random() - 0.5) * 5)));
    }, 9000);

    return () => window.clearInterval(id);
  }, []);

  const clamped = Math.max(0, Math.min(100, value));
  const label = labelFor(clamped);
  const tone = toneFor(clamped);

  return (
    <div className="mtx-glass mtx-float-in rounded-2xl p-4" style={{ animationDelay: "150ms" }}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[8px] uppercase tracking-[.16em] text-slate-500">Fear &amp; Greed</span>
        <Gauge className="h-3.5 w-3.5 text-slate-600" />
      </div>
      <div className="relative mt-2 flex justify-center">
        <svg viewBox="0 0 120 70" className="w-full max-w-[150px]" aria-hidden="true">
          <defs>
            <linearGradient id="mtxFngGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#f43f5e" />
              <stop offset=".5" stopColor="#f59e0b" />
              <stop offset="1" stopColor="#10b981" />
            </linearGradient>
          </defs>
          <path d="M10 60 A50 50 0 0 1 110 60" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="7" strokeLinecap="round" />
          <path
            d="M10 60 A50 50 0 0 1 110 60"
            fill="none"
            stroke="url(#mtxFngGrad)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={arcLength * (1 - clamped / 100)}
          />
          <g transform={`rotate(${-90 + (clamped / 100) * 180} 60 60)`}>
            <line x1="60" y1="60" x2="60" y2="24" stroke="#e2e8f0" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="60" cy="60" r="3.4" fill="#e2e8f0" />
          </g>
          <text x="12" y="68" fill="#475569" fontSize="7" fontFamily="monospace">
            0
          </text>
          <text x="56" y="22" fill="#475569" fontSize="7" fontFamily="monospace">
            50
          </text>
          <text x="104" y="68" fill="#475569" fontSize="7" fontFamily="monospace">
            100
          </text>
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <span className="font-mono text-xl font-semibold text-white">{Math.round(clamped)}</span>
          <span className={`ml-1 font-mono text-[9px] ${tone}`}>{label}</span>
        </div>
      </div>
    </div>
  );
}
