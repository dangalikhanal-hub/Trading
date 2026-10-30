"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import PracticeChart from "./PracticeChart";
import SavedWatchlists from "@/components/dashboard/SavedWatchlists";
import { instruments, timeframes, quoteIsFresh, type Quote, type Candle, type Timeframe } from "@/lib/market/types";
import type { OrderInput } from "@/lib/practice/domain";

interface Position { id: string; symbol: string; quantity: string; entryPrice: string; currentPrice: string | null; marketValue: string | null; unrealizedPnl: string | null; returnPercent: string | null; stopLossPrice: string | null; takeProfitPrice: string | null }
interface Order { id: string; symbol: string; side: string; type: string; status: string; quantity: string; limitPrice: string | null; stopPrice: string | null; filledPrice: string | null; createdAt: string; filledAt: string | null; rejectionReason: string | null }
interface Trade { id: string; symbol: string; side: string; quantity: string; price: string; entryPrice: string | null; fee: string; realizedPnl: string; executedAt: string; order: { type: string; status: string } }
interface Snapshot {
  account: { id: string; cashBalance: string; initialBalance: string; reservedMargin: string };
  metrics: { equity: string | null; marketValue: string | null; unrealized: string | null; realized: string; fees: string; buyingPower: string; todayPnl: string | null; totalPnl: string | null; wins: number; losses: number; closed: number; winRate: string | null };
  positions: Position[]; orders: Order[]; trades: Trade[]; quotes: Record<string, Quote>; errors: Record<string, string>; conditionalExecution: string;
}
interface Preview { token: string; expiresAt: string; order: OrderInput; estimatedPrice: string; estimatedValue: string; estimatedFee: string; estimatedPnl: string | null; loss: string | null; profit: string | null; ratio: string | null; quoteTime: string; note: string }
const usd = (value: string | number | null | undefined) => value == null ? "Unavailable" : Number(value).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const date = (value: string) => new Date(value).toLocaleString();
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "Request failed. Try again.");
  return value;
}

