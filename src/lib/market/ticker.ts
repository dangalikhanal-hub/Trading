import type { Quote } from "./types";
/** Browser display only. Never accepts a quote for the execution service. */
export function parseTicker(raw: unknown, symbol: string, reference: Quote | undefined): Quote | null {
  if (!reference || !raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  if (v.type !== "ticker" || v.product_id !== symbol || typeof v.time !== "string") return null;
  const time = Date.parse(v.time), now = Date.now();
  if (!Number.isFinite(time) || time > now + 5000 || now - time > 30_000) return null;
  for (const key of ["price", "best_bid", "best_ask", "open_24h", "volume_24h"]) {
    if (typeof v[key] !== "string" || !/^\d+(\.\d+)?$/.test(v[key] as string) || !Number.isFinite(Number(v[key])) || Number(v[key]) < (key === "volume_24h" ? 0 : Number.MIN_VALUE)) return null;
  }
  if (Number(v.best_bid) > Number(v.best_ask)) return null;
  const change = Number(v.price) - Number(v.open_24h);
  return { ...reference, price: String(v.price), bid: String(v.best_bid), ask: String(v.best_ask), volume: String(v.volume_24h), time: v.time,
    fetchedAt: new Date().toISOString(), change: change.toFixed(4), changePercent: (change / Number(v.open_24h) * 100).toFixed(2), delivery: "WebSocket ticker" };
}
