import { Prisma } from "@prisma/client";
import { type Candle, type MarketDataProvider, type Quote, type Timeframe, timeframes, validSymbol } from "./types";

// Read-only public market routes. This module has no authenticated exchange client.
const base = "https://api.exchange.coinbase.com";
const cache = new Map<string, { expires: number; data: Promise<unknown> }>();
async function read(path: string, ttl = 3000): Promise<unknown> {
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.data;
  const data = (async () => {
    const response = await fetch(`${base}${path}`, { cache: "no-store", signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Market data is unavailable from Coinbase. Try again shortly.");
    return response.json();
  })();
  cache.set(path, { expires: Date.now() + ttl, data });
  // Bound historical-page cache and remove failures; never serve an expired quote.
  if (cache.size > 100) cache.delete(cache.keys().next().value!);
  try { return await data; } catch { cache.delete(path); throw new Error("Unable to reach Coinbase market data. Check provider connectivity and retry."); }
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid market-data response.");
  return value as Record<string, unknown>;
}
function decimal(value: unknown, allowZero = false) {
  if (typeof value !== "string" || !/^\d+(\.\d+)?$/.test(value)) throw new Error("Invalid market price.");
  const number = new Prisma.Decimal(value);
  if (!number.isFinite() || (allowZero ? number.lt(0) : number.lte(0))) throw new Error("Invalid market price.");
  return number;
}
export const marketProvider: MarketDataProvider = {
  async quote(symbol): Promise<Quote> {
    if (!validSymbol(symbol)) throw new Error("Unsupported symbol. Choose BTC-USD, ETH-USD, or SOL-USD.");
    const [tickerRaw, statsRaw, productRaw] = await Promise.all([
      read(`/products/${symbol}/ticker`), read(`/products/${symbol}/stats`, 30_000), read(`/products/${symbol}`, 60_000),
    ]);
    const ticker = record(tickerRaw), stats = record(statsRaw), product = record(productRaw);
    const price = decimal(ticker.price), bid = decimal(ticker.bid), ask = decimal(ticker.ask), open = decimal(stats.open);
    if (bid.gt(ask) || typeof ticker.time !== "string" || !Number.isFinite(Date.parse(ticker.time))) throw new Error("Invalid market quote.");
    return { symbol, price: price.toFixed(4), bid: bid.toFixed(4), ask: ask.toFixed(4), volume: decimal(ticker.volume, true).toString(),
      change: price.minus(open).toFixed(4), changePercent: price.minus(open).div(open).mul(100).toFixed(2),
      time: ticker.time, fetchedAt: new Date().toISOString(), source: "Coinbase Exchange", delivery: "REST polling",
      status: product.status === "online" && !product.trading_disabled && !product.cancel_only && !product.post_only && !product.limit_only ? "online" : "unavailable" };
  },
  async candles(symbol: string, timeframe: Timeframe, end?: number): Promise<Candle[]> {
    if (!validSymbol(symbol)) throw new Error("Unsupported symbol.");
    const seconds = timeframes[timeframe];
    const finish = end ?? Math.floor(Date.now() / 1000);
    const params = new URLSearchParams({ granularity: String(seconds), start: new Date((finish - seconds * 299) * 1000).toISOString(), end: new Date(finish * 1000).toISOString() });
    const data = await read(`/products/${symbol}/candles?${params}`, 10_000);
    if (!Array.isArray(data)) throw new Error("Invalid candle response.");
    const candles = new Map<number, Candle>();
    for (const row of data) {
      if (!Array.isArray(row) || row.length < 6 || !row.slice(0, 6).every(value => typeof value === "number" && Number.isFinite(value))) throw new Error("Invalid candle data.");
      const [time, low, high, open, close, volume] = row as number[];
      if (!Number.isInteger(time) || time > finish || low <= 0 || high < Math.max(open, close, low) || low > Math.min(open, close) || volume < 0) throw new Error("Invalid OHLCV values.");
      candles.set(time, { time, open, high, low, close, volume });
    }
    return [...candles.values()].sort((a, b) => a.time - b.time);
  },
};
