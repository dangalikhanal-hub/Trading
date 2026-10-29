"use client";

import { useId, useState } from "react";

const count = 64;
const width = 800;
const height = 260;

export default function MarketChart({ symbol, price, range, paused }: { symbol: string; price: number; range: string; paused: boolean }) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const seed = symbol.length + range.charCodeAt(1);
  const values = Array.from({ length: count }, (_, i) => 176 - i * 1.7 + Math.sin(i * .48 + seed) * 19 + Math.sin(i * 1.73) * 7);
  const points = values.map((y, i) => `${(i / (count - 1)) * width},${y}`).join(" ");
  const path = `M${points.split(" ").join(" L")}`;
  const hovered = hover === null ? null : Math.max(0, Math.min(count - 1, hover));
  const labels = range === "1D" ? ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"] : range === "1H" ? ["00m", "10m", "20m", "30m", "40m", "50m"] : range === "4H" ? ["00:00", "00:40", "01:20", "02:00", "02:40", "03:20"] : range === "1W" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["Day 1", "Day 6", "Day 11", "Day 16", "Day 21", "Day 26"];

  return <div className="tv-chart-wrap">
    <div className="tv-chart-axis" aria-hidden="true">{[35,85,135,185,235].map(y => <span key={y}>{(price * (1 + (values[count - 1] - y) / 5000)).toLocaleString("en-US", { maximumFractionDigits: 1 })}</span>)}</div>
    <svg className="tv-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`Illustrative ${symbol} chart, ${range}. Use left and right arrow keys to explore.`} tabIndex={0}
      onMouseMove={event => { const rect = event.currentTarget.getBoundingClientRect(); setHover(Math.round((event.clientX - rect.left) / rect.width * (count - 1))); }} onMouseLeave={() => setHover(null)} onBlur={() => setHover(null)} onFocus={() => setHover(count - 1)}
      onKeyDown={event => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); setHover(Math.max(0, Math.min(count - 1, (hover ?? count - 1) + (event.key === "ArrowLeft" ? -1 : 1)))); } }}>
      <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8de7c2" stopOpacity=".2" /><stop offset="100%" stopColor="#8de7c2" stopOpacity="0" /></linearGradient><linearGradient id={`${id}-line`}><stop stopColor="#5abfa4" /><stop offset="100%" stopColor="#a4f2d1" /></linearGradient></defs>
      {[35,85,135,185,235].map(y => <line key={y} x1="0" x2={width} y1={y} y2={y} stroke="#ffffff" strokeOpacity=".055" strokeDasharray="3 6" />)}
      <g key={`${symbol}-${range}`}><path className="tv-chart-area" d={`${path} L${width},${height} L0,${height} Z`} fill={`url(#${id}-fill)`} /><path className="tv-chart-line" d={path} fill="none" stroke={`url(#${id}-line)`} strokeWidth="2.5" vectorEffect="non-scaling-stroke" pathLength="1" />
        {values.map((value,i) => <rect key={i} className="tv-volume" x={i * width / count + 1} y={height - (12 + (Math.sin(i * 2.4) + 1) * 13)} width={width / count - 4} height={12 + (Math.sin(i * 2.4) + 1) * 13} fill={i % 3 === 0 ? "#7c79b2" : "#80cfaf"} opacity=".15" />)}
      </g>
      <line x1="0" x2={width} y1={values[count - 1]} y2={values[count - 1]} stroke="#97eac6" strokeOpacity=".25" strokeDasharray="4 5" />
      <circle cx={width - 2} cy={values[count - 1]} r="4" fill="#abf3d3" className={paused ? "" : "tv-chart-end"} />
      {hovered !== null && <g><line x1={hovered / (count - 1) * width} x2={hovered / (count - 1) * width} y1="0" y2={height} stroke="#b7b2d7" strokeOpacity=".5" strokeDasharray="3 5" /><circle cx={hovered / (count - 1) * width} cy={values[hovered]} r="5" fill="#b4f3d8" stroke="#101318" strokeWidth="3" /></g>}
    </svg>
    {hovered !== null && <div className="tv-chart-tooltip" role="status">Demo point {hovered + 1}<strong>{(price * (1 + (values[count - 1] - values[hovered]) / 5000)).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</strong></div>}
    <div className="tv-chart-times" aria-hidden="true">{labels.map(label => <span key={label}>{label}</span>)}</div>
  </div>;
}
