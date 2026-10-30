"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createChart, CandlestickSeries, HistogramSeries, createSeriesMarkers, ColorType, type IChartApi, type ISeriesApi, type IPriceLine, type Time, type UTCTimestamp, type Logical } from "lightweight-charts";
import { type Candle, type Timeframe, type Quote, timeframes } from "@/lib/market/types";
import { detectPatterns, type Pattern } from "@/lib/chart/patterns";
import { parseDrawings, type Drawing, type DrawingPoint, type DrawingTool } from "@/lib/chart/drawings";
import { useTicker } from "./useTicker";

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
  const ticker = useTicker(symbol, referenceQuote);
  const dataRef = useRef(candles), patternsRef = useRef<Pattern[]>([]);
  const [tool, setTool] = useState<DrawingTool | "pan" | "select">("pan");
  const [shapes, setShapes] = useState<Drawing[]>([]), [past, setPast] = useState<Drawing[][]>([]), [future, setFuture] = useState<Drawing[][]>([]);
  const [anchor, setAnchor] = useState<DrawingPoint | null>(null), [selected, setSelected] = useState<string | null>(null);
  const [version, setVersion] = useState(0), [loaded, setLoaded] = useState(false), [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Loading saved drawings..."), [showPatterns, setShowPatterns] = useState(false);
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
      layout: { background: { type: ColorType.Solid, color: "#101720" }, textColor: "#9cabbc", attributionLogo: true },
      grid: { vertLines: { color: "#1b2735" }, horzLines: { color: "#1b2735" } },
      rightPriceScale: { borderColor: "#2c3c4f", scaleMargins: { top: .08, bottom: .23 } },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#2c3c4f" },
    });
    const price = chart.addSeries(CandlestickSeries, { upColor: "#40c9a2", downColor: "#ef7182", wickUpColor: "#40c9a2", wickDownColor: "#ef7182", borderVisible: false, priceFormat: { type: "price", precision: 4, minMove: .0001 } });
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
    api.current?.applyOptions({ layout: { background: { type: ColorType.Solid, color: light ? "#ffffff" : "#101720" }, textColor: light ? "#34465d" : "#9cabbc" }, grid: { vertLines: { color: light ? "#edf1f5" : "#1b2735" }, horzLines: { color: light ? "#edf1f5" : "#1b2735" } } });
  }, [light]);

  const initialized = useRef(false);
  useEffect(() => {
    const prior = dataRef.current;
    dataRef.current = candles;
    liveCandle.current = candles[candles.length - 1] ?? null;
    if (!series.current || !volume.current || !candles.length) return;
    const sameHistory = initialized.current && prior.length === candles.length && prior.every((c, i) => c.time === candles[i].time && (i === prior.length - 1 || (c.open === candles[i].open && c.high === candles[i].high && c.low === candles[i].low && c.close === candles[i].close && c.volume === candles[i].volume)));
    if (sameHistory) {
      const c = candles[candles.length - 1];
      series.current.update({ ...c, time: c.time as UTCTimestamp });
      volume.current.update({ time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? "#40c9a255" : "#ef718255" });
    } else {
      const range = api.current?.timeScale().getVisibleLogicalRange();
      const added = prior.length ? candles.findIndex(c => c.time === prior[0].time) : 0;
      series.current.setData(candles.map(c => ({ ...c, time: c.time as UTCTimestamp })));
      volume.current.setData(candles.map(c => ({ time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? "#40c9a255" : "#ef718255" })));
      if (!initialized.current) api.current?.timeScale().fitContent();
      else if (range && added > 0) api.current?.timeScale().setVisibleLogicalRange({ from: range.from + added, to: range.to + added });
    }
    initialized.current = true;
    const patterns = showPatterns ? detectPatterns(candles, timeframes[timeframe]) : [];
    patternsRef.current = patterns;
    const groups = new Map<number, Pattern[]>();
    patterns.forEach(p => groups.set(p.time, [...(groups.get(p.time) ?? []), p]));
    markerApi.current?.setMarkers([...groups].map(([time, group]) => ({ time: time as UTCTimestamp, position: "aboveBar", shape: "circle", color: group[0].bias === "bullish" ? "#40c9a2" : group[0].bias === "bearish" ? "#ef7182" : "#b8a3ef", text: "◆", id: String(time) })));
    redraw();
  }, [candles, showPatterns, timeframe]);

  useEffect(() => {
    const quote = ticker.quote;
    if (!quote || !series.current) { livePriceLine.current?.applyOptions({ title: "Stale last trade", color: "#88929e" }); return; }
    const price = Number(quote.price);
    if (!livePriceLine.current) livePriceLine.current = series.current.createPriceLine({ price, color: "#ceac58", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "Latest trade" });
    else livePriceLine.current.applyOptions({ price, title: quote.delivery === "WebSocket ticker" ? "Live last" : "REST last", color: "#ceac58" });
    const current = liveCandle.current, tradeTime = Date.parse(quote.time) / 1000;
    // Update only an existing current bar with an observed actual trade. REST
    // supplies its volume and reconciles history/gaps every 15 seconds.
    if (quote.delivery === "WebSocket ticker" && current && tradeTime >= current.time && tradeTime < current.time + timeframes[timeframe]) {
      const next = { ...current, close: price, high: Math.max(current.high, price), low: Math.min(current.low, price) };
      liveCandle.current = next; series.current.update({ ...next, time: next.time as UTCTimestamp });
    }
  }, [ticker.quote, timeframe]);

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
    <p className="pt-live-ticker" role="status">{ticker.quote ? `${ticker.quote.delivery} · ${ticker.quote.price} USD · ${new Date(ticker.quote.time).toLocaleTimeString()}` : "No fresh ticker price"} · {ticker.connection}. Volume reconciles via REST every 15s; executions use server quotes.</p>
    <div className="pt-drawing-toolbar" aria-label="Drawing tools">{tools.map(item => <button key={item.id} aria-pressed={tool === item.id} onClick={() => { setTool(item.id); setAnchor(null); }}>{item.label}</button>)}
      <button disabled={!past.length || saving} onClick={() => { const previous = past[past.length - 1]; setFuture(f => [...f, shapes]); setShapes(previous); setPast(p => p.slice(0, -1)); setDirty(true); }}>Undo</button>
      <button disabled={!future.length || saving} onClick={() => { const next = future[future.length - 1]; setPast(p => [...p, shapes]); setShapes(next); setFuture(f => f.slice(0, -1)); setDirty(true); }}>Redo</button>
      <button disabled={!selected || saving} onClick={() => { commit(shapes.filter(s => s.id !== selected)); setSelected(null); }}>Delete selected</button>
      <button disabled={!shapes.length || saving} onClick={() => { if (window.confirm("Clear all drawings for this symbol and timeframe? Save to persist this change.")) commit([]); }}>Clear drawings</button>
      <button disabled={!loaded || !dirty || saving || !!drag.current} onClick={() => void save()}>{saving ? "Saving..." : "Save drawings"}</button>
      <button disabled={saving} onClick={() => { if (!dirty || window.confirm("Discard unsaved drawing changes and reload?")) void loadDrawings(); }}>Reload drawings</button>
    </div>
    <div className="pt-chart-information">{current ? <span>{new Date(current.time * 1000).toLocaleString()} · O {current.open} H {current.high} L {current.low} C {current.close} · V {current.volume.toFixed(4)}</span> : "Waiting for actual market candles"}</div>
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
              const y = a.y + (b.y - a.y) * level; return <g key={level}>{line(a.x, y, b.x, y)}<text x={Math.min(a.x, b.x) + 4} y={y - 4} fill={color} fontSize="11">{level} · {(shape.points[0].price + (shape.points[1].price - shape.points[0].price) * level).toFixed(2)}</text></g>;
            }) : shape.tool === "ray" ? (() => { const dx = b.x - a.x, endX = dx >= 0 ? width : 0; return line(a.x, a.y, Math.abs(dx) < 1 ? a.x : endX, Math.abs(dx) < 1 ? height : a.y + (b.y - a.y) * (endX - a.x) / dx); })() : line(a.x, a.y, b.x, b.y))}
            {shape.id === selected && shape.points.map((p, i) => { const handle = coords(p); return handle && <circle key={i} data-drawing={shape.id} data-endpoint={i} cx={handle.x} cy={handle.y} r="8" fill={color} stroke="#101720" strokeWidth="2" />; })}
          </g>;
        })}
        {anchor && (() => { const p = coords(anchor); return p && <circle cx={p.x} cy={p.y} r="5" fill="#f5bd60" />; })()}
      </svg>
    </div>
    <div className="pt-chart-controls"><label><input type="checkbox" checked={showPatterns} onChange={event => { setShowPatterns(event.target.checked); setChosenPattern(null); }} /> Show candlestick patterns</label>
      <button onClick={() => api.current?.timeScale().fitContent()}>Fit chart</button><button onClick={async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await shell.current?.requestFullscreen(); } catch { setMessage("Fullscreen is unavailable in this browser."); } }}>Full screen</button>
    </div>
    <p className="pt-muted" role="status">{dirty ? "Unsaved drawings. " : ""}{message}{anchor ? " Tap the second endpoint." : ""} Use Pan / zoom to explore candles and select pattern markers.</p>
    {showPatterns && <label className="pt-pattern-picker">Inspect detected pattern <select value="" onChange={event => { const time = Number(event.target.value); setChosenPattern(patternsRef.current.filter(p => p.time === time)); }}><option value="">Choose a candle ({patternsRef.current.length} detections)</option>{[...new Set(patternsRef.current.map(p => p.time))].map(time => <option key={time} value={time}>{new Date(time * 1000).toLocaleString()} · {patternsRef.current.filter(p => p.time === time).map(p => p.name).join(", ")}</option>)}</select></label>}
    {chosenPattern && <aside className="pt-pattern-detail">{chosenPattern.map(p => <p key={p.name}><strong>{p.name} · {p.bias}</strong><br />{new Date(p.time * 1000).toLocaleString()} · {p.explanation}</p>)}<p>Informational heuristics, not guaranteed buy/sell signals. Only closed candles are analyzed.</p><button onClick={() => setChosenPattern(null)}>Close details</button></aside>}
    <p className="pt-attribution">TradingView Lightweight Charts™ · Copyright © 2025 TradingView, Inc. · <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView</a></p>
  </section>;
}
