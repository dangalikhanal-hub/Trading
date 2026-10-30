import { quoteIsFresh, type Candle, type Quote } from "../market/types";

/** Display-only observed trades. REST candles reconcile OHLCV every 15 seconds. */
export function candleFromTrade(current: Candle | null, quote: Quote, interval: number): Candle | null {
  if (!quoteIsFresh(quote) || quote.delivery !== "WebSocket ticker" || interval <= 0) return null;
  const time = Math.floor(Date.parse(quote.time) / 1000 / interval) * interval;
  const price = Number(quote.price);
  if (!Number.isFinite(price) || price <= 0 || current && time < current.time) return null;
  if (!current || time > current.time) return { time, open: price, high: price, low: price, close: price, volume: 0 };
  return { ...current, high: Math.max(current.high, price), low: Math.min(current.low, price), close: price };
}
