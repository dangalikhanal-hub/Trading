import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceLoader } from './source-loader.mjs';

const { candleFromTrade } = sourceLoader()('src/lib/chart/live-candle.ts');
const interval = 60;
const time = Math.floor(Date.now() / 60000) * 60;
const quote = (price, overrides = {}) => ({
  symbol: 'BTC-USD', price: String(price), bid: String(price), ask: String(price),
  time: new Date().toISOString(), fetchedAt: new Date().toISOString(),
  status: 'online', delivery: 'WebSocket ticker', ...overrides,
});
const bar = { time, open: 100, high: 105, low: 95, close: 101, volume: 7 };

test('live observed trades extend OHLC without inventing volume or changing the open', () => {
  const up = candleFromTrade(bar, quote(110), interval);
  assert.equal(up.open, 100);
  assert.equal(up.high, 110);
  assert.equal(up.low, 95);
  assert.equal(up.close, 110);
  assert.equal(up.volume, 7);
  const down = candleFromTrade(up, quote(90), interval);
  assert.equal(down.high, 110);
  assert.equal(down.low, 90);
  assert.equal(bar.close, 101);
});

test('the first observed trade in a later bucket starts one bar without fabricating gap candles', () => {
  const next = candleFromTrade({ ...bar, time: time - 180 }, quote(120), interval);
  assert.equal(next.time, time);
  for (const field of ['open', 'high', 'low', 'close']) assert.equal(next[field], 120);
  assert.equal(next.volume, 0);
});

test('stale, unavailable, REST and invalid prices cannot create live bars', () => {
  for (const invalid of [
    quote(100, { time: new Date(Date.now() - 31000).toISOString() }),
    quote(100, { status: 'unavailable' }), quote(100, { delivery: 'REST polling' }),
    quote('NaN'), quote(0), quote(-1),
  ]) assert.equal(candleFromTrade(bar, invalid, interval), null);
  assert.equal(candleFromTrade(bar, quote(110), 0), null);
  assert.equal(candleFromTrade({ ...bar, time: time + 60 }, quote(110), interval), null);
});