export default function PracticeTerminal() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null), [accountError, setAccountError] = useState("");
  const [symbol, setSymbol] = useState("BTC-USD"), [timeframe, setTimeframe] = useState<Timeframe>("1H"), [search, setSearch] = useState("");
  const [candles, setCandles] = useState<Candle[]>([]), [candleError, setCandleError] = useState(""), [candleLoading, setCandleLoading] = useState(true), [historyLoading, setHistoryLoading] = useState(false);
  const [chartDirty, setChartDirty] = useState(false), [light, setLight] = useState(false);
  const [side, setSide] = useState<"BUY" | "SELL">("BUY"), [type, setType] = useState<OrderInput["type"]>("MARKET"), [quantity, setQuantity] = useState("0.01");
  const [limit, setLimit] = useState(""), [stop, setStop] = useState(""), [stopLoss, setStopLoss] = useState(""), [takeProfit, setTakeProfit] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null), [busy, setBusy] = useState(false), [orderError, setOrderError] = useState(""), [notice, setNotice] = useState("");
  const [tab, setTab] = useState("positions"), [filter, setFilter] = useState(""), [oldest, setOldest] = useState(false);
  const [resetOpen, setResetOpen] = useState(false), [resetBalance, setResetBalance] = useState("100000");
  const [refreshKey, setRefreshKey] = useState(0);
  const symbolRef = useRef(symbol), timeframeRef = useRef(timeframe);
  const previewDialog = useRef<HTMLDialogElement>(null);
  const quote = snapshot?.quotes[symbol];
  const ready = !!quote && quoteIsFresh(quote) && !accountError;

  useEffect(() => { const frame = requestAnimationFrame(() => setLight(localStorage.getItem("practice-theme") === "light")); return () => cancelAnimationFrame(frame); }, []);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await api<Snapshot>("/api/practice/account", { signal: controller.signal });
        if (!controller.signal.aborted) { setSnapshot(result); setAccountError(""); }
      } catch (error) { if (!controller.signal.aborted) setAccountError(error instanceof Error ? error.message : "Practice account unavailable."); }
      finally { if (!controller.signal.aborted) timer = setTimeout(poll, 10_000); }
    }
    void poll(); return () => { controller.abort(); clearTimeout(timer); };
  }, [refreshKey]);

  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    symbolRef.current = symbol; timeframeRef.current = timeframe;
    async function poll() {
      try {
        const result = await api<{ candles: Candle[] }>(`/api/market?symbol=${symbol}&timeframe=${timeframe}`, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setCandles(previous => {
            const merged = new Map(previous.map(c => [c.time, c])); result.candles.forEach(c => merged.set(c.time, c));
            return [...merged.values()].sort((a, b) => a.time - b.time).slice(-3000);
          });
          setCandleError(result.candles.length ? "" : "The provider returned no candles for this range.");
        }
      } catch (error) { if (!controller.signal.aborted) setCandleError(error instanceof Error ? error.message : "Candles unavailable."); }
      finally { if (!controller.signal.aborted) { setCandleLoading(false); timer = setTimeout(poll, 15_000); } }
    }
    void poll(); return () => { controller.abort(); clearTimeout(timer); };
  }, [symbol, timeframe, refreshKey]);

  useEffect(() => {
    if (preview) previewDialog.current?.showModal();
    else previewDialog.current?.close();
  }, [preview]);

  function changeContext(nextSymbol: string, nextTimeframe = timeframe) {
    if (symbol === nextSymbol && timeframe === nextTimeframe) return;
    if (chartDirty && !window.confirm("Discard unsaved chart drawings before changing symbol or timeframe?")) return;
    setChartDirty(false); setCandles([]); setCandleLoading(true); setCandleError(""); setSymbol(nextSymbol); setTimeframe(nextTimeframe); setPreview(null); setLimit(""); setStop(""); setStopLoss(""); setTakeProfit("");
  }
  async function olderCandles() {
    if (!candles.length) return;
    const context = { symbol, timeframe }; setHistoryLoading(true);
    try {
      const result = await api<{ candles: Candle[] }>(`/api/market?symbol=${symbol}&timeframe=${timeframe}&end=${candles[0].time - 1}`);
      if (context.symbol !== symbolRef.current || context.timeframe !== timeframeRef.current) return;
      setCandles(previous => { const merged = new Map([...result.candles, ...previous].map(c => [c.time, c])); return [...merged.values()].sort((a, b) => a.time - b.time).slice(-3000); });
      if (!result.candles.length) setCandleError("No earlier candles returned by the provider.");
    } catch (error) { setCandleError(error instanceof Error ? error.message : "History unavailable."); }
    finally { setHistoryLoading(false); }
  }
  async function orderPreview(event?: FormEvent, close?: Position) {
    event?.preventDefault(); setBusy(true); setOrderError(""); setNotice("");
    try {
      const order: OrderInput = close ? { mode: "PRACTICE", symbol: close.symbol, side: "SELL", type: "MARKET", quantity: close.quantity } : {
        mode: "PRACTICE", symbol, side, type, quantity,
        ...(["LIMIT", "STOP_LIMIT"].includes(type) ? { limitPrice: limit } : {}), ...(["STOP_MARKET", "STOP_LIMIT"].includes(type) ? { stopPrice: stop } : {}),
        ...(side === "BUY" && stopLoss ? { stopLossPrice: stopLoss } : {}), ...(side === "BUY" && takeProfit ? { takeProfitPrice: takeProfit } : {}),
      };
      setPreview(await api<Preview>("/api/practice/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "preview", order }) }));
    } catch (error) { setOrderError(error instanceof Error ? error.message : "Preview failed."); }
    finally { setBusy(false); }
  }
  async function confirmOrder() {
    if (!preview) return;
    setBusy(true); setOrderError("");
    try {
      const result = await api<Order>("/api/practice/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm", confirmed: true, token: preview.token }) });
      setPreview(null); setNotice(`Practice order ${result.status.toLowerCase()}.${result.rejectionReason ? ` ${result.rejectionReason}` : ""}`); setRefreshKey(v => v + 1);
    } catch (error) { setOrderError(error instanceof Error ? error.message : "Order failed. Retry the same confirmation to avoid duplicates."); }
    finally { setBusy(false); }
  }
  async function cancel(id: string) {
    if (!window.confirm("Cancel this pending practice order?")) return;
    setBusy(true); setOrderError("");
    try { await api("/api/practice/orders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); setNotice("Practice order cancelled."); setRefreshKey(v => v + 1); }
    catch (error) { setOrderError(error instanceof Error ? error.message : "Cancellation failed."); }
    finally { setBusy(false); }
  }
  async function reset(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm("Reset PRACTICE account? All practice positions, orders and trade history will be permanently cleared. Chart drawings and existing demo wallets remain saved.")) return;
    setBusy(true); setOrderError("");
    try { await api("/api/practice/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset", confirm: "RESET PRACTICE", balance: resetBalance }) }); setPreview(null); setResetOpen(false); setNotice("Practice account reset."); setRefreshKey(v => v + 1); }
    catch (error) { setOrderError(error instanceof Error ? error.message : "Reset failed."); }
    finally { setBusy(false); }
  }
  const m = snapshot?.metrics;
  const pending = snapshot?.orders.filter(o => ["PENDING", "OPEN"].includes(o.status)) ?? [];
  const filtered = <T extends { symbol: string }>(rows: T[]) => { const values = rows.filter(r => r.symbol.toLowerCase().includes(filter.toLowerCase())); return oldest ? [...values].reverse() : values; };
  return <div className={`pt-terminal ${light ? "pt-light" : ""}`}>
    <header className="pt-heading"><div><Link href="/dashboard">← Dashboard</Link><h1>Practice trading</h1><p>Real market prices. Virtual USD. No brokerage execution.</p></div>
      <div className="pt-mode" role="group" aria-label="Trading mode"><button disabled title="No live broker integration is configured">Live Trading · unavailable</button><button aria-pressed="true" className="pt-active">Practice Mode</button></div>
      <div className="pt-heading-actions"><span className="pt-badge">PAPER TRADING</span><button onClick={() => { setLight(!light); localStorage.setItem("practice-theme", light ? "dark" : "light"); }}>{light ? "Dark theme" : "Light theme"}</button><button onClick={() => setResetOpen(!resetOpen)}>Reset practice account</button></div>
    </header>
    <div className="pt-warning">Conditional orders and stop-loss/take-profit protection are evaluated every 10 seconds while this workspace is open. No fills are assumed for missed prices while closed. Spot, long positions only; no leverage or short selling.</div>
    {accountError && <div className="pt-error" role="alert">{accountError} <button onClick={() => setRefreshKey(v => v + 1)}>Retry connection</button></div>}
    {resetOpen && <form className="pt-reset" onSubmit={reset}><label>Starting virtual USD balance<input type="number" required min="100" max="1000000000" step="0.0001" value={resetBalance} onChange={e => setResetBalance(e.target.value)} /></label><button disabled={busy}>Confirm reset...</button><button type="button" onClick={() => setResetOpen(false)}>Keep account</button></form>}
    <section className="pt-stats" aria-label="Practice account statistics">{[
      ["Virtual cash", snapshot?.account.cashBalance], ["Buying power", m?.buyingPower], ["Portfolio equity", m?.equity], ["Unrealized P/L", m?.unrealized],
      ["Realized P/L", m?.realized], ["Today P/L · UTC*", m?.todayPnl], ["Total P/L", m?.totalPnl],
    ].map(([label, value]) => <article key={label}><span>{label}</span><strong className={value && Number(value) < 0 ? "pt-negative" : ""}>{!snapshot ? "Loading..." : usd(value)}</strong></article>)}</section>
    <div className="pt-layout">
      <aside className="pt-panel pt-markets"><h2>Markets</h2><label htmlFor="practice-search">Search supported symbols</label><input id="practice-search" placeholder="BTC, Ethereum..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="pt-market-columns"><span>Symbol</span><span>Last / 24h</span></div>
        {instruments.filter(i => `${i.symbol} ${i.name}`.toLowerCase().includes(search.toLowerCase())).map(item => {
          const q = snapshot?.quotes[item.symbol], fresh = q && quoteIsFresh(q) && !accountError;
          return <button key={item.symbol} className={`pt-market ${symbol === item.symbol ? "pt-active" : ""}`} onClick={() => changeContext(item.symbol)}><span><strong>{item.symbol}</strong><small>{item.name}</small></span><span>{fresh ? usd(q.price) : "Unavailable"}<small className={q && Number(q.change) < 0 ? "pt-negative" : "pt-positive"}>{fresh ? `${Number(q.changePercent) > 0 ? "+" : ""}${q.changePercent}%` : "No fresh quote"}</small></span></button>;
        })}
        <p className="pt-muted">Coinbase Exchange · REST polling every 10s. Quotes older than 30s cannot execute orders.</p><p className="pt-muted">Search currently covers BTC, ETH, and SOL in USD. Other assets require a provider adapter.</p>
        {snapshot && Object.entries(snapshot.errors).map(([key, value]) => <p className="pt-negative" key={key}>{key}: {value}</p>)}
      </aside>
      <section className="pt-panel pt-chart-panel"><div className="pt-symbol-heading"><div><h2>{symbol}</h2><strong>{ready ? usd(quote.price) : "Quote unavailable"}</strong><p className="pt-muted">{quote ? `${quote.status} · ${date(quote.time)} · REST-polled, not a tick stream` : "Connecting to Coinbase Exchange..."}</p></div><div className="pt-bid-ask"><span>Bid {ready ? usd(quote.bid) : "—"}</span><span>Ask {ready ? usd(quote.ask) : "—"}</span><span>24h volume {ready ? Number(quote.volume).toLocaleString() : "—"}</span></div></div>
        <div className="pt-timeframes" aria-label="Candle timeframe">{Object.keys(timeframes).map(tf => <button key={tf} aria-pressed={tf === timeframe} onClick={() => changeContext(symbol, tf as Timeframe)}>{tf}</button>)}<button disabled={!candles.length || candles.length >= 3000 || historyLoading} onClick={() => void olderCandles()}>{historyLoading ? "Loading history..." : "Earlier candles"}</button></div>
        {candleLoading && <p role="status">Loading historical candles...</p>}{candleError && <p role="alert" className="pt-error">{candleError} Existing candles, if shown, are historical and may be stale.</p>}
        <PracticeChart key={`${symbol}:${timeframe}`} candles={candles} symbol={symbol} timeframe={timeframe} light={light} referenceQuote={quote} onDirtyChange={setChartDirty} />
      </section>
      <aside className="pt-panel pt-order"><h2>Practice order</h2><span className="pt-badge">VIRTUAL USD ONLY</span><form onSubmit={event => void orderPreview(event)}>
        <fieldset disabled={busy}><div className="pt-side-tabs">{(["BUY", "SELL"] as const).map(value => <button type="button" key={value} aria-pressed={side === value} onClick={() => setSide(value)}>{value}</button>)}</div>
          <label>Symbol<input readOnly value={symbol} /></label><label>Order type<select value={type} onChange={e => setType(e.target.value as OrderInput["type"])}><option value="MARKET">Market</option><option value="LIMIT">Limit</option><option value="STOP_MARKET">Stop market</option><option value="STOP_LIMIT">Stop limit</option></select></label>
          <label>Quantity<input type="number" required min="0.00000001" max="1000000" step="0.00000001" value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
          {["LIMIT", "STOP_LIMIT"].includes(type) && <label>Limit price · USD<input type="number" required min="0.0001" step="0.0001" value={limit} onChange={e => setLimit(e.target.value)} /></label>}
          {["STOP_MARKET", "STOP_LIMIT"].includes(type) && <label>Stop price · USD<input type="number" required min="0.0001" step="0.0001" value={stop} onChange={e => setStop(e.target.value)} /></label>}
          {side === "BUY" && <><label>Stop loss · optional<input type="number" min="0.0001" step="0.0001" value={stopLoss} onChange={e => setStopLoss(e.target.value)} /></label><label>Take profit · optional<input type="number" min="0.0001" step="0.0001" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} /></label></>}
          <p className="pt-muted">Available buying power: {usd(m?.buyingPower)}. Pending buy orders reserve cash; pending sells reserve quantity.</p>
          <button className="pt-primary" type="submit" disabled={!ready || busy}>Review practice order</button>
        </fieldset></form><p className="pt-muted">Exact value, fees, and educational risk/reward are calculated by the server before confirmation.</p>
      </aside>
    </div>
    {orderError && <div className="pt-error" role="alert">{orderError}</div>}<p role="status" className="pt-status">{notice}</p>
    <section className="pt-panel pt-portfolio"><div className="pt-tabs" role="tablist" aria-label="Practice account tables">{[["positions", "Positions"], ["pending", `Open orders (${pending.length})`], ["orders", "Order history"], ["trades", "Trade history"]].map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} aria-controls="practice-table" onClick={() => setTab(value)}>{label}</button>)}</div>
      <div className="pt-table-controls"><label>Filter symbol<input value={filter} onChange={e => setFilter(e.target.value)} placeholder="All symbols" /></label><button onClick={() => setOldest(!oldest)}>{oldest ? "Oldest first" : "Newest first"}</button><span>Wins {m?.wins ?? 0} · Losses {m?.losses ?? 0} · Closed sales {m?.closed ?? 0} · Win rate {m?.winRate ?? "—"}% · Fees {usd(m?.fees)}</span></div>
      <div className="pt-table-scroll" id="practice-table" role="tabpanel">
        {tab === "positions" ? <table><caption>Open practice positions</caption><thead><tr>{["Symbol", "Quantity", "Average entry", "Current bid", "Market value", "Unrealized P/L", "Return", "SL / TP", "Action"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{filtered(snapshot?.positions ?? []).map(p => <tr key={p.id}><th>{p.symbol}</th><td>{p.quantity}</td><td>{usd(p.entryPrice)}</td><td>{usd(p.currentPrice)}</td><td>{usd(p.marketValue)}</td><td className={Number(p.unrealizedPnl) < 0 ? "pt-negative" : "pt-positive"}>{usd(p.unrealizedPnl)}</td><td>{p.returnPercent == null ? "—" : `${p.returnPercent}%`}</td><td>{usd(p.stopLossPrice)} / {usd(p.takeProfitPrice)}</td><td><button disabled={busy || !p.currentPrice} onClick={() => void orderPreview(undefined, p)}>Review close</button></td></tr>)}</tbody></table> : tab === "trades" ? <table><caption>Recent practice fills · sales include allocated entry fees in realized P/L</caption><thead><tr>{["Time", "Symbol", "Side", "Quantity", "Entry", "Fill / exit", "Fee", "Realized P/L", "Order type", "Status"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{filtered(snapshot?.trades ?? []).map(t => <tr key={t.id}><td>{date(t.executedAt)}</td><th>{t.symbol}</th><td>{t.side}</td><td>{t.quantity}</td><td>{usd(t.entryPrice)}</td><td>{usd(t.price)}</td><td>{usd(t.fee)}</td><td>{t.side === "SELL" ? usd(t.realizedPnl) : "—"}</td><td>{t.order.type}</td><td>{t.order.status}</td></tr>)}</tbody></table> : <table><caption>{tab === "pending" ? "Pending practice orders" : "Recent practice orders"}</caption><thead><tr>{["Created", "Symbol", "Side", "Type", "Quantity", "Limit / stop", "Filled price", "Status", "Filled time / reason", "Action"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{filtered(tab === "pending" ? pending : snapshot?.orders ?? []).map(o => <tr key={o.id}><td>{date(o.createdAt)}</td><th>{o.symbol}</th><td>{o.side}</td><td>{o.type}</td><td>{o.quantity}</td><td>{o.limitPrice ?? "—"} / {o.stopPrice ?? "—"}</td><td>{o.status}</td><td>{o.filledAt ? date(o.filledAt) : o.rejectionReason ?? "—"}</td><td>{["PENDING", "OPEN"].includes(o.status) && <button disabled={busy} onClick={() => void cancel(o.id)}>Cancel</button>}</td></tr>)}</tbody></table>}
        {((tab === "positions" ? snapshot?.positions : tab === "trades" ? snapshot?.trades : tab === "pending" ? pending : snapshot?.orders) ?? []).filter(row => row.symbol.toLowerCase().includes(filter.toLowerCase())).length === 0 && <p className="pt-empty">{snapshot ? "No matching records yet." : "Loading practice account..."}</p>}
      </div><p className="pt-muted">{snapshot?.conditionalExecution} Win/loss statistics count sell fills, including partial closes.</p>
    </section>
    <SavedWatchlists onOpenDemo={value => changeContext(`${value}-USD`)} quotes={snapshot?.quotes} onOpenLive={value => changeContext(value)} />
    <dialog ref={previewDialog} className="pt-confirmation" onCancel={event => { if (busy) event.preventDefault(); else setPreview(null); }}>
      {preview && <><h2>Confirm practice order</h2><span className="pt-badge">PAPER TRADING · VIRTUAL FUNDS</span><dl>{[
        ["Side / symbol", `${preview.order.side} ${preview.order.symbol}`], ["Quantity / type", `${preview.order.quantity} · ${preview.order.type}`], ["Estimated price", usd(preview.estimatedPrice)], ["Estimated value", usd(preview.estimatedValue)], ["Estimated fee", usd(preview.estimatedFee)],
        ["Limit / stop", `${preview.order.limitPrice ?? "—"} / ${preview.order.stopPrice ?? "—"}`], ["Estimated sale P/L", preview.estimatedPnl == null ? "Not applicable" : usd(preview.estimatedPnl)], ["Stop loss / take profit", `${preview.order.stopLossPrice ?? "—"} / ${preview.order.takeProfitPrice ?? "—"}`], ["Potential loss / profit*", `${usd(preview.loss)} / ${usd(preview.profit)}`], ["Risk / reward*", preview.ratio ? `1 : ${preview.ratio}` : "Not set"], ["Quote time", date(preview.quoteTime)], ["Confirmation expires", date(preview.expiresAt)],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>{preview.note}</p><p>*Educational estimates exclude fees, spread, gaps, and slippage. Stops do not guarantee a loss limit.</p>{orderError && <p role="alert" className="pt-error">{orderError}</p>}<div className="pt-confirm-actions"><button disabled={busy} onClick={() => setPreview(null)}>Back</button><button className="pt-primary" disabled={busy} onClick={() => void confirmOrder()}>{busy ? "Submitting..." : "Place Practice Order"}</button></div></>}
    </dialog>
  </div>;
}
