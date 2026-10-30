export const instruments = [
  { symbol: "BTC-USD", name: "Bitcoin", assetType: "CRYPTO" },
  { symbol: "ETH-USD", name: "Ethereum", assetType: "CRYPTO" },
  { symbol: "SOL-USD", name: "Solana", assetType: "CRYPTO" },
] as const;
export const timeframes = { "1m": 60, "5m": 300, "15m": 900, "1H": 3600, "6H": 21600, "1D": 86400 } as const;
export type Timeframe = keyof typeof timeframes;
export interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number }
export interface Quote {
  symbol: string; price: string; bid: string; ask: string; volume: string;
  change: string; changePercent: string; time: string; fetchedAt: string;
  source: string; delivery: "REST polling" | "WebSocket ticker"; status: "online" | "unavailable";
}
export interface MarketDataProvider {
  quote(symbol: string): Promise<Quote>;
  candles(symbol: string, timeframe: Timeframe, end?: number): Promise<Candle[]>;
}
export function validSymbol(symbol: string) { return instruments.some(item => item.symbol === symbol); }
export function validTimeframe(value: string): value is Timeframe { return Object.hasOwn(timeframes, value); }
export function quoteIsFresh(quote: Quote, now = Date.now()) {
  const age = now - Date.parse(quote.time);
  const fetchedAge = now - Date.parse(quote.fetchedAt);
  return quote.status === "online" && Number.isFinite(age) && age >= -5000 && age <= 30_000 && fetchedAge >= -5000 && fetchedAge <= 30_000;
}
