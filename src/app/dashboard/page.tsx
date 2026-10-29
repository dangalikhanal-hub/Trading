"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ArrowDownLeft, ArrowUpRight, Activity, ArrowRight, ChevronDown, CircleHelp, Eye, Layers3, Pause, Play, Search, ShieldCheck, Sparkles, Wallet, Waves } from "lucide-react";
import Sidebar from "@/components/dashboard/Sidebar";
import MarketChart from "@/components/dashboard/MarketChart";
import ResetWalletButton from "@/components/dashboard/ResetWalletButton";
import SavedWatchlists from "@/components/dashboard/SavedWatchlists";

interface UserWallet { id: string; currency: string; balance: string }
const markets = [
  { symbol: "BTC", name: "Bitcoin", price: 68432.80, change: 2.84, color: "#f5ae56", points: [20,26,22,34,28,40,37,51,44,58,53,68] },
  { symbol: "ETH", name: "Ethereum", price: 3521.42, change: 1.62, color: "#a9a3ff", points: [30,24,31,28,40,36,39,48,42,55,49,61] },
  { symbol: "SOL", name: "Solana", price: 172.68, change: -0.92, color: "#77dfc5", points: [60,55,61,50,57,43,47,38,44,35,39,30] },
  { symbol: "NEPSE", name: "Nepal Stock Exchange", price: 2684.72, change: 0.76, color: "#6cafff", points: [20,24,19,30,27,35,32,39,36,45,42,49] },
];
const money = (value: number, decimals = 2) => value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

function AnimatedNumber({ value, paused }: { value: number; paused: boolean }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (paused) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame: number;
    const start = performance.now();
    function tick(now: number) {
      const progress = reducedMotion ? 1 : Math.min((now - start) / 1000, 1);
      setDisplay(value * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, paused]);
  return <>{money(paused ? value : display)}</>;
}

async function fetchWallets(): Promise<UserWallet[]> {
  const response = await fetch("/api/wallet", { cache: "no-store" });
  if (!response.ok) throw new Error("Your wallets couldn’t be loaded. Please try again.");
  return response.json();
}

