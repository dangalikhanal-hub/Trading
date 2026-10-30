"use client";

import { useEffect, useRef, useState } from "react";
import { instruments, quoteIsFresh, type Quote } from "@/lib/market/types";
import { parseTicker } from "@/lib/market/ticker";

export function useMarketTicker(retry: number) {
  const references = useRef<Record<string, Quote>>({});
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [connection, setConnection] = useState("Connecting");
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch("/api/market?action=quotes", { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Market feed unavailable.");
        if (controller.signal.aborted) return;
        references.current = result.quotes;
        setQuotes(previous => {
          const next = { ...previous };
          for (const item of instruments) {
            const rest = result.quotes[item.symbol] as Quote | undefined;
            const live = previous[item.symbol];
            // Keep a fresher stream price; REST remains the source of product status.
            if (rest && (!live || !quoteIsFresh(live) || Date.parse(rest.time) >= Date.parse(live.time) || rest.status !== "online")) next[item.symbol] = rest;
          }
          return next;
        });
        setError(Object.keys(result.quotes).length ? "" : "The market provider is temporarily unavailable. Reconnecting automatically.");
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Market feed unavailable.");
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, 10_000);
      }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [retry]);

  useEffect(() => {
    let stopped = false, socket: WebSocket | null = null, retries = 0;
    let reconnect: ReturnType<typeof setTimeout>, flush: ReturnType<typeof setTimeout> | undefined;
    const pending: Record<string, Quote> = {};
    const times: Record<string, number> = {};
    function connect() {
      if (stopped) return;
      try { socket = new WebSocket("wss://ws-feed.exchange.coinbase.com"); }
      catch { setConnection("REST fallback"); reconnect = setTimeout(connect, 10_000); return; }
      socket.onopen = () => {
        if (stopped) return;
        retries = 0;
        socket?.send(JSON.stringify({ type: "subscribe", product_ids: instruments.map(i => i.symbol), channels: ["ticker"] }));
        setConnection("Stream connected");
      };
      socket.onmessage = event => {
        if (stopped) return;
        try {
          const raw = JSON.parse(event.data);
          if (!instruments.some(i => i.symbol === raw.product_id)) return;
          const next = parseTicker(raw, raw.product_id, references.current[raw.product_id]);
          if (!next || Date.parse(next.time) < (times[next.symbol] || 0)) return;
          times[next.symbol] = Date.parse(next.time);
          pending[next.symbol] = next;
          if (!flush) flush = setTimeout(() => {
            if (!stopped) {
              const updates = { ...pending };
              setQuotes(previous => {
                const next = { ...previous };
                for (const [symbol, quote] of Object.entries(updates)) {
                  if (!previous[symbol] || Date.parse(quote.time) >= Date.parse(previous[symbol].time)) next[symbol] = quote;
                }
                return next;
              });
            }
            flush = undefined;
          }, 250);
        } catch { /* Ignore malformed public messages and retain the REST fallback. */ }
      };
      socket.onerror = () => { if (!stopped) { setConnection("REST fallback"); socket?.close(); } };
      socket.onclose = () => {
        if (stopped) return;
        setConnection("REST fallback");
        reconnect = setTimeout(connect, Math.min(30_000, 1000 * 2 ** Math.min(retries++, 5)));
      };
    }
    connect();
    const freshness = setInterval(() => setNow(Date.now()), 1000);
    return () => { stopped = true; clearTimeout(reconnect); clearTimeout(flush); clearInterval(freshness); if (socket) { socket.onclose = null; socket.close(); } };
  }, [retry]);

  const fresh: Record<string, Quote> = {};
  for (const [symbol, quote] of Object.entries(quotes)) if (quoteIsFresh(quote, now || undefined)) fresh[symbol] = quote;
  const streaming = Object.values(fresh).some(q => q.delivery === "WebSocket ticker");
  return { quotes: fresh, connection: streaming ? "Live market" : connection === "Connecting" ? connection : "REST fallback", error };
}
