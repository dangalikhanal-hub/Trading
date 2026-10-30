import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sourceLoader } from './source-loader.mjs';
const load = sourceLoader();
const domain = load('src/lib/practice/domain.ts');
const { quoteIsFresh } = load('src/lib/market/types.ts');
const { parseDrawings } = load('src/lib/chart/drawings.ts');
const { detectPatterns } = load('src/lib/chart/patterns.ts');
const quote = (price = '100', overrides = {}) => ({ symbol: 'BTC-USD', price, bid: price, ask: price, time: new Date().toISOString(), fetchedAt: new Date().toISOString(), status: 'online', ...overrides });
const input = overrides => ({ mode: 'PRACTICE', symbol: 'BTC-USD', side: 'BUY', type: 'MARKET', quantity: '1', ...overrides });

test('PRACTICE input gate rejects LIVE, unsupported instruments, non-finite values and price precision', () => {
  for (const overrides of [{ mode: 'LIVE' }, { symbol: 'AAPL' }, { quantity: '-1' }, { quantity: 'NaN' }, { quantity: 'Infinity' }, { quantity: '0' }, { quantity: '1.000000001' }, { type: 'LIMIT' }, { type: 'STOP_LIMIT', limitPrice: '100' }, { type: 'LIMIT', limitPrice: '10.12345' }]) assert.throws(() => domain.parseOrder(input(overrides)));
  assert.equal(domain.parseOrder(input({ type: 'LIMIT', limitPrice: '100.1234' })).limitPrice, '100.1234');
});

