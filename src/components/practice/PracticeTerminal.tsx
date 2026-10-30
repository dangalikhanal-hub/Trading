"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import PracticeChart from "./PracticeChart";
import { ArrowLeft, ArrowDown, ArrowUp, Bell, BookOpen, CandlestickChart, ChartNoAxesCombined, ChevronDown, CircleHelp, LayoutList, Maximize2, Minimize2, Moon, Plus, Search, Settings2, Sun, Wallet, Wifi } from "lucide-react";
import { useMarketTicker } from "./useMarketTicker";
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
  const [symbol, setSymbol] = useState("BTC-USD"), [timeframe, setTimeframe] = useState<Timeframe>("1m"), [search, setSearch] = useState("");
  const [candles, setCandles] = useState<Candle[]>([]), [candleError, setCandleError] = useState(""), [candleLoading, setCandleLoading] = useState(true), [historyLoading, setHistoryLoading] = useState(false);
  const [chartDirty, setChartDirty] = useState(false), [light, setLight] = useState(false);
  const [side, setSide] = useState<"BUY" | "SELL">("BUY"), [type, setType] = useState<OrderInput["type"]>("MARKET"), [quantity, setQuantity] = useState("0.01");
  const [limit, setLimit] = useState(""), [stop, setStop] = useState(""), [stopLoss, setStopLoss] = useState(""), [takeProfit, setTakeProfit] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null), [busy, setBusy] = useState(false), [orderError, setOrderError] = useState(""), [notice, setNotice] = useState("");
  const [tab, setTab] = useState("positions"), [filter, setFilter] = useState(""), [oldest, setOldest] = useState(false);
  const [resetOpen, setResetOpen] = useState(false), [resetBalance, setResetBalance] = useState("100000");
  const [refreshKey, setRefreshKey] = useState(0);
  const [mobilePanel, setMobilePanel] = useState("chart"), [showSaved, setShowSaved] = useState(false);
  const [portfolioExpanded, setPortfolioExpanded] = useState(false);
  const market = useMarketTicker(refreshKey);
  const symbolRef = useRef(symbol), timeframeRef = useRef(timeframe);
  const previewDialog = useRef<HTMLDialogElement>(null);
  const quote = market.quotes[symbol];
  const ready = !!quote && quoteIsFresh(quote) && !!snapshot && !accountError;

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
    setMobilePanel("chart"); setChartDirty(false); setCandles([]); setCandleLoading(true); setCandleError(""); setSymbol(nextSymbol); setTimeframe(nextTimeframe); setPreview(null); setLimit(""); setStop(""); setStopLoss(""); setTakeProfit("");
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
  const instrument = instruments.find(i => i.symbol === symbol)!;
  const displaySymbol = (value: string) => value.replace("-", "/");
  const price = (value: string | undefined) => value ? Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "--";
  return <div className={`pt-terminal ${light ? "pt-light" : ""} ${portfolioExpanded ? "pt-portfolio-expanded" : ""}`} data-mobile-panel={mobilePanel}>
    <header className="pt-topbar">
      <Link href="/dashboard" className="pt-brand" aria-label="MTrade accounts">mtrade</Link>
      <nav className="pt-symbol-tabs" aria-label="Open instruments">{instruments.map(item => <button key={item.symbol} className={symbol === item.symbol ? "pt-selected" : ""} onClick={() => changeContext(item.symbol)}><span className={`pt-asset pt-asset-${item.symbol.split("-")[0].toLowerCase()}`}>{item.symbol === "BTC-USD" ? "B" : item.symbol === "ETH-USD" ? "E" : "S"}</span><span>{displaySymbol(item.symbol)}</span></button>)}<button className="pt-add-symbol" aria-label="Browse instruments" onClick={() => { setShowSaved(false); setMobilePanel("markets"); document.getElementById("practice-search")?.focus(); }}><Plus size={23} /></button></nav>
      <div className="pt-account-menu"><span><b>Demo</b> Standard</span><strong>{snapshot ? usd(snapshot.account.cashBalance) : "Loading..."} <ChevronDown size={13} /></strong></div>
      <div className="pt-top-actions"><button aria-label={light ? "Dark theme" : "Light theme"} title="Change theme" onClick={() => { setLight(!light); localStorage.setItem("practice-theme", light ? "dark" : "light"); }}>{light ? <Moon size={21} /> : <Sun size={21} />}</button><button aria-label="Trading information" onClick={() => setNotice("Live Coinbase crypto prices. Orders use virtual USD in your practice account. Gold, forex, and indices require another data provider.")}><CircleHelp size={21} /></button><Link href="/dashboard" className="pt-accounts-button"><Wallet size={17} /> My accounts</Link></div>
    </header>
    <nav className="pt-mobile-tabs" aria-label="Terminal panels">{["markets", "chart", "order"].map(panel => <button key={panel} aria-pressed={mobilePanel === panel} onClick={() => setMobilePanel(panel)}>{panel === "markets" ? "Markets" : panel === "chart" ? "Chart" : "Trade"}</button>)}</nav>
    <div className="pt-workspace">
      <nav className="pt-rail" aria-label="Workspace tools"><button aria-label="Instruments" title="Instruments" aria-pressed={!showSaved} onClick={() => { setShowSaved(false); setMobilePanel("markets"); }}><LayoutList size={21} /></button><button aria-label="Saved watchlists" title="Saved watchlists" aria-pressed={showSaved} onClick={() => { setShowSaved(!showSaved); setMobilePanel("markets"); }}><BookOpen size={20} /></button><button aria-label="Open positions" title="Open positions" onClick={() => { setTab("positions"); setMobilePanel("chart"); }}><ChartNoAxesCombined size={20} /></button><button aria-label="Account settings" title="Reset virtual account" aria-pressed={resetOpen} onClick={() => { setResetOpen(!resetOpen); setMobilePanel("order"); }}><Settings2 size={20} /></button><Link href="/dashboard" aria-label="Back to accounts" title="Back to accounts"><ArrowLeft size={21} /></Link></nav>
      <aside className="pt-panel pt-markets">
        <div className="pt-panel-heading"><h2>{showSaved ? "WATCHLISTS" : "INSTRUMENTS"}</h2><span className={`pt-feed-dot ${market.connection === "Live market" ? "is-live" : ""}`} title={market.connection} /></div>
        {showSaved ? <SavedWatchlists onOpenDemo={value => { if (instruments.some(i => i.symbol === `${value}-USD`)) changeContext(`${value}-USD`); }} quotes={market.quotes} onOpenLive={value => { if (instruments.some(i => i.symbol === value)) changeContext(value); }} /> : <>
          <label className="pt-market-search" htmlFor="practice-search"><Search size={19} /><input id="practice-search" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)} /></label>
          <div className="pt-market-category">Crypto <span>USD spot</span><ChevronDown size={17} /></div>
          <div className="pt-market-columns"><span>Symbol</span><span>24h</span><span>Bid</span><span>Ask</span></div>
          <div className="pt-market-list">{instruments.filter(i => `${i.symbol} ${i.name}`.toLowerCase().includes(search.toLowerCase())).map(item => {
            const q = market.quotes[item.symbol];
            const positive = q && Number(q.changePercent) >= 0;
            return <button key={item.symbol} aria-pressed={symbol === item.symbol} className={`pt-market ${symbol === item.symbol ? "pt-selected" : ""}`} onClick={() => changeContext(item.symbol)}><span className="pt-market-symbol"><span className={`pt-asset pt-asset-${item.symbol.split("-")[0].toLowerCase()}`}>{item.symbol.slice(0, 1)}</span><span><strong>{item.symbol.split("-")[0]}</strong><small>{item.name}</small></span></span><span className={`pt-market-change ${positive ? "pt-positive" : "pt-negative"}`}>{q ? <>{positive ? <ArrowUp size={13} /> : <ArrowDown size={13} />}{Math.abs(Number(q.changePercent)).toFixed(2)}%</> : "--"}</span><span className="pt-quote-number">{price(q?.bid)}</span><span className="pt-quote-number">{price(q?.ask)}</span></button>;
          })}</div>
          {!instruments.some(i => `${i.symbol} ${i.name}`.toLowerCase().includes(search.toLowerCase())) && <p className="pt-empty">No supported instruments match your search.</p>}
          <div className="pt-market-coverage"><CandlestickChart size={22} /><strong>Live crypto markets</strong><p>Bitcoin, Ethereum, and Solana in USD.</p><p>Gold, forex, and indices are not connected to this market feed.</p></div>
        </>}
        <div className="pt-feed-status"><Wifi size={15} /><span>{market.connection}<small>Coinbase Exchange</small></span><button aria-label="Reconnect market feed" title="Reconnect market feed" onClick={() => setRefreshKey(v => v + 1)}>Retry</button></div>
        {market.error && <p className="pt-error" role="alert">{market.error}</p>}
      </aside>
      <section className="pt-panel pt-chart-panel">
        <div className="pt-chart-topbar"><span><CandlestickChart size={17} /> Candlesticks</span><div className="pt-timeframes" aria-label="Candle timeframe">{Object.keys(timeframes).map(tf => <button key={tf} aria-pressed={tf === timeframe} onClick={() => changeContext(symbol, tf as Timeframe)}>{tf}</button>)}</div><button className="pt-history-button" disabled={!candles.length || candles.length >= 3000 || historyLoading} onClick={() => void olderCandles()}>{historyLoading ? "Loading..." : "Earlier candles"}</button></div>
        <div className="pt-symbol-heading"><div><h1>{instrument.name} vs US Dollar <span>{timeframe}</span></h1><span className="pt-symbol-price">{price(quote?.price)} <small>USD</small><span className={quote && Number(quote.changePercent) < 0 ? "pt-negative" : "pt-positive"}>{quote ? `${Number(quote.changePercent) >= 0 ? "+" : ""}${quote.changePercent}%` : "Connecting..."}</span></span></div><span className={`pt-live-badge ${quote?.delivery === "WebSocket ticker" ? "is-live" : ""}`}><i />{quote?.delivery === "WebSocket ticker" ? "LIVE" : quote ? "REST" : "OFFLINE"}</span></div>
        {candleLoading && <p className="pt-chart-notice" role="status">Loading market candles...</p>}{candleError && <p role="alert" className="pt-error">{candleError} Existing candles may be stale.</p>}
        <PracticeChart key={`${symbol}:${timeframe}`} candles={candles} symbol={symbol} timeframe={timeframe} light={light} referenceQuote={quote} onDirtyChange={setChartDirty} />
      </section>
      <aside className="pt-panel pt-order">
        <div className="pt-panel-heading"><h2><span className={`pt-asset pt-asset-${symbol.split("-")[0].toLowerCase()}`}>{symbol.slice(0, 1)}</span>{displaySymbol(symbol)}</h2><span className="pt-badge">DEMO</span></div>
        <div className="pt-form-title">Regular form <ChevronDown size={18} /></div>
        <form onSubmit={event => void orderPreview(event)}><fieldset disabled={busy}>
          <div className="pt-side-tabs">{(["SELL", "BUY"] as const).map(value => <button type="button" className={`pt-quote-${value.toLowerCase()}`} key={value} aria-pressed={side === value} onClick={() => setSide(value)}><span>{value === "SELL" ? "Sell" : "Buy"}</span><strong>{price(value === "SELL" ? quote?.bid : quote?.ask)}</strong></button>)}</div>
          <div className="pt-spread">Spread <span>{quote ? `${(Number(quote.ask) - Number(quote.bid)).toFixed(4)} USD` : "--"}</span></div>
          <div className="pt-order-mode" aria-label="Order execution"><button type="button" aria-pressed={type === "MARKET"} onClick={() => { setType("MARKET"); setPreview(null); }}>Market</button><button type="button" aria-pressed={type !== "MARKET"} onClick={() => { setType("LIMIT"); setPreview(null); }}>Pending</button></div>
          {type !== "MARKET" && <label>Pending order type<select value={type} onChange={e => setType(e.target.value as OrderInput["type"])}><option value="LIMIT">Limit</option><option value="STOP_MARKET">Stop market</option><option value="STOP_LIMIT">Stop limit</option></select></label>}
          <label>Volume <span className="pt-label-unit">{symbol.split("-")[0]} units</span><div className="pt-stepper"><input type="number" required min="0.00000001" max="1000000" step="0.00000001" value={quantity} onChange={e => setQuantity(e.target.value)} /><button type="button" aria-label="Decrease volume" onClick={() => setQuantity(Math.max(0.00000001, Number(quantity || 0) - .01).toFixed(8))}>-</button><button type="button" aria-label="Increase volume" onClick={() => setQuantity(Math.min(1000000, Number(quantity || 0) + .01).toFixed(8))}>+</button></div></label>
          {["LIMIT", "STOP_LIMIT"].includes(type) && <label>Limit price (USD)<input type="number" required min="0.0001" step="0.0001" value={limit} onChange={e => setLimit(e.target.value)} /></label>}
          {["STOP_MARKET", "STOP_LIMIT"].includes(type) && <label>Stop price (USD)<input type="number" required min="0.0001" step="0.0001" value={stop} onChange={e => setStop(e.target.value)} /></label>}
          {side === "BUY" && <><label>Take Profit <CircleHelp size={13} /><input type="number" min="0.0001" step="0.0001" placeholder="Not set" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} /></label><label>Stop Loss <CircleHelp size={13} /><input type="number" min="0.0001" step="0.0001" placeholder="Not set" value={stopLoss} onChange={e => setStopLoss(e.target.value)} /></label></>}
          <div className="pt-order-estimate"><span>Estimated value</span><strong>{quote && Number(quantity) > 0 ? usd(Number(quantity) * Number(side === "BUY" ? quote.ask : quote.bid)) : "--"}</strong><span>Available virtual USD</span><strong>{usd(m?.buyingPower)}</strong></div>
          <button className={`pt-submit-order ${side.toLowerCase()}`} type="submit" disabled={!ready || busy}>{busy ? "Preparing..." : `Review ${side === "BUY" ? "buy" : "sell"} order`}</button>
        </fieldset></form>
        {orderError && <div className="pt-error" role="alert">{orderError}</div>}
        {accountError && <div className="pt-error" role="alert">{accountError}<button onClick={() => setRefreshKey(v => v + 1)}>Retry account</button></div>}
        {resetOpen && <form className="pt-reset" onSubmit={reset}><label>Starting virtual USD<input type="number" required min="100" max="1000000000" step="0.0001" value={resetBalance} onChange={e => setResetBalance(e.target.value)} /></label><button disabled={busy}>Confirm reset...</button><button type="button" onClick={() => setResetOpen(false)}>Keep account</button></form>}
        <p className="pt-execution-note">Virtual funds only. Spot trading: buy or sell holdings. Protective orders are checked every 10 seconds while this terminal is open. Fees and price are reviewed before confirmation.</p>
      </aside>
    <section className="pt-panel pt-portfolio"><div className="pt-tabs" role="tablist" aria-label="Practice account tables">{[["positions", "Open"], ["pending", `Pending (${pending.length})`], ["trades", "Closed"], ["orders", "Order history"]].map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} aria-controls="practice-table" onClick={() => { setTab(value); setPortfolioExpanded(true); }}>{label}</button>)}<button className="pt-portfolio-toggle" aria-label={portfolioExpanded ? "Collapse positions panel" : "Expand positions panel"} aria-expanded={portfolioExpanded} onClick={() => setPortfolioExpanded(!portfolioExpanded)}>{portfolioExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button></div>
      <div className="pt-table-controls"><label>Filter symbol<input value={filter} onChange={e => setFilter(e.target.value)} placeholder="All symbols" /></label><button onClick={() => setOldest(!oldest)}>{oldest ? "Oldest first" : "Newest first"}</button><span>Wins {m?.wins ?? 0}  /  Losses {m?.losses ?? 0}  /  Closed sales {m?.closed ?? 0}  /  Win rate {m?.winRate ?? "--"}%  /  Fees {usd(m?.fees)}</span></div>
      <div className="pt-table-scroll" id="practice-table" role="tabpanel">
        {tab === "positions" ? <table><caption>Open practice positions</caption><thead><tr>{["Symbol", "Quantity", "Average entry", "Current bid", "Market value", "Unrealized P/L", "Return", "SL / TP", "Action"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{filtered(snapshot?.positions ?? []).map(p => <tr key={p.id}><th>{p.symbol}</th><td>{p.quantity}</td><td>{usd(p.entryPrice)}</td><td>{usd(p.currentPrice)}</td><td>{usd(p.marketValue)}</td><td className={Number(p.unrealizedPnl) < 0 ? "pt-negative" : "pt-positive"}>{usd(p.unrealizedPnl)}</td><td>{p.returnPercent == null ? "--" : `${p.returnPercent}%`}</td><td>{usd(p.stopLossPrice)} / {usd(p.takeProfitPrice)}</td><td><button disabled={busy || !p.currentPrice} onClick={() => void orderPreview(undefined, p)}>Review close</button></td></tr>)}</tbody></table> : tab === "trades" ? <table><caption>Recent practice fills  /  sales include allocated entry fees in realized P/L</caption><thead><tr>{["Time", "Symbol", "Side", "Quantity", "Entry", "Fill / exit", "Fee", "Realized P/L", "Order type", "Status"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{filtered(snapshot?.trades ?? []).map(t => <tr key={t.id}><td>{date(t.executedAt)}</td><th>{t.symbol}</th><td>{t.side}</td><td>{t.quantity}</td><td>{usd(t.entryPrice)}</td><td>{usd(t.price)}</td><td>{usd(t.fee)}</td><td>{t.side === "SELL" ? usd(t.realizedPnl) : "--"}</td><td>{t.order.type}</td><td>{t.order.status}</td></tr>)}</tbody></table> : <table><caption>{tab === "pending" ? "Pending practice orders" : "Recent practice orders"}</caption><thead><tr>{["Created", "Symbol", "Side", "Type", "Quantity", "Limit / stop", "Filled price", "Status", "Filled time / reason", "Action"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{filtered(tab === "pending" ? pending : snapshot?.orders ?? []).map(o => <tr key={o.id}><td>{date(o.createdAt)}</td><th>{o.symbol}</th><td>{o.side}</td><td>{o.type}</td><td>{o.quantity}</td><td>{o.limitPrice ?? "--"} / {o.stopPrice ?? "--"}</td><td>{usd(o.filledPrice)}</td><td>{o.status}</td><td>{o.filledAt ? date(o.filledAt) : o.rejectionReason ?? "--"}</td><td>{["PENDING", "OPEN"].includes(o.status) && <button disabled={busy} onClick={() => void cancel(o.id)}>Cancel</button>}</td></tr>)}</tbody></table>}
        {((tab === "positions" ? snapshot?.positions : tab === "trades" ? snapshot?.trades : tab === "pending" ? pending : snapshot?.orders) ?? []).filter(row => row.symbol.toLowerCase().includes(filter.toLowerCase())).length === 0 && <p className="pt-empty">{snapshot ? "No matching records yet." : "Loading practice account..."}</p>}
      </div><p className="pt-muted">{snapshot?.conditionalExecution} Win/loss statistics count sell fills, including partial closes.</p>
    </section>
    </div>
    <footer className="pt-account-bar"><span>Equity: <strong>{usd(m?.equity)}</strong></span><span>Available: <strong>{usd(m?.buyingPower)}</strong></span><span>Balance: <strong>{usd(snapshot?.account.cashBalance)}</strong></span><span>Reserved: <strong>{usd(snapshot?.account.reservedMargin)}</strong></span><span>Unrealized P/L: <strong className={Number(m?.unrealized) < 0 ? "pt-negative" : "pt-positive"}>{usd(m?.unrealized)}</strong></span><span className="pt-account-bar-mode"><i />Practice account</span></footer>
    {notice && <div className="pt-notice" role="status"><Bell size={17} /><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}>x</button></div>}
    <dialog ref={previewDialog} className="pt-confirmation" onCancel={event => { if (busy) event.preventDefault(); else setPreview(null); }}>
      {preview && <><h2>Confirm practice order</h2><span className="pt-badge">PAPER TRADING  /  VIRTUAL FUNDS</span><dl>{[
        ["Side / symbol", `${preview.order.side} ${preview.order.symbol}`], ["Quantity / type", `${preview.order.quantity}  /  ${preview.order.type}`], ["Estimated price", usd(preview.estimatedPrice)], ["Estimated value", usd(preview.estimatedValue)], ["Estimated fee", usd(preview.estimatedFee)],
        ["Limit / stop", `${preview.order.limitPrice ?? "--"} / ${preview.order.stopPrice ?? "--"}`], ["Estimated sale P/L", preview.estimatedPnl == null ? "Not applicable" : usd(preview.estimatedPnl)], ["Stop loss / take profit", `${preview.order.stopLossPrice ?? "--"} / ${preview.order.takeProfitPrice ?? "--"}`], ["Potential loss / profit*", `${usd(preview.loss)} / ${usd(preview.profit)}`], ["Risk / reward*", preview.ratio ? `1 : ${preview.ratio}` : "Not set"], ["Quote time", date(preview.quoteTime)], ["Confirmation expires", date(preview.expiresAt)],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>{preview.note}</p><p>*Educational estimates exclude fees, spread, gaps, and slippage. Stops do not guarantee a loss limit.</p>{orderError && <p role="alert" className="pt-error">{orderError}</p>}<div className="pt-confirm-actions"><button disabled={busy} onClick={() => setPreview(null)}>Back</button><button className="pt-primary" disabled={busy} onClick={() => void confirmOrder()}>{busy ? "Submitting..." : "Place Practice Order"}</button></div></>}
    </dialog>
  </div>;
}
