"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createChart, CandlestickSeries, HistogramSeries, createSeriesMarkers, ColorType, type IChartApi, type ISeriesApi, type IPriceLine, type Time, type UTCTimestamp, type Logical } from "lightweight-charts";
import { type Candle, type Timeframe, type Quote, timeframes } from "@/lib/market/types";
import { detectPatterns, type Pattern } from "@/lib/chart/patterns";
import { parseDrawings, type Drawing, type DrawingPoint, type DrawingTool } from "@/lib/chart/drawings";
import { candleFromTrade } from "@/lib/chart/live-candle";
import { Crosshair, MousePointer2, TrendingUp, Minus, MoveVertical, ArrowUpRight, PencilRuler, Square, Undo2, Redo2, Trash2, Save, RefreshCw, Maximize2, ScanLine } from "lucide-react";

const tools: { id: DrawingTool | "pan" | "select"; label: string }[] = [
  { id: "pan", label: "Pan / zoom" }, { id: "select", label: "Select / move" }, { id: "trend", label: "Trend line" },
  { id: "horizontal", label: "Horizontal" }, { id: "vertical", label: "Vertical" }, { id: "ray", label: "Ray" },
  { id: "price", label: "Price line" }, { id: "rectangle", label: "Rectangle" }, { id: "fibonacci", label: "Fibonacci" },
];

