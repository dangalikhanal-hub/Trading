import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { sourceLoader } from './source-loader.mjs';

const url = process.env.PRACTICE_TEST_DATABASE_URL;
test('PostgreSQL practice transactions, reservations, isolation, resets and drawing persistence', { skip: !url }, async t => {
  const target = new URL(url);
  assert.equal(['localhost', '127.0.0.1'].includes(target.hostname), true, 'Use an isolated LOCAL database only');
  assert.match(target.pathname, /^\/practice_[a-z0-9_]+$/);
  const db = new PrismaClient({ datasourceUrl: url });
  const previous = { AUTH_SECRET: process.env.AUTH_SECRET, PRACTICE_FEE_BPS: process.env.PRACTICE_FEE_BPS, PRACTICE_INITIAL_BALANCE: process.env.PRACTICE_INITIAL_BALANCE, PRACTICE_SLIPPAGE_BPS: process.env.PRACTICE_SLIPPAGE_BPS };
  process.env.AUTH_SECRET = randomUUID(); process.env.PRACTICE_FEE_BPS = '0'; process.env.PRACTICE_INITIAL_BALANCE = '10000'; process.env.PRACTICE_SLIPPAGE_BPS = '0';
  const ids = [randomUUID(), randomUUID()]; let currentUser = ids[0], price = '100', stale = false;
  let realCalls = 0;
  const marketProvider = { quote: async symbol => ({ symbol, price, bid: price, ask: price, volume: '10', change: '0', changePercent: '0', time: new Date(Date.now() - (stale ? 60_000 : 0)).toISOString(), fetchedAt: new Date().toISOString(), source: 'TEST FIXTURE ONLY', delivery: 'REST polling', status: 'online' }) };
  const load = sourceLoader({ '@/lib/prisma': { prisma: db }, '@/lib/market/provider': { marketProvider }, '@/lib/live-orders': { placeOrder: () => { realCalls++; throw new Error('REAL EXECUTION FORBIDDEN'); } },
    '@/lib/practice/http': { practiceRequest: async (_request, _mutation, handler) => {
      try { return Response.json(await handler(currentUser)); } catch (error) { return Response.json({ error: error.message }, { status: error.status || 503 }); }
    }, jsonBody: request => request.json() },
  });
  const service = load('src/lib/practice/service.ts');
  const order = (extra = {}) => ({ mode: 'PRACTICE', symbol: 'BTC-USD', side: 'BUY', type: 'MARKET', quantity: '1', ...extra });
  const submit = async extra => { const preview = await service.previewOrder(ids[0], order(extra)); return service.placeOrder(ids[0], preview.token); };
  try {
    for (const id of ids) await db.user.create({ data: { id, email: `${id}@practice.invalid` } });
    await t.test('market buys, duplicate submissions and concurrent idempotency', async () => {
      const preview = await service.previewOrder(ids[0], order({ quantity: '10' }));
      const [a, b] = await Promise.all([service.placeOrder(ids[0], preview.token), service.placeOrder(ids[0], preview.token)]);
      assert.equal(a.id, b.id); assert.equal(a.status, 'FILLED');
      assert.equal(await db.paperTrade.count({ where: { orderId: a.id } }), 1);
      assert.equal((await db.paperAccount.findUnique({ where: { userId: ids[0] } })).cashBalance.toString(), '9000');
      assert.equal(realCalls, 0);
      await assert.rejects(service.previewOrder(ids[0], order({ mode: 'LIVE' })), /PRACTICE/);
      await assert.rejects(service.placeOrder(ids[1], preview.token), /expired/);
      const tampered = preview.token.slice(0, -1) + (preview.token.endsWith('a') ? 'b' : 'a');
      await assert.rejects(service.placeOrder(ids[0], tampered), /Invalid confirmation/);
    });
    await t.test('concurrent different orders cannot over-reserve an account', async () => {
      const otherOrder = order({ quantity: '80', type: 'LIMIT', limitPrice: '90' });
      const a = await service.previewOrder(ids[1], otherOrder), b = await service.previewOrder(ids[1], otherOrder);
      const results = await Promise.allSettled([service.placeOrder(ids[1], a.token), service.placeOrder(ids[1], b.token)]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      const pending = results.find(r => r.status === 'fulfilled').value;
      assert.equal((await service.syncPractice(ids[1])).account.reservedMargin.toString(), '7200');
      await service.cancelOrder(ids[1], pending.id);
    });
    await t.test('weighted average and realized/unrealized portfolio accounting', async () => {
      price = '120'; await submit({ quantity: '10' });
      price = '130'; await submit({ side: 'SELL', quantity: '5' });
      const snapshot = await service.syncPractice(ids[0]);
      assert.equal(snapshot.positions[0].entryPrice.toString(), '110');
      assert.equal(snapshot.positions[0].quantity.toString(), '15');
      assert.equal(snapshot.metrics.realized.toString(), '100');
      assert.equal(snapshot.metrics.unrealized.toString(), '300');
      assert.equal(snapshot.metrics.equity.toString(), '10400');
    });
    await t.test('limit reservations, cancellation and user isolation', async () => {
      const pending = await submit({ type: 'LIMIT', limitPrice: '90', quantity: '2' });
      assert.equal(pending.status, 'PENDING');
      const before = await service.syncPractice(ids[0]);
      assert.equal(before.account.reservedMargin.toString(), '180');
      await assert.rejects(service.cancelOrder(ids[1], pending.id), /not found/);
      await service.cancelOrder(ids[0], pending.id);
      await assert.rejects(service.cancelOrder(ids[0], pending.id), /Only pending/);
      assert.equal((await service.syncPractice(ids[0])).account.reservedMargin.toString(), '0');
      const other = await service.syncPractice(ids[1]); assert.equal(other.positions.length, 0);
    });
    await t.test('limit and stop triggering; stop-limit latch survives subsequent quotes', async () => {
      const limit = await submit({ type: 'LIMIT', limitPrice: '100' });
      price = '99'; await service.syncPractice(ids[0]);
      assert.equal((await db.paperOrder.findUnique({ where: { id: limit.id } })).status, 'FILLED');
      const stop = await submit({ type: 'STOP_MARKET', stopPrice: '110' });
      price = '111'; await service.syncPractice(ids[0]);
      assert.equal((await db.paperOrder.findUnique({ where: { id: stop.id } })).status, 'FILLED');
      const stopLimit = await submit({ type: 'STOP_LIMIT', stopPrice: '120', limitPrice: '115' });
      price = '121'; await service.syncPractice(ids[0]);
      const triggered = await db.paperOrder.findUnique({ where: { id: stopLimit.id } }); assert.ok(triggered.triggeredAt); assert.equal(triggered.status, 'PENDING');
      price = '114'; await service.syncPractice(ids[0]); assert.equal((await db.paperOrder.findUnique({ where: { id: stopLimit.id } })).status, 'FILLED');
    });
    await t.test('stale quotes block execution and current valuation; insufficient cash cannot overspend', async () => {
      stale = true; await assert.rejects(service.previewOrder(ids[0], order()), /stale/);
      assert.equal((await service.syncPractice(ids[0])).metrics.equity, null); stale = false;
      await assert.rejects(submit({ quantity: '1000000' }), /buying power/);
    });
    await t.test('sell reservations prevent oversells and closing clears the position', async () => {
      const snapshot = await service.syncPractice(ids[0]); const qty = snapshot.positions[0].quantity.toString();
      const sell = await submit({ side: 'SELL', type: 'LIMIT', limitPrice: '200', quantity: qty });
      await assert.rejects(submit({ side: 'SELL' }), /unreserved/);
      await service.cancelOrder(ids[0], sell.id);
      const closed = await submit({ side: 'SELL', quantity: qty }); assert.equal(closed.status, 'FILLED');
      assert.equal((await service.syncPractice(ids[0])).positions.length, 0);
    });
    await t.test('reset rejects old previews and clears only the practice ledger', async () => {
      const preview = await service.previewOrder(ids[0], order());
      await db.wallet.create({ data: { userId: ids[0], currency: 'NPR', balance: '42' } });
      await service.resetAccount(ids[0], '25000');
      await assert.rejects(service.placeOrder(ids[0], preview.token), /reset/);
      const snapshot = await service.syncPractice(ids[0]); assert.equal(snapshot.account.cashBalance.toString(), '25000'); assert.equal(snapshot.orders.length, 0); assert.equal(snapshot.trades.length, 0);
      assert.equal((await db.wallet.findFirst({ where: { userId: ids[0] } })).balance.toString(), '42');
    });
    await t.test('position stop loss closes automatically and cancels pending sibling orders', async () => {
      price = '100'; await submit({ quantity: '2', stopLossPrice: '95', takeProfitPrice: '110' });
      const pending = await submit({ side: 'SELL', quantity: '1', type: 'LIMIT', limitPrice: '120' });
      price = '94'; const snapshot = await service.syncPractice(ids[0]); assert.equal(snapshot.positions.length, 0);
      assert.equal((await db.paperOrder.findUnique({ where: { id: pending.id } })).status, 'CANCELLED');
      assert.equal(snapshot.metrics.realized.toString(), '-12');
    });
    await t.test('take-profit protection and fee-inclusive realized ledger reconcile', async () => {
      price = '100'; await submit({ quantity: '2', takeProfitPrice: '110' });
      price = '111'; const target = await service.syncPractice(ids[0]); assert.equal(target.positions.length, 0); assert.equal(target.metrics.realized.toString(), '10');
      process.env.PRACTICE_FEE_BPS = '10'; price = '100'; await submit({ quantity: '1' });
      price = '110'; await submit({ side: 'SELL', quantity: '1' });
      const after = await service.syncPractice(ids[0]);
      assert.equal(after.metrics.realized.minus(target.metrics.realized).toString(), '9.79');
      assert.equal(after.metrics.fees.toString(), '0.21');
      assert.equal(after.metrics.totalPnl.toString(), after.metrics.realized.toString());
      process.env.PRACTICE_FEE_BPS = '0';
    });
    await t.test('drawings persist per user/symbol/timeframe and stale saves conflict', async () => {
      const routes = load('src/app/api/chart/drawings/route.ts');
      const shapes = [{ id: 'trend1', tool: 'trend', points: [{ time: 1700000000, price: 100 }, { time: 1700000300, price: 110 }] }];
      const save = version => routes.PUT(new Request('https://test.invalid/api/chart/drawings', { method: 'PUT', body: JSON.stringify({ symbol: 'BTC-USD', timeframe: '1H', shapes, version }) }));
      assert.equal((await save(0)).status, 200);
      const get = () => routes.GET(new Request('https://test.invalid/api/chart/drawings?symbol=BTC-USD&timeframe=1H'));
      assert.deepEqual((await (await get()).json()).shapes, shapes);
      assert.equal((await save(0)).status, 409); assert.equal((await save(1)).status, 200); assert.equal((await save(1)).status, 409);
      currentUser = ids[1]; assert.equal((await (await get()).json()).shapes.length, 0);
      currentUser = ids[0]; assert.equal((await (await routes.GET(new Request('https://test.invalid/api/chart/drawings?symbol=BTC-USD&timeframe=5m'))).json()).shapes.length, 0);
      assert.equal(realCalls, 0);
    });
  } finally {
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
