"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

type Candle = {
  open: number;
  close: number;
  high: number;
  low: number;
  time: number;
};

type Timeframe = "1D" | "1W" | "1M";

const TIMEFRAMES: Record<Timeframe, { points: number; volatility: number }> = {
  "1D": { points: 86, volatility: 0.0045 },
  "1W": { points: 96, volatility: 0.011 },
  "1M": { points: 110, volatility: 0.019 },
};

const TIMEFRAME_KEYS: Timeframe[] = ["1D", "1W", "1M"];

function money(value: number, digits = 2) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function generateCandles(points: number, volatility: number): Candle[] {
  let price = 520 + Math.random() * 24;
  const now = Date.now();
  const data: Candle[] = [];

  for (let index = 0; index < points; index += 1) {
    const open = price;
    const close = Math.max(1, open + (Math.random() - 0.47) * volatility * price);
    const high = Math.max(open, close) + Math.random() * volatility * price * 0.55;
    const low = Math.min(open, close) - Math.random() * volatility * price * 0.55;
    data.push({ open, close, high, low, time: now - (points - index) * 60000 });
    price = close;
  }

  return data;
}

export default function PriceChart() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const statOpenRef = useRef<HTMLSpanElement>(null);
  const statHighRef = useRef<HTMLSpanElement>(null);
  const statLowRef = useRef<HTMLSpanElement>(null);
  const statCloseRef = useRef<HTMLSpanElement>(null);
  const priceRef = useRef<HTMLSpanElement>(null);
  const changeRef = useRef<HTMLSpanElement>(null);

  const candlesRef = useRef<Candle[]>([]);
  const sizeRef = useRef({ width: 0, height: 0 });
  const progressRef = useRef(1);
  const hoverRef = useRef(-1);
  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(0);
  const resizeTimerRef = useRef<number | undefined>(undefined);

  const [timeframe, setTimeframe] = useState<Timeframe>("1D");

  const layout = useCallback(() => {
    const { width, height } = sizeRef.current;
    const left = 8;
    const right = 54;
    const top = 14;
    const bottom = 22;
    const innerWidth = Math.max(1, width - left - right);
    const innerHeight = Math.max(1, height - top - bottom);
    const step = innerWidth / Math.max(1, candlesRef.current.length);
    return { left, right, top, bottom, width: innerWidth, height: innerHeight, step };
  }, []);

  const updateStats = useCallback((candle: Candle | undefined) => {
    if (!candle) return;

    if (statOpenRef.current) statOpenRef.current.textContent = money(candle.open);
    if (statHighRef.current) statHighRef.current.textContent = money(candle.high);
    if (statLowRef.current) statLowRef.current.textContent = money(candle.low);
    if (statCloseRef.current) statCloseRef.current.textContent = money(candle.close);
    if (priceRef.current) priceRef.current.textContent = money(candle.close);

    const first = candlesRef.current[0];
    if (changeRef.current && first) {
      const change = ((candle.close - first.open) / first.open) * 100;
      changeRef.current.textContent = `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
      changeRef.current.classList.toggle("mtx-up", change >= 0);
      changeRef.current.classList.toggle("mtx-down", change < 0);
    }
  }, []);

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const { width: chartWidth, height: chartHeight } = sizeRef.current;

    if (!ctx || !chartWidth || !chartHeight || !candlesRef.current.length) return;

    ctx.clearRect(0, 0, chartWidth, chartHeight);

    const { left, top, width, height, step } = layout();
    const visible = Math.max(1, Math.floor(candlesRef.current.length * progressRef.current));
    const slice = candlesRef.current.slice(0, visible);

    let min = Math.min(...slice.map((candle) => candle.low));
    let max = Math.max(...slice.map((candle) => candle.high));
    const padding = (max - min) * 0.12 || 1;
    min -= padding;
    max += padding;

    const y = (value: number) => top + ((max - value) / (max - min)) * height;
    const x = (index: number) => left + index * step + step / 2;

    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    for (let index = 0; index <= 4; index += 1) {
      const lineY = top + (height / 4) * index;
      ctx.strokeStyle = "rgba(255,255,255,0.045)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, lineY);
      ctx.lineTo(left + width, lineY);
      ctx.stroke();

      const price = max - ((max - min) / 4) * index;
      ctx.fillStyle = "rgba(148,163,184,0.42)";
      ctx.fillText(money(price), left + width + 8, lineY);
    }

    const areaGradient = ctx.createLinearGradient(0, top, 0, top + height);
    areaGradient.addColorStop(0, "rgba(16,185,129,0.20)");
    areaGradient.addColorStop(1, "rgba(16,185,129,0)");

    ctx.beginPath();
    ctx.moveTo(x(0), y(slice[0].close));
    slice.forEach((candle, index) => ctx.lineTo(x(index), y(candle.close)));
    ctx.lineTo(x(slice.length - 1), top + height);
    ctx.lineTo(x(0), top + height);
    ctx.closePath();
    ctx.fillStyle = areaGradient;
    ctx.fill();

    ctx.beginPath();
    slice.forEach((candle, index) => {
      if (index === 0) ctx.moveTo(x(index), y(candle.close));
      else ctx.lineTo(x(index), y(candle.close));
    });
    ctx.strokeStyle = "rgba(52,211,153,0.9)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    const bodyWidth = Math.max(2, Math.min(7, step * 0.52));

    slice.forEach((candle, index) => {
      const up = candle.close >= candle.open;
      const color = up ? "#10b981" : "#f43f5e";
      const centerX = x(index);

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX, y(candle.high));
      ctx.lineTo(centerX, y(candle.low));
      ctx.stroke();

      const bodyTop = y(Math.max(candle.open, candle.close));
      const bodyBottom = y(Math.min(candle.open, candle.close));
      ctx.fillStyle = up ? "rgba(16,185,129,0.75)" : "rgba(244,63,94,0.75)";
      ctx.fillRect(centerX - bodyWidth / 2, bodyTop, bodyWidth, Math.max(1, bodyBottom - bodyTop));
    });

    const last = slice[slice.length - 1];
    const lastY = y(last.close);

    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = "rgba(16,185,129,0.35)";
    ctx.beginPath();
    ctx.moveTo(left, lastY);
    ctx.lineTo(left + width, lastY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(x(slice.length - 1), lastY, 2.6, 0, Math.PI * 2);
    ctx.fill();

    if (hoverRef.current >= 0 && hoverRef.current < slice.length) {
      const candle = slice[hoverRef.current];
      const crossX = x(hoverRef.current);

      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = "rgba(226,232,240,0.22)";
      ctx.beginPath();
      ctx.moveTo(crossX, top);
      ctx.lineTo(crossX, top + height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(left, y(candle.close));
      ctx.lineTo(left + width, y(candle.close));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    updateStats(last);
  }, [layout, updateStats]);

  const resizeChart = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const rect = wrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dpr = window.devicePixelRatio || 1;
    sizeRef.current = { width: rect.width, height: rect.height };
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawChart();
  }, [drawChart]);

  const animateChart = useCallback(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    progressRef.current = 0;
    const start = performance.now();
    const duration = 620;

    const frame = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      progressRef.current = 1 - Math.pow(1 - progress, 3);
      drawChart();
      if (progress < 1) animationRef.current = requestAnimationFrame(frame);
    };

    animationRef.current = requestAnimationFrame(frame);
  }, [drawChart]);

  const loadTimeframe = useCallback(
    (next: Timeframe) => {
      const config = TIMEFRAMES[next];
      candlesRef.current = generateCandles(config.points, config.volatility);
      animateChart();
    },
    [animateChart],
  );

  const showTooltip = useCallback((index: number, clientX: number, clientY: number) => {
    const tooltip = tooltipRef.current;
    const wrap = wrapRef.current;
    if (!tooltip || !wrap) return;

    const candle = candlesRef.current[index];
    if (!candle) {
      tooltip.classList.remove("mtx-visible");
      return;
    }

    const rect = wrap.getBoundingClientRect();
    const date = new Date(candle.time);
    tooltip.innerHTML = `
      <div style="color:#64748b">${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</div>
      <div>O <span style="color:#e2e8f0">${money(candle.open)}</span></div>
      <div>H <span style="color:#34d399">${money(candle.high)}</span></div>
      <div>L <span style="color:#fb7185">${money(candle.low)}</span></div>
      <div>C <span style="color:#e2e8f0">${money(candle.close)}</span></div>`;

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    tooltip.style.left = `${Math.min(Math.max(8, localX + 14), rect.width - 130)}px`;
    tooltip.style.top = `${Math.min(Math.max(8, localY - 70), rect.height - 92)}px`;
    tooltip.classList.add("mtx-visible");
  }, []);

  const handleMove = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const tooltip = tooltipRef.current;
      if (!canvas || !tooltip || !candlesRef.current.length) return;

      const rect = canvas.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const { left, step } = layout();
      const index = Math.floor((localX - left) / step);

      if (index >= 0 && index < Math.floor(candlesRef.current.length * progressRef.current)) {
        hoverRef.current = index;
        showTooltip(index, event.clientX, event.clientY);
        drawChart();
      } else {
        hoverRef.current = -1;
        tooltip.classList.remove("mtx-visible");
        drawChart();
      }
    },
    [drawChart, layout, showTooltip],
  );

  const handleLeave = useCallback(() => {
    hoverRef.current = -1;
    tooltipRef.current?.classList.remove("mtx-visible");
    drawChart();
  }, [drawChart]);

  useEffect(() => {
    resizeChart();

    const handleResize = () => {
      window.clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = window.setTimeout(resizeChart, 120);
    };

    window.addEventListener("resize", handleResize);

    const live = window.setInterval(() => {
      const candles = candlesRef.current;
      if (!candles.length) return;

      const last = candles[candles.length - 1];
      const drift = (Math.random() - 0.48) * last.close * 0.0012;
      last.close = Math.max(1, last.close + drift);
      last.high = Math.max(last.high, last.close);
      last.low = Math.min(last.low, last.close);

      const now = performance.now();
      if (now - lastUpdateRef.current > 1200) {
        lastUpdateRef.current = now;
        drawChart();
      }
    }, 1400);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.clearTimeout(resizeTimerRef.current);
      window.clearInterval(live);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [drawChart, resizeChart]);

  useEffect(() => {
    loadTimeframe(timeframe);
  }, [loadTimeframe, timeframe]);

  return (
    <div className="mtx-glass mtx-float-in overflow-hidden rounded-2xl" style={{ animationDelay: "90ms" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] font-mono text-[11px] font-bold text-emerald-400">
            SPY
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">S&amp;P 500 ETF</span>
              <span className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[8px] text-slate-500">NYSE</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span ref={priceRef} className="font-mono text-[15px] font-semibold tracking-tight text-white">
                548.32
              </span>
              <span ref={changeRef} className="mtx-up font-mono text-[10px] font-semibold">
                +0.42%
              </span>
              <span className="font-mono text-[9px] text-slate-600">USD</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-white/[0.07] bg-[#080c15]/70 p-1" role="tablist" aria-label="Chart timeframe">
          {TIMEFRAME_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTimeframe(key)}
              aria-pressed={timeframe === key}
              className={`rounded-md px-2.5 py-1.5 font-mono text-[9px] font-medium transition ${
                timeframe === key ? "bg-white/[0.07] text-emerald-300" : "text-slate-500 hover:text-slate-200"
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      <div ref={wrapRef} className="relative h-[290px] w-full px-1 pt-2 sm:h-[320px]">
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          role="img"
          aria-label="Simulated live SPY candlestick chart"
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
        />
        <div ref={tooltipRef} className="mtx-chart-tooltip" />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2 font-mono text-[9px] text-slate-600">
          <span className="mtx-pulse-dot h-1 w-1 rounded-full bg-emerald-400" />
          Simulated live feed
        </div>
        <div className="flex items-center gap-4 font-mono text-[9px] text-slate-600">
          <span>
            O <span ref={statOpenRef} className="text-slate-400">—</span>
          </span>
          <span>
            H <span ref={statHighRef} className="text-slate-400">—</span>
          </span>
          <span>
            L <span ref={statLowRef} className="text-slate-400">—</span>
          </span>
          <span>
            C <span ref={statCloseRef} className="text-slate-400">—</span>
          </span>
        </div>
      </div>
    </div>
  );
}