test('practice service has no live executor dependency; transitive dependencies cannot load a broker', () => {
  let realOrders = 0;
  const loaded = sourceLoader({ '@/lib/prisma': { prisma: {} }, '@/lib/market/provider': { marketProvider: {} }, '@/lib/live-orders': { placeOrder: () => realOrders++ } });
  loaded('src/lib/practice/service.ts');
  assert.equal(realOrders, 0);
  const files = ['src/lib/practice/service.ts', 'src/lib/practice/domain.ts', 'src/lib/market/provider.ts'];
  const text = files.map(file => fs.readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(text, /brokerSecret|BROKER_API|\/orders['"`]|live-orders/);
  assert.match(text, /const base = "https:\/\/api.exchange.coinbase.com"/);
});

test('malformed confirmation signatures fail closed without a timing comparison exception', () => {
  const previous = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = 'test-confirmation-only';
  try {
    const service = sourceLoader({ '@/lib/prisma': { prisma: {} }, '@/lib/market/provider': { marketProvider: {} } })('src/lib/practice/service.ts');
    for (const signature of ['é'.repeat(43), 'x'.repeat(42), 'x'.repeat(44), '!'.repeat(43)]) {
      assert.throws(() => service.verifyPreview('owner', `e30.${signature}`), /Invalid confirmation/);
    }
  } finally { if (previous === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = previous; }
});

test('buy, weighted average, partial sale, closing, fees and P/L use exact decimals', () => {
  const buy = domain.calculateFill({ cash: '10000', quantity: '0', entry: '0', costBasis: '0', side: 'BUY', fillQuantity: '10', price: '100', feeBps: 10 });
  assert.equal(buy.cash.toString(), '8999'); assert.equal(buy.basis.toString(), '1001');
  const add = domain.calculateFill({ cash: buy.cash.toString(), quantity: '10', entry: '100', costBasis: buy.basis.toString(), side: 'BUY', fillQuantity: '10', price: '120', feeBps: 10 });
  assert.equal(add.entry.toString(), '110'); assert.equal(add.basis.toString(), '2202.2');
  const sale = domain.calculateFill({ cash: add.cash.toString(), quantity: '20', entry: add.entry.toString(), costBasis: add.basis.toString(), side: 'SELL', fillQuantity: '5', price: '130', feeBps: 10 });
  assert.equal(sale.realized.toString(), '98.8'); assert.equal(sale.quantity.toString(), '15');
  const mark = domain.markedPosition(sale.quantity.toString(), sale.basis.toString(), quote('130'));
  assert.equal(mark.unrealized.toString(), '298.35');
  const close = domain.calculateFill({ cash: sale.cash.toString(), quantity: '15', entry: '110', costBasis: sale.basis.toString(), side: 'SELL', fillQuantity: '15', price: '130', feeBps: 10 });
  assert.equal(close.quantity.toString(), '0'); assert.equal(close.basis.toString(), '0');
  assert.equal(close.cash.minus(10000).toString(), sale.realized.plus(close.realized).toString());
});

test('rejects insufficient balance, oversells, and below-precision notionals', () => {
  const base = { cash: '50', quantity: '1', entry: '100', costBasis: '100', side: 'BUY', fillQuantity: '1', price: '100', feeBps: 0 };
  assert.throws(() => domain.calculateFill(base), /Insufficient/);
  assert.throws(() => domain.calculateFill({ ...base, side: 'SELL', fillQuantity: '2' }), /Insufficient/);
  assert.throws(() => domain.calculateFill({ ...base, fillQuantity: '0.00000001', price: '0.0001' }), /precision/);
});

test('market/limit/stop/stop-limit conditions and limit-safe slippage', () => {
  const run = (overrides, price = '100') => domain.executablePrice(input(overrides), quote(price));
  assert.equal(run({}).price.toString(), '100');
  assert.equal(run({ type: 'LIMIT', limitPrice: '99' }).price, null);
  assert.equal(run({ type: 'LIMIT', limitPrice: '100' }).price.toString(), '100');
  assert.equal(run({ side: 'SELL', type: 'LIMIT', limitPrice: '101' }).price, null);
  assert.equal(run({ type: 'STOP_MARKET', stopPrice: '101' }).price, null);
  assert.equal(run({ type: 'STOP_MARKET', stopPrice: '101' }, '102').price.toString(), '102');
  assert.equal(run({ side: 'SELL', type: 'STOP_MARKET', stopPrice: '99' }, '98').price.toString(), '98');
  const stopped = run({ type: 'STOP_LIMIT', stopPrice: '101', limitPrice: '100' }, '102');
  assert.equal(stopped.triggered, true); assert.equal(stopped.price, null);
  assert.equal(run({ type: 'STOP_LIMIT', stopPrice: '101', limitPrice: '100', triggered: true }, '99').price.toString(), '99');
  assert.equal(domain.executablePrice(input({ type: 'LIMIT', limitPrice: '100' }), quote(), '.01').price, null);
});

test('stale, future, invalid and unavailable quotes cannot fill or mark a portfolio', () => {
  for (const q of [quote('100', { time: new Date(Date.now() - 31_000).toISOString() }), quote('100', { time: new Date(Date.now() + 10_000).toISOString() }), quote('100', { status: 'unavailable' }), quote('100', { time: 'invalid' })]) {
    assert.equal(quoteIsFresh(q), false); assert.throws(() => domain.executablePrice(input({}), q), /stale/); assert.equal(domain.markedPosition('1', '100', q), null);
  }
});

test('educational risk estimates validate stop loss and take profit direction', () => {
  const risk = domain.protection(input({ quantity: '10', stopLossPrice: '95', takeProfitPrice: '110' }), domain.D(100));
  assert.equal(risk.loss, '50'); assert.equal(risk.profit, '100'); assert.equal(risk.ratio, '2.00');
  assert.throws(() => domain.protection(input({ stopLossPrice: '105' }), domain.D(100)), /below/);
});

test('drawings reject malformed/duplicate shapes and persist coordinate-space precision', () => {
  const shape = { id: 'trend1', tool: 'trend', points: [{ time: 1700000000.5, price: 100.125 }, { time: 1700000300, price: 110.5 }] };
  assert.equal(JSON.stringify(parseDrawings([shape])), JSON.stringify([shape]));
  for (const value of [[shape, shape], [{ ...shape, tool: 'script' }], [{ ...shape, points: [{ time: 1, price: -1 }] }], Array(101).fill(shape)]) assert.equal(parseDrawings(value), null);
});

test('pattern detection identifies engulfing and doji only after the candle closes', () => {
  const candles = [{ time: 1700000000, open: 105, close: 100, high: 106, low: 99, volume: 1 }, { time: 1700000060, open: 99, close: 106, high: 107, low: 98, volume: 1 }, { time: 1700000120, open: 105, close: 105.01, high: 110, low: 100, volume: 1 }];
  const patterns = detectPatterns(candles, 60, 1700000180);
  assert.equal(patterns.some(p => p.name === 'Bullish Engulfing' && p.time === candles[1].time), true);
  assert.equal(patterns.some(p => p.name === 'Doji'), true);
  assert.equal(detectPatterns(candles, 60, 1700000121).some(p => p.name === 'Doji'), false);
  assert.equal(detectPatterns([{ ...candles[0], high: 100, low: 100, open: 100, close: 100 }], 60).length, 0);
});

test('detects hammer, inverted hammer, shooting star, bearish engulfing and star patterns', () => {
  const start = 1700000000;
  const candle = (i, open, close, high = Math.max(open, close) + 1, low = Math.min(open, close) - 1) => ({ time: start + i * 60, open, close, high, low, volume: 1 });
  const down = [120, 115, 110, 105].map((p, i) => candle(i, p + 1, p));
  const up = [80, 85, 90, 95].map((p, i) => candle(i, p - 1, p));
  const fixtures = [
    ['Hammer', [...down, candle(4, 100, 101, 101.5, 94)]],
    ['Inverted Hammer', [...down, candle(4, 100, 101, 107, 99.5)]],
    ['Shooting Star', [...up, candle(4, 100, 99, 106, 98.5)]],
    ['Bearish Engulfing', [candle(0, 100, 105), candle(1, 106, 99)]],
    ['Morning Star', [candle(0, 110, 100), candle(1, 99, 99.2), candle(2, 99, 106)]],
    ['Evening Star', [candle(0, 100, 110), candle(1, 111, 111.2), candle(2, 111, 104)]],
  ];
  for (const [name, candles] of fixtures) assert.equal(detectPatterns(candles, 60, start + 1000).some(p => p.name === name), true, name);
});
