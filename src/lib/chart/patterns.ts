import type { Candle } from "../market/types";
export interface Pattern { time: number; name: string; bias: "bullish" | "bearish" | "neutral"; explanation: string }
// Heuristic educational definitions, evaluated only on fully closed candles.
export function detectPatterns(candles: Candle[], interval: number, now = Date.now() / 1000): Pattern[] {
  const result: Pattern[] = [];
  const add = (c: Candle, name: string, bias: Pattern["bias"], explanation: string) => result.push({ time: c.time, name, bias, explanation });
  candles.forEach((c, i) => {
    if (c.time + interval > now) return;
    const range = c.high - c.low;
    if (range <= 0) return;
    const body = Math.abs(c.close - c.open), upper = c.high - Math.max(c.open, c.close), lower = Math.min(c.open, c.close) - c.low;
    const p = candles[i - 1], p2 = candles[i - 2], trendStart = candles[i - 4];
    const contiguous = p && c.time - p.time === interval;
    const downtrend = trendStart && p && p.close < trendStart.close;
    const uptrend = trendStart && p && p.close > trendStart.close;
    if (body <= range * .1) add(c, "Doji", "neutral", "The open and close are close together relative to the range, suggesting indecision.");
    else if (body <= range * .35 && lower >= body * 2 && upper <= range * .15 && downtrend) add(c, "Hammer", "bullish", "A long lower wick after a recent decline can suggest rejection of lower prices.");
    else if (body <= range * .35 && upper >= body * 2 && lower <= range * .15) {
      if (downtrend) add(c, "Inverted Hammer", "bullish", "A long upper wick after a recent decline may suggest a potential reversal requiring confirmation.");
      if (uptrend) add(c, "Shooting Star", "bearish", "A long upper wick after a recent rise can suggest rejection of higher prices.");
    }
    if (contiguous && p.close < p.open && c.close > c.open && c.open <= p.close && c.close >= p.open) add(c, "Bullish Engulfing", "bullish", "A bullish real body covers the preceding bearish real body.");
    if (contiguous && p.close > p.open && c.close < c.open && c.open >= p.close && c.close <= p.open) add(c, "Bearish Engulfing", "bearish", "A bearish real body covers the preceding bullish real body.");
    if (contiguous && p2 && p.time - p2.time === interval && Math.abs(p.close - p.open) <= Math.abs(p2.close - p2.open) * .35) {
      if (p2.close < p2.open && c.close > c.open && c.close > (p2.open + p2.close) / 2 && Math.max(p.open, p.close) <= p2.close) add(c, "Morning Star", "bullish", "A decline, small middle body, then recovery above the first body's midpoint. Gapless crypto variant.");
      if (p2.close > p2.open && c.close < c.open && c.close < (p2.open + p2.close) / 2 && Math.min(p.open, p.close) >= p2.close) add(c, "Evening Star", "bearish", "A rise, small middle body, then decline below the first body's midpoint. Gapless crypto variant.");
    }
  });
  return result;
}
