"use client";

import { useEffect, useState } from "react";
import type { WatchlistAction } from "@/lib/watchlists";
import { quoteIsFresh, type Quote } from "@/lib/market/types";

interface SavedList { id: string; name: string; items: { symbol: string; assetType: string }[] }

async function readLists(): Promise<SavedList[]> {
  const response = await fetch("/api/watchlists", { cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 401 ? "Sign in again to access your watchlists." : "Unable to load saved watchlists. Please retry.");
  return (await response.json()).watchlists;
}

export default function SavedWatchlists({ onOpenDemo, quotes, onOpenLive }: { onOpenDemo: (symbol: string) => void; quotes?: Record<string, Quote>; onOpenLive?: (symbol: string) => void }) {
  const [lists, setLists] = useState<SavedList[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [assetType, setAssetType] = useState("CRYPTO");
  const [search, setSearch] = useState("");
  const selected = lists.find(list => list.id === selectedId) ?? lists[0];

  useEffect(() => {
    let active = true;
    readLists().then(data => { if (active) setLists(data); })
      .catch(cause => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function refresh() {
    setBusy(true);
    setError("");
    try { setLists(await readLists()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load watchlists."); }
    finally { setBusy(false); }
  }

  async function change(action: WatchlistAction) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/watchlists", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save watchlist.");
      setNotice("Saved. Refreshing watchlists...");
      setLists(await readLists());
      if (action.action === "create") { setSelectedId(result.id); setName(""); setSearch(""); }
      if (action.action === "add") setSymbol("");
      setNotice("Watchlist updated.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save watchlist."); }
    finally { setBusy(false); }
  }

  const visible = selected?.items.filter(item => item.symbol.toLowerCase().includes(search.toLowerCase())) ?? [];
  return <section className="tv-card tv-saved-watchlists" id="saved-watchlists" aria-labelledby="saved-watchlists-heading" aria-busy={busy || loading}>
    <div className="tv-panel-heading"><h2 id="saved-watchlists-heading">Saved watchlists</h2><span className="tv-chip">PAPER TRADING</span></div>
    <p className="tv-fine-print">{onOpenLive ? "Saved to your account. Coinbase USD quotes refresh every 10s for BTC, ETH, and SOL. Unsupported symbols show no quote." : "Saved to your account. Open the practice terminal for supported live market quotes."}</p>
    {loading && <p role="status">Loading saved watchlists...</p>}
    {error && <div className="tv-error" role="alert">{error}<button disabled={busy} onClick={() => void refresh()}>Retry load</button></div>}
    <p role="status" className="tv-fine-print">{notice}</p>
    <fieldset disabled={loading || busy}>
      <div className="tv-saved-controls">
        <form onSubmit={event => { event.preventDefault(); void change({ action: "create", name }); }}>
          <label htmlFor="watchlist-name">New watchlist</label>
          <div className="tv-saved-input-row"><input id="watchlist-name" value={name} onChange={event => setName(event.target.value)} required maxLength={60} placeholder="e.g. Crypto research" /><button className="tv-button" disabled={!name.trim() || lists.length >= 20}>Create</button></div>
        </form>
        {selected && <div><label htmlFor="watchlist-select">Your watchlists</label><div className="tv-saved-input-row">
          <select id="watchlist-select" value={selected.id} onChange={event => { setSelectedId(event.target.value); setSearch(""); setNotice(""); }}>{lists.map(list => <option key={list.id} value={list.id}>{list.name} ({list.items.length})</option>)}</select>
          <button className="tv-button" onClick={() => { if (window.confirm(`Delete watchlist "${selected.name}" and all its symbols?`)) void change({ action: "delete", watchlistId: selected.id }); }}>Delete list</button>
        </div></div>}
      </div>
      {!loading && !selected && <p className="tv-empty">Create your first watchlist to save symbols.</p>}
      {selected && <>
        <form className="tv-saved-add" onSubmit={event => { event.preventDefault(); void change({ action: "add", watchlistId: selected.id, symbol, assetType }); }}>
          <div><label htmlFor="watchlist-symbol">Symbol</label><input id="watchlist-symbol" value={symbol} onChange={event => setSymbol(event.target.value)} required maxLength={32} placeholder="e.g. BTC/USDT or AAPL" /></div>
          <div><label htmlFor="watchlist-asset">Asset type</label><select id="watchlist-asset" value={assetType} onChange={event => setAssetType(event.target.value)}>{["CRYPTO", "EQUITY", "FOREX", "INDEX"].map(type => <option key={type}>{type}</option>)}</select></div>
          <button className="tv-button tv-primary" disabled={!symbol.trim() || selected.items.length >= 100}>Add symbol</button>
        </form>
        <label htmlFor="saved-symbol-search">Search saved symbols</label><input id="saved-symbol-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Filter this watchlist" />
        <div className="tv-saved-table"><table><caption>{selected.name}{onOpenLive ? " · REST-polled market data" : " · saved symbols"}</caption><thead><tr><th scope="col">Symbol</th><th scope="col">Asset type</th>{onOpenLive && <><th scope="col">Last USD</th><th scope="col">Change</th><th scope="col">Change %</th></>}<th scope="col">Actions</th></tr></thead><tbody>{visible.map(item => {
          const normalized = item.symbol.replace(/\//g, "-");
          const marketSymbol = ["BTC", "ETH", "SOL"].includes(normalized) ? `${normalized}-USD` : normalized;
          const quote = quotes?.[marketSymbol];
          const fresh = quote && quoteIsFresh(quote);
          return <tr key={item.symbol}><th scope="row">{item.symbol}</th><td>{item.assetType}</td>{onOpenLive && <><td>{fresh ? quote.price : "Unavailable"}</td><td>{fresh ? quote.change : "—"}</td><td>{fresh ? `${quote.changePercent}%` : "—"}</td></>}<td>
          {onOpenLive && ["BTC-USD", "ETH-USD", "SOL-USD"].includes(marketSymbol) && <button className="tv-button" onClick={() => onOpenLive(marketSymbol)}>Open practice chart</button>}
          {!onOpenLive && ["BTC", "ETH", "SOL", "NEPSE"].includes(item.symbol) && <button className="tv-button" onClick={() => onOpenDemo(item.symbol)}>Open illustrative chart</button>}
          <button className="tv-button" aria-label={`Remove ${item.symbol}`} onClick={() => void change({ action: "remove", watchlistId: selected.id, symbol: item.symbol })}>Remove</button>
        </td></tr>; })}</tbody></table></div>
        {visible.length === 0 && <p className="tv-empty">{selected.items.length ? "No matching saved symbols." : "This watchlist is empty. Add a symbol above."}</p>}
        <p className="tv-fine-print">Symbol storage does not verify provider coverage. Maximum 20 watchlists, 100 symbols per list.</p>
      </>}
    </fieldset>
  </section>;
}