export default function DashboardPage() {
  const [wallets, setWallets] = useState<UserWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(0);
  const [range, setRange] = useState("1D");
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("0.01");
  const [preview, setPreview] = useState("");
  const market = markets[selected];
  const amount = Number(quantity);

  useEffect(() => {
    let active = true;
    fetchWallets().then(data => { if (active) setWallets(data); })
      .catch(cause => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function refreshWallets() {
    try { setWallets(await fetchWallets()); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load wallets."); throw cause; }
  }

  return (
    <div className={`tv-workspace ${paused ? "tv-paused" : ""}`}>
      <Sidebar />
      <div className="tv-content" id="overview">
        <div className="tv-page-heading tv-enter">
          <div><div className="tv-eyebrow"><span className="tv-dot" /> YOUR TRADING WORKSPACE</div><h1>A clearer view. <span>A smarter move.</span></h1><p>Your markets, your practice, your pace.</p></div>
          <button className="tv-button tv-quiet" onClick={() => setPaused(!paused)} aria-pressed={paused}>{paused ? <Play size={15} /> : <Pause size={15} />}{paused ? "Resume motion" : "Pause motion"}</button>
        </div>

        <div className="tv-notice tv-enter"><ShieldCheck size={17} /><span><strong>Room to learn. Space to grow.</strong> Paper trading workspace. Market charts and prices below are illustrative demo data.</span><span className="tv-notice-tag">SIMULATION</span></div>
        {error && <div className="tv-error" role="alert">{error}<button onClick={() => void refreshWallets().catch(() => {})}>Retry</button></div>}

        <section className="tv-stats" id="wallets" aria-label="Wallet overview">
          {(["NPR", "USDT"] as const).map((currency, index) => {
            const balance = wallets.find(wallet => wallet.currency === currency)?.balance;
            return <article className={`tv-card tv-stat tv-enter ${index === 0 ? "tv-stat-featured" : ""}`} style={{ "--delay": `${index * 80}ms` } as CSSProperties} key={currency}>
              <div className="tv-stat-top"><span>{currency === "NPR" ? "Nepal rupee wallet" : "USDT wallet"}</span><span className="tv-icon-box"><Wallet size={17} /></span></div>
              <div className={`tv-balance ${loading ? "tv-skeleton" : ""}`}>{loading ? "Loading" : balance !== undefined ? <AnimatedNumber value={Number(balance)} paused={paused} /> : "—"}<small>{currency}</small></div>
              <div className="tv-stat-foot"><span className="tv-dot" /> Available demo balance</div>
            </article>;
          })}
          <article className="tv-card tv-stat tv-enter" style={{ "--delay": "160ms" } as CSSProperties}><div className="tv-stat-top"><span>Bitcoin · demo snapshot</span><span className="tv-icon-box"><Activity size={17} /></span></div><div className="tv-balance">+2.84<small>%</small></div><div className="tv-stat-foot tv-positive"><ArrowUpRight size={14} /> Illustrative 24h move</div></article>
          <article className="tv-card tv-stat tv-enter" style={{ "--delay": "240ms" } as CSSProperties}><div className="tv-stat-top"><span>Your environment</span><span className="tv-icon-box"><Layers3 size={17} /></span></div><div className="tv-mode">Paper trading <span className="tv-orbit"><span /></span></div><div className="tv-stat-foot">Virtual funds. Real learning.</div></article>
        </section>

        <div className="tv-main-grid">
          <section className="tv-card tv-chart-panel tv-enter" id="markets" style={{ "--delay": "200ms" } as CSSProperties}>
            <div className="tv-panel-heading"><div><div className="tv-eyebrow">MARKET OVERVIEW</div><div className="tv-market-title"><span className="tv-coin" style={{ color: market.color, background: `${market.color}18` }}>{market.symbol === "BTC" ? "₿" : market.symbol.slice(0,1)}</span><h2>{market.name}<small>{market.symbol}{market.symbol === "NEPSE" ? " index" : " / USDT"}</small></h2><ChevronDown size={14} className="tv-muted" /></div></div><span className="tv-chip"><span className="tv-dot" /> Demo chart</span></div>
            <div className="tv-chart-toolbar"><div className="tv-chart-price" key={market.symbol}>{market.symbol === "NEPSE" ? "" : "$"}{money(market.price)}<span className={market.change >= 0 ? "tv-positive" : "tv-negative"}>{market.change >= 0 ? "+" : ""}{market.change}% <small>24h demo</small></span></div><div className="tv-segment" aria-label="Chart timeframe">{["1H", "4H", "1D", "1W", "1M"].map(item => <button key={item} aria-pressed={range === item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item}</button>)}</div></div>
            <MarketChart symbol={market.symbol} price={market.price} range={range} paused={paused} />
            <div className="tv-chart-footer"><span><Waves size={14} /> Illustrative price history</span><span>Hover or focus chart to explore <ArrowUpRight size={13} /></span></div>
          </section>

          <section className="tv-card tv-watchlist tv-enter" style={{ "--delay": "280ms" } as CSSProperties}>
            <div className="tv-panel-heading"><h2>Watchlist <span className="tv-count">04</span></h2><Eye size={17} className="tv-muted" /></div>
            <label className="tv-search"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a market" aria-label="Search markets" /><kbd>/</kbd></label>
            <div className="tv-list-heading"><span>Asset</span><span>Demo price / 24h</span></div>
            <div className="tv-market-list">{markets.filter(item => `${item.name} ${item.symbol}`.toLowerCase().includes(search.toLowerCase())).map(item => <button key={item.symbol} className={`tv-market-row ${item.symbol === market.symbol ? "selected" : ""}`} onClick={() => { setSelected(markets.indexOf(item)); setPreview(""); }} aria-pressed={item.symbol === market.symbol}>
              <span className="tv-coin tv-coin-small" style={{ color: item.color, background: `${item.color}18` }}>{item.symbol === "BTC" ? "₿" : item.symbol.slice(0,1)}</span><span className="tv-asset-name"><strong>{item.symbol}</strong><small>{item.name}</small></span>
              <svg viewBox="0 0 72 40" className="tv-sparkline" aria-hidden="true"><polyline points={item.points.map((point,i) => `${i * 6.5},${40 - point * .5}`).join(" ")} fill="none" stroke={item.change >= 0 ? "#80e1bb" : "#ef8a9a"} strokeWidth="1.6" /></svg>
              <span className="tv-asset-price"><strong>{money(item.price)}</strong><small className={item.change >= 0 ? "tv-positive" : "tv-negative"}>{item.change > 0 ? "+" : ""}{item.change}%</small></span>
            </button>)}</div>
            {!markets.some(item => `${item.name} ${item.symbol}`.toLowerCase().includes(search.toLowerCase())) && <p className="tv-empty">No matching markets.</p>}
            <div className="tv-watchlist-note"><span className="tv-dot" /> Sample market data · no live feed</div>
          </section>

          <section className="tv-card tv-practice tv-enter" id="practice" style={{ "--delay": "320ms" } as CSSProperties}>
            <div className="tv-panel-heading"><h2>Explore a trade</h2><span className="tv-chip">PREVIEW</span></div>
            <div className="tv-order-tabs">{(["buy", "sell"] as const).map(item => <button key={item} aria-pressed={side === item} className={side === item ? `active ${item}` : ""} onClick={() => { setSide(item); setPreview(""); }}>{item === "buy" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}{item === "buy" ? "Buy" : "Sell"}</button>)}</div>
            <form onSubmit={event => { event.preventDefault(); setPreview(`${side === "buy" ? "Buy" : "Sell"} ${quantity} ${market.symbol} ≈ ${money(amount * market.price)} ${market.symbol === "NEPSE" ? "NPR" : "USDT"}. Preview only; no order was submitted.`); }}>
              <label className="tv-order-label" htmlFor="quantity">Quantity <span>{market.symbol}</span></label><div className="tv-quantity"><input id="quantity" type="number" min="0.000001" step="any" max="1000000000" required value={quantity} onChange={event => { setQuantity(event.target.value); setPreview(""); }} /><span>{market.symbol}</span></div>
              <div className="tv-estimate"><span>Estimated value</span><strong>{Number.isFinite(amount) && amount > 0 ? money(amount * market.price) : "0.00"} {market.symbol === "NEPSE" ? "NPR" : "USDT"}</strong></div>
              <button className="tv-button tv-primary" type="submit">Preview {side} <ArrowRight size={16} /></button>
            </form>
            {preview && <p className="tv-preview-result" role="status">{preview}</p>}
            <p className="tv-fine-print"><CircleHelp size={13} /> Explore calculations with demo prices. No trades are executed.</p>
          </section>

          <section className="tv-card tv-learning tv-enter" id="activity" style={{ "--delay": "400ms" } as CSSProperties}>
            <div className="tv-panel-heading"><h2>Build your edge</h2><Sparkles size={17} className="tv-lilac" /></div>
            <div className="tv-learning-body"><span className="tv-learning-art"><Layers3 size={38} strokeWidth={1} /><span className="tv-art-ring" /></span><div><span className="tv-eyebrow">SMALL STEPS. BETTER DECISIONS.</span><h3>Confidence starts with practice.</h3><p>Explore a market, compare timeframes, and preview a position before your next move.</p><a href="#practice" className="tv-text-link">Explore the workspace <ArrowUpRight size={15} /></a></div></div>
            <div className="tv-wallet-actions"><div><ShieldCheck size={16} /><span>Want a fresh start?<small>Restore your demo wallet balances.</small></span></div><ResetWalletButton onReset={refreshWallets} /></div>
          </section>
        </div>
        <SavedWatchlists onOpenDemo={symbol => {
          const index = markets.findIndex(item => item.symbol === symbol);
          if (index >= 0) { setSelected(index); setPreview(""); document.getElementById("markets")?.scrollIntoView({ behavior: "smooth" }); }
        }} />
        <footer className="tv-footer"><span>TradeVision Pro <span>·</span> Built for your learning curve.</span><span><ShieldCheck size={13} /> Paper trading only</span></footer>
      </div>
    </div>
  );
}