export default function PracticeChart({ candles, symbol, timeframe, light, referenceQuote, onDirtyChange }: {
  candles: Candle[]; symbol: string; timeframe: Timeframe; light: boolean; referenceQuote?: Quote; onDirtyChange: (dirty: boolean) => void;
}) {
  const container = useRef<HTMLDivElement>(null), shell = useRef<HTMLElement>(null);
  const api = useRef<IChartApi | null>(null), series = useRef<ISeriesApi<"Candlestick"> | null>(null), volume = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markerApi = useRef<ReturnType<typeof createSeriesMarkers<Time>> | null>(null);
  const livePriceLine = useRef<IPriceLine | null>(null), liveCandle = useRef<Candle | null>(null);
  const ticker = { quote: referenceQuote };
  const patterns = useMemo(() => detectPatterns(candles, timeframes[timeframe]), [candles, timeframe]);
  const dataRef = useRef(candles), patternsRef = useRef<Pattern[]>([]);
  const [tool, setTool] = useState<DrawingTool | "pan" | "select">("pan");
  const [shapes, setShapes] = useState<Drawing[]>([]), [past, setPast] = useState<Drawing[][]>([]), [future, setFuture] = useState<Drawing[][]>([]);
  const [anchor, setAnchor] = useState<DrawingPoint | null>(null), [selected, setSelected] = useState<string | null>(null);
  const [version, setVersion] = useState(0), [loaded, setLoaded] = useState(false), [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Loading saved drawings..."), [showPatterns, setShowPatterns] = useState(true);
  const [chosenPattern, setChosenPattern] = useState<Pattern[] | null>(null), [ohlc, setOhlc] = useState<Candle | null>(null);
  const [viewport, setViewport] = useState(0);
  const drag = useRef<{ id: string; endpoint: number | null; start: DrawingPoint; original: Drawing[] } | null>(null);
  const refreshFrame = useRef(0);
  const redraw = () => { cancelAnimationFrame(refreshFrame.current); refreshFrame.current = requestAnimationFrame(() => setViewport(v => v + 1)); };
  const dirtyCallback = useRef(onDirtyChange);
  useEffect(() => { dirtyCallback.current = onDirtyChange; }, [onDirtyChange]);
  useEffect(() => { dirtyCallback.current(dirty); }, [dirty]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);

  useEffect(() => {
    if (!container.current) return;
    const chart = createChart(container.current, { autoSize: true, height: 440,
      layout: { background: { type: ColorType.Solid, color: "#151e23" }, textColor: "#9cabbc", attributionLogo: true },
      grid: { vertLines: { color: "#323d42" }, horzLines: { color: "#323d42" } },
      rightPriceScale: { borderColor: "#3c474d", scaleMargins: { top: .08, bottom: .23 } },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#3c474d" },
    });
    const price = chart.addSeries(CandlestickSeries, { upColor: "#1499f5", downColor: "#ef4d47", wickUpColor: "#1499f5", wickDownColor: "#ef4d47", borderVisible: false, priceFormat: { type: "price", precision: 4, minMove: .0001 } });
    const bars = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "volume" });
    bars.priceScale().applyOptions({ scaleMargins: { top: .82, bottom: 0 } });
    api.current = chart; series.current = price; volume.current = bars;
    markerApi.current = createSeriesMarkers(price, []);
    chart.timeScale().subscribeVisibleLogicalRangeChange(redraw);
    chart.timeScale().subscribeSizeChange(redraw);
    chart.subscribeCrosshairMove(event => {
      const row = event.seriesData.get(price);
      if (row && "open" in row) setOhlc(dataRef.current.find(c => c.time === row.time) ?? null);
      else setOhlc(null);
    });
    chart.subscribeClick(event => {
      if (event.time) {
        const found = patternsRef.current.filter(p => p.time === event.time);
        if (found.length) setChosenPattern(found);
      }
    });
    return () => { cancelAnimationFrame(refreshFrame.current); chart.remove(); api.current = null; series.current = null; volume.current = null; };
    // Chart lifetime is tied to the symbol/timeframe component key, not price ticks.
  }, []);

  useEffect(() => {
    api.current?.applyOptions({ layout: { background: { type: ColorType.Solid, color: light ? "#ffffff" : "#151e23" }, textColor: light ? "#34465d" : "#9cabbc" }, grid: { vertLines: { color: light ? "#edf1f5" : "#323d42" }, horzLines: { color: light ? "#edf1f5" : "#323d42" } } });
  }, [light]);

  const initialized = useRef(false);
  useEffect(() => {
    const prior = dataRef.current;
    const live = liveCandle.current;
    const display = live && candles.length && live.time > candles[candles.length - 1].time ? [...candles, live] : candles;
    dataRef.current = display;
    liveCandle.current = display[display.length - 1] ?? null;
    if (!series.current || !volume.current || !candles.length) return;
    const sameHistory = ! (live && candles.length && live.time > candles[candles.length - 1].time) && initialized.current && prior.length === candles.length && prior.every((c, i) => c.time === candles[i].time && (i === prior.length - 1 || (c.open === candles[i].open && c.high === candles[i].high && c.low === candles[i].low && c.close === candles[i].close && c.volume === candles[i].volume)));
    if (sameHistory) {
      const c = candles[candles.length - 1];
      series.current.update({ ...c, time: c.time as UTCTimestamp });
      volume.current.update({ time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? "#40c9a255" : "#ef718255" });
    } else {
      const range = api.current?.timeScale().getVisibleLogicalRange();
      const added = prior.length ? candles.findIndex(c => c.time === prior[0].time) : 0;
      series.current.setData(display.map(c => ({ ...c, time: c.time as UTCTimestamp })));
      volume.current.setData(display.map(c => ({ time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? "#40c9a255" : "#ef718255" })));
      if (!initialized.current) api.current?.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - 90), to: candles.length + 4 });
      else if (range && added > 0) api.current?.timeScale().setVisibleLogicalRange({ from: range.from + added, to: range.to + added });
    }
    initialized.current = true;
    patternsRef.current = showPatterns ? patterns : [];
    const groups = new Map<number, Pattern[]>();
    patternsRef.current.forEach(p => groups.set(p.time, [...(groups.get(p.time) ?? []), p]));
    markerApi.current?.setMarkers([...groups].slice(-24).map(([time, group]) => ({ time: time as UTCTimestamp, position: group[0].bias === "bullish" ? "belowBar" : "aboveBar", shape: group[0].bias === "bullish" ? "arrowUp" : group[0].bias === "bearish" ? "arrowDown" : "circle", color: group[0].bias === "bullish" ? "#45c98a" : group[0].bias === "bearish" ? "#ef4d47" : "#e1c75d", text: group[0].name, id: String(time) })));
    redraw();
  }, [candles, showPatterns, timeframe, patterns]);

  useEffect(() => {
    const quote = ticker.quote;
    if (!quote || !series.current) { livePriceLine.current?.applyOptions({ title: "Stale last trade", color: "#88929e" }); return; }
    const price = Number(quote.price);
    if (!livePriceLine.current) livePriceLine.current = series.current.createPriceLine({ price, color: "#ceac58", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "Latest trade" });
    else livePriceLine.current.applyOptions({ price, title: quote.delivery === "WebSocket ticker" ? "Live last" : "REST last", color: "#ceac58" });
    const next = candleFromTrade(liveCandle.current, quote, timeframes[timeframe]);
    if (next && candles.length) {
      liveCandle.current = next;
      series.current.update({ ...next, time: next.time as UTCTimestamp });
      dataRef.current = dataRef.current[dataRef.current.length - 1]?.time === next.time ? [...dataRef.current.slice(0, -1), next] : [...dataRef.current, next];
    }
  }, [ticker.quote, timeframe, candles.length]);

  async function loadDrawings(signal?: AbortSignal) {
    try {
      const response = await fetch(`/api/chart/drawings?symbol=${symbol}&timeframe=${timeframe}`, { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load drawings.");
      const parsed = parseDrawings(data.shapes);
      if (!parsed) throw new Error("Saved drawing data is invalid.");
      setShapes(parsed); setVersion(data.version); setLoaded(true); setDirty(false); setPast([]); setFuture([]); setSelected(null); setMessage("Drawings loaded. Choose a drawing tool, then tap the chart.");
    } catch (error) { if (!signal?.aborted) setMessage(error instanceof Error ? error.message : "Unable to load drawings."); }
  }
  useEffect(() => {
    const controller = new AbortController(); void loadDrawings(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe]);
  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/chart/drawings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol, timeframe, shapes, version }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save drawings.");
      setVersion(data.version); setDirty(false); setMessage("Drawings saved to your account.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save drawings."); }
    finally { setSaving(false); }
  }
  function commit(next: Drawing[], original = shapes) {
    if (next.length > 100) { setMessage("Maximum 100 drawings per symbol/timeframe."); return; }
    if (!parseDrawings(next)) { setMessage("Keep drawings within valid positive prices and dates."); setShapes(original); return; }
    setPast(previous => [...previous.slice(-49), original]); setFuture([]); setShapes(next); setDirty(true); setAnchor(null);
  }
  function pointAt(x: number, y: number): DrawingPoint | null {
    const logical = api.current?.timeScale().coordinateToLogical(x), price = series.current?.coordinateToPrice(y);
    if (logical == null || price == null || price <= 0 || !candles.length) return null;
    const index = Math.floor(logical), fraction = logical - index, interval = timeframes[timeframe];
    const at = (i: number) => candles[i]?.time ?? (i < 0 ? candles[0].time + i * interval : candles[candles.length - 1].time + (i - candles.length + 1) * interval);
    return { time: at(index) + fraction * (at(index + 1) - at(index)), price };
  }
  function coords(p: DrawingPoint) {
    if (!api.current || !series.current || !candles.length) return null;
    let low = 0, high = candles.length - 1;
    while (low < high) { const mid = Math.ceil((low + high) / 2); if (candles[mid].time <= p.time) low = mid; else high = mid - 1; }
    const interval = timeframes[timeframe];
    const logical = p.time < candles[0].time ? (p.time - candles[0].time) / interval : low + (p.time - candles[low].time) / ((candles[low + 1]?.time ?? candles[low].time + interval) - candles[low].time);
    const x = api.current.timeScale().logicalToCoordinate(logical as Logical), y = series.current.priceToCoordinate(p.price);
    return x == null || y == null ? null : { x, y };
  }
  function eventPoint(event: ReactPointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return pointAt(event.clientX - rect.left, event.clientY - rect.top);
  }
  function down(event: ReactPointerEvent<SVGSVGElement>) {
    if (!loaded || saving) return;
    const point = eventPoint(event); if (!point) return;
    if (tool === "select") {
      const target = (event.target as Element).closest("[data-drawing]");
      const id = target?.getAttribute("data-drawing") ?? null; setSelected(id);
      if (id) {
        const endpoint = target?.getAttribute("data-endpoint");
        drag.current = { id, endpoint: endpoint == null ? null : Number(endpoint), start: point, original: shapes };
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      return;
    }
    if (tool === "pan") return;
    if (["horizontal", "vertical", "price"].includes(tool)) commit([...shapes, { id: crypto.randomUUID(), tool, points: [point] }]);
    else if (!anchor) setAnchor(point);
    else commit([...shapes, { id: crypto.randomUUID(), tool, points: [anchor, point] }]);
  }
  function move(event: ReactPointerEvent<SVGSVGElement>) {
    const active = drag.current, point = eventPoint(event);
    if (!active || !point) return;
    setShapes(active.original.map(shape => shape.id !== active.id ? shape : { ...shape, points: shape.points.map((p, i) => active.endpoint != null ? (i === active.endpoint ? point : p) : { time: p.time + point.time - active.start.time, price: p.price + point.price - active.start.price }) }));
  }
  function up() { if (drag.current) { commit(shapes, drag.current.original); drag.current = null; } }
  const size = container.current?.getBoundingClientRect();
  const width = size?.width ?? 800, height = size?.height ?? 440;
  const current = ohlc ?? candles[candles.length - 1];
  // viewport is a cheap redraw trigger when the canvas scale changes.
  void viewport;
  return <section ref={shell} className="pt-chart" aria-label="Candlestick chart and drawing tools" onKeyDown={event => {
    if (event.key === "Escape") { setAnchor(null); setSelected(null); }
    if (event.key === "Delete" && selected && !(event.target instanceof HTMLInputElement)) commit(shapes.filter(shape => shape.id !== selected));
  }}>
    <div className="pt-drawing-toolbar" aria-label="Drawing tools">{tools.map(item => {
      const Icon = ({ pan: Crosshair, select: MousePointer2, trend: TrendingUp, horizontal: Minus, vertical: MoveVertical, ray: ArrowUpRight, price: ScanLine, rectangle: Square, fibonacci: PencilRuler })[item.id];
      return <button key={item.id} title={item.label} aria-label={item.label} aria-pressed={tool === item.id} onClick={() => { setTool(item.id); setAnchor(null); }}><Icon size={20} /></button>;
    })}
      <span className="pt-tool-divider" />
      <button title="Undo" aria-label="Undo drawing" disabled={!past.length || saving} onClick={() => { const previous = past[past.length - 1]; setFuture(f => [...f, shapes]); setShapes(previous); setPast(p => p.slice(0, -1)); setDirty(true); }}><Undo2 size={18} /></button>
      <button title="Redo" aria-label="Redo drawing" disabled={!future.length || saving} onClick={() => { const next = future[future.length - 1]; setPast(p => [...p, shapes]); setShapes(next); setFuture(f => f.slice(0, -1)); setDirty(true); }}><Redo2 size={18} /></button>
      <button title="Delete selected drawing" aria-label="Delete selected drawing" disabled={!selected || saving} onClick={() => { commit(shapes.filter(s => s.id !== selected)); setSelected(null); }}><Trash2 size={18} /></button>
      <button title="Save drawings" aria-label="Save drawings" disabled={!loaded || !dirty || saving || !!drag.current} onClick={() => void save()}><Save size={18} /></button>
      <button title="Reload drawings" aria-label="Reload drawings" disabled={saving} onClick={() => { if (!dirty || window.confirm("Discard unsaved drawing changes and reload?")) void loadDrawings(); }}><RefreshCw size={18} /></button>
    </div>
    <div className="pt-chart-information">{current ? <span>{new Date(current.time * 1000).toLocaleString()}  /  O {current.open} H {current.high} L {current.low} C {current.close}  /  V {current.volume.toFixed(4)}</span> : "Waiting for actual market candles"}</div>
    <div className="pt-chart-canvas" onWheel={redraw} onPointerMove={tool === "pan" ? redraw : undefined}>
      <div ref={container} className="pt-canvas-host" />
      <svg className={`pt-drawings ${tool === "pan" ? "pt-pass-through" : ""}`} width={width} height={height} role="img" aria-label="Chart drawing overlay" tabIndex={0} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { if (drag.current) setShapes(drag.current.original); drag.current = null; }}>
        {shapes.map(shape => {
          const a = coords(shape.points[0]), b = shape.points[1] ? coords(shape.points[1]) : null;
          if (!a) return null;
          const color = shape.id === selected ? "#f5bd60" : "#a08bfa";
          const line = (x1: number, y1: number, x2: number, y2: number, key?: string) => <g key={key}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2" /><line data-drawing={shape.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth="14" /></g>;
          return <g key={shape.id}>
            {shape.tool === "vertical" ? line(a.x, 0, a.x, height) : shape.tool === "horizontal" || shape.tool === "price" ? <>{line(0, a.y, width, a.y)}<text x="8" y={a.y - 5} fill={color} fontSize="12">{shape.points[0].price.toFixed(4)}</text></> : b && (shape.tool === "rectangle" ? <rect data-drawing={shape.id} x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(a.x - b.x)} height={Math.abs(a.y - b.y)} fill="#a08bfa18" stroke={color} strokeWidth="2" /> : shape.tool === "fibonacci" ? [0, .236, .382, .5, .618, .786, 1].map(level => {
              const y = a.y + (b.y - a.y) * level; return <g key={level}>{line(a.x, y, b.x, y)}<text x={Math.min(a.x, b.x) + 4} y={y - 4} fill={color} fontSize="11">{level}  /  {(shape.points[0].price + (shape.points[1].price - shape.points[0].price) * level).toFixed(2)}</text></g>;
            }) : shape.tool === "ray" ? (() => { const dx = b.x - a.x, endX = dx >= 0 ? width : 0; return line(a.x, a.y, Math.abs(dx) < 1 ? a.x : endX, Math.abs(dx) < 1 ? height : a.y + (b.y - a.y) * (endX - a.x) / dx); })() : line(a.x, a.y, b.x, b.y))}
            {shape.id === selected && shape.points.map((p, i) => { const handle = coords(p); return handle && <circle key={i} data-drawing={shape.id} data-endpoint={i} cx={handle.x} cy={handle.y} r="8" fill={color} stroke="#101720" strokeWidth="2" />; })}
          </g>;
        })}
        {anchor && (() => { const p = coords(anchor); return p && <circle cx={p.x} cy={p.y} r="5" fill="#f5bd60" />; })()}
      </svg>
    </div>
    <div className="pt-chart-controls"><label><input type="checkbox" checked={showPatterns} onChange={event => { setShowPatterns(event.target.checked); setChosenPattern(null); }} /> Show candlestick patterns</label>
      <button onClick={() => api.current?.timeScale().fitContent()}>Fit</button><button onClick={() => api.current?.timeScale().scrollToRealTime()}>Latest</button><button onClick={async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await shell.current?.requestFullscreen(); } catch { setMessage("Fullscreen is unavailable in this browser."); } }} title="Full screen" aria-label="Full screen chart"><Maximize2 size={16} /></button>
    </div>
    <p className="pt-drawing-status" role="status">{dirty ? "Unsaved drawings. " : ""}{message}{anchor ? " Tap the second endpoint." : ""}</p>
    {showPatterns && <div className="pt-pattern-strip"><span>Recent patterns</span>{patterns.length ? patterns.slice(-3).reverse().map(p => <button key={`${p.time}-${p.name}`} className={`pt-pattern-${p.bias}`} onClick={() => { setChosenPattern(patterns.filter(item => item.time === p.time)); const index = candles.findIndex(c => c.time === p.time); if (index >= 0) api.current?.timeScale().setVisibleLogicalRange({ from: Math.max(0, index - 25), to: index + 10 }); }} title={p.explanation}>{p.name}<small>{new Date(p.time * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></button>) : <small>No patterns on closed candles yet.</small>}<p>Closed candles only. Patterns describe price action; they do not predict the next move.</p></div>}
    {chosenPattern && <aside className="pt-pattern-detail">{chosenPattern.map(p => <p key={p.name}><strong>{p.name}  /  {p.bias}</strong><br />{new Date(p.time * 1000).toLocaleString()}  /  {p.explanation}</p>)}<p>Informational heuristics, not guaranteed buy/sell signals. Only closed candles are analyzed.</p><button onClick={() => setChosenPattern(null)}>Close details</button></aside>}
    <p className="pt-attribution">TradingView Lightweight Charts / Copyright 2025 TradingView, Inc. / <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView</a></p>
  </section>;
}
