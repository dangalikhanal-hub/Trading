"use client";
import { useEffect, useRef, useState } from "react";
import { parseTicker } from "@/lib/market/ticker";
import { quoteIsFresh, type Quote } from "@/lib/market/types";

export function useTicker(symbol: string, reference: Quote | undefined) {
  const fallback = useRef(reference);
  const [quote, setQuote] = useState<Quote | null>(null), [connection, setConnection] = useState("Connecting public ticker...");
  useEffect(() => { fallback.current = reference; }, [reference]);
  useEffect(() => {
    let stopped = false, socket: WebSocket | null = null, retries = 0, lastTime = 0;
    let reconnect: ReturnType<typeof setTimeout>, flush: ReturnType<typeof setTimeout> | undefined;
    let latest: Quote | null = null;
    function connect() {
      if (stopped) return;
      socket = new WebSocket("wss://ws-feed.exchange.coinbase.com");
      socket.onopen = () => { if (stopped) return; retries = 0; socket?.send(JSON.stringify({ type: "subscribe", product_ids: [symbol], channels: ["ticker"] })); setConnection("Public ticker connected"); };
      socket.onmessage = event => {
        if (stopped) return;
        try {
          const next = parseTicker(JSON.parse(event.data), symbol, fallback.current);
          if (!next || Date.parse(next.time) < lastTime) return;
          lastTime = Date.parse(next.time); latest = next;
          // Bound React work to four updates/second; latest actual tick wins.
          if (!flush) flush = setTimeout(() => { if (!stopped) setQuote(latest); flush = undefined; }, 250);
        } catch { /* Ignore malformed public messages; REST remains visible. */ }
      };
      socket.onerror = () => { if (!stopped) { setConnection("Ticker disconnected · using REST data when fresh"); socket?.close(); } };
      socket.onclose = () => {
        if (stopped) return;
        setConnection("Ticker disconnected · reconnecting; REST fallback");
        reconnect = setTimeout(connect, Math.min(30_000, 1000 * 2 ** Math.min(retries++, 5)));
      };
    }
    connect();
    const freshness = setInterval(() => setQuote(previous => previous && quoteIsFresh(previous) ? previous : null), 5000);
    return () => { stopped = true; clearTimeout(reconnect); clearTimeout(flush); clearInterval(freshness); if (socket) { socket.onclose = null; socket.close(); } };
  }, [symbol]);
  return { quote: quote && quoteIsFresh(quote) ? quote : reference && quoteIsFresh(reference) ? reference : null, connection };
}
