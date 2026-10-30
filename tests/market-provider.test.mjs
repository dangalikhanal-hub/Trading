import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { sourceLoader } from './source-loader.mjs';
const nativeRequire = createRequire(import.meta.url);
function adapter(responder) {
  const exports = {}, calls = [];
  const code = ts.transpileModule(fs.readFileSync('src/lib/market/provider.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, URLSearchParams, AbortSignal, Date, Map, fetch: async (url, options) => { calls.push({ url, options }); return responder(url); }, require: id => id === './types' ? sourceLoader()('src/lib/market/types.ts') : nativeRequire(id) });
  return { provider: exports.marketProvider, calls };
}
const response = data => ({ ok: true, json: async () => data });
test('Coinbase read-only adapter normalizes quotes with exact changes and never sends credentials or order requests', async () => {
  const { provider, calls } = adapter(url => response(url.endsWith('/ticker') ? { price: '100.25', bid: '100.2', ask: '100.3', volume: '150', time: new Date().toISOString() } : url.endsWith('/stats') ? { open: '100' } : { status: 'online' }));
  const quote = await provider.quote('BTC-USD');
  assert.equal(quote.price, '100.2500'); assert.equal(quote.change, '0.2500'); assert.equal(quote.changePercent, '0.25');
  assert.equal(quote.status, 'online'); assert.equal(quote.delivery, 'REST polling');
  for (const call of calls) { assert.match(call.url, /^https:\/\/api.exchange.coinbase.com\/products\/BTC-USD/); assert.equal(call.options.method, undefined); assert.equal(call.options.headers.Authorization, undefined); }
  await assert.rejects(provider.quote('AAPL'), /Unsupported/);
});
test('adapter sorts/deduplicates real OHLCV layout and refuses malformed candles', async () => {
  const good = adapter(() => response([[1700000060, 99, 110, 100, 108, 4], [1700000000, 95, 105, 96, 100, 3], [1700000060, 99, 110, 100, 108, 4]]));
  const candles = await good.provider.candles('BTC-USD', '1m', 1700000120);
  assert.equal(candles.length, 2); assert.equal(candles[0].open, 96); assert.equal(candles[0].low, 95); assert.equal(candles[1].volume, 4);
  const bad = adapter(() => response([[1700000000, 105, 99, 100, 108, 4]]));
  await assert.rejects(bad.provider.candles('BTC-USD', '1m'), /OHLCV/);
});
test('provider failure stays a failure and does not return fixture prices', async () => {
  const { provider } = adapter(() => ({ ok: false }));
  await assert.rejects(provider.quote('BTC-USD'), /Coinbase market data/);
});

test('public ticker parser rejects malformed, stale and wrong-symbol messages', () => {
  const { parseTicker } = sourceLoader()('src/lib/market/ticker.ts');
  const reference = { symbol: 'BTC-USD', status: 'online', source: 'Coinbase Exchange' };
  const tick = { type: 'ticker', product_id: 'BTC-USD', price: '101', best_bid: '100.9', best_ask: '101.1', open_24h: '100', volume_24h: '50', time: new Date().toISOString() };
  assert.equal(parseTicker(tick, 'BTC-USD', reference).delivery, 'WebSocket ticker');
  assert.equal(parseTicker(tick, 'BTC-USD', reference).changePercent, '1.00');
  for (const invalid of [{ ...tick, price: 'NaN' }, { ...tick, open_24h: '0' }, { ...tick, product_id: 'ETH-USD' }, { ...tick, best_bid: '110' }, { ...tick, time: new Date(Date.now() - 60_000).toISOString() }]) assert.equal(parseTicker(invalid, 'BTC-USD', reference), null);
  assert.equal(parseTicker(tick, 'BTC-USD', undefined), null);
});
