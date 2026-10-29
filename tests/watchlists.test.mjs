import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports, URL, process: { env: {} }, require: id => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`);
    return dependencies[id];
  } });
  return exports;
}

test('wallet reset rejects unsafe requests, throttles, and reports storage failures safely', async () => {
  let user = null;
  let allowed = true;
  let resets = 0;
  let fail = false;
  const routes = load('src/app/api/wallet/reset/route.ts', {
    '@/auth': { auth: async () => user },
    '@/lib/wallets': { ensureWallets: async (id, reset) => {
      assert.equal(id, 'owner'); assert.equal(reset, true); resets++;
      if (fail) throw new Error('database-secret');
    } },
    '@/lib/auth-rate-limit': { allowAuthAttempt: async () => allowed },
    '@/lib/request-security': load('src/lib/request-security.ts'), 'next/server': { NextResponse: Response },
  });
  assert.equal((await routes.POST(new Request('https://terminal.example/reset', { method: 'POST' }))).status, 403);
  assert.equal((await routes.POST(request({}))).status, 401);
  user = { user: { id: 'owner' } };
  allowed = false;
  assert.equal((await routes.POST(request({}))).status, 429);
  assert.equal(resets, 0);
  allowed = true;
  assert.equal((await routes.POST(request({}))).status, 200);
  fail = true;
  const failure = await routes.POST(request({}));
  assert.equal(failure.status, 503);
  assert.equal((await failure.text()).includes('database-secret'), false);
});

test('wallet reset writes its audit in the same transaction and preserves the wallet return shape', async () => {
  const operations = [];
  let auditFails = false;
  const tx = {
    wallet: { upsert: async args => { operations.push(['wallet', args]); return { currency: args.create.currency }; } },
    auditLog: { create: async args => { operations.push(['audit', args]); if (auditFails) throw new Error('audit unavailable'); } },
  };
  const wallets = load('src/lib/wallets.ts', {
    '@prisma/client': { Prisma: { Decimal: class { constructor(value) { this.value = value; } } } },
    '@/lib/prisma': { prisma: { $transaction: async fn => fn(tx) } },
  });
  const result = await wallets.ensureWallets('owner');
  assert.equal(result.length, 2);
  assert.equal(operations.some(([op]) => op === 'audit'), false);
  assert.equal(Object.keys(operations[0][1].update).length, 0);
  operations.length = 0;
  assert.equal((await wallets.ensureWallets('owner', true)).length, 2);
  assert.equal(operations.filter(([op]) => op === 'wallet').length, 2);
  const audit = operations.find(([op]) => op === 'audit')[1];
  assert.equal(audit.data.userId, 'owner');
  assert.equal(audit.data.action, 'BALANCE_RESET');
  auditFails = true;
  await assert.rejects(wallets.ensureWallets('owner', true), /audit unavailable/);
});
const validation = load('src/lib/watchlists.ts');
const security = load('src/lib/request-security.ts');
const request = body => new Request('https://terminal.example/api/watchlists', {
  method: 'POST', headers: { origin: 'https://terminal.example', 'content-type': 'application/json' }, body: JSON.stringify(body),
});

function harness({ user = { user: { id: 'owner' } }, owned = true, listCount = 0, itemCount = 0, existing = false } = {}) {
  const calls = [];
  const tx = {
    watchlist: {
      count: async args => { calls.push(['count', args]); return listCount; },
      findFirst: async args => { calls.push(['ownership', args]); return owned ? { id: 'list1' } : null; },
      create: async args => { calls.push(['create', args]); return { id: 'new-list' }; },
      delete: async args => { calls.push(['delete', args]); },
    },
    watchlistItem: {
      findUnique: async () => existing ? { id: 'item1' } : null,
      count: async () => itemCount,
      create: async args => { calls.push(['add', args]); },
      deleteMany: async args => { calls.push(['remove', args]); },
    },
  };
  const prisma = {
    $transaction: async (fn, options) => { assert.equal(options.isolationLevel, 'Serializable'); return fn(tx); },
    watchlist: { findMany: async args => { calls.push(['read', args]); return []; } },
  };
  class KnownError extends Error {}
  const routes = load('src/app/api/watchlists/route.ts', {
    '@/auth': { auth: async () => user }, '@/lib/prisma': { prisma },
    '@/lib/auth-rate-limit': { allowAuthAttempt: async () => true },
    '@/lib/request-security': security, '@/lib/watchlists': validation,
    'next/server': { NextResponse: Response },
    '@prisma/client': { Prisma: { TransactionIsolationLevel: { Serializable: 'Serializable' }, PrismaClientKnownRequestError: KnownError } },
  });
  return { routes, calls };
}

test('normalizes symbols, bounds names, and rejects invalid actions and asset types', () => {
  const parsed = validation.parseWatchlistAction({ action: 'add', watchlistId: 'list1', symbol: ' btc/usdt ', assetType: 'CRYPTO' });
  assert.equal(parsed.symbol, 'BTC/USDT');
  assert.equal(validation.parseWatchlistAction({ action: 'create', name: ' Research ' }).name, 'Research');
  for (const input of [null, [], {}, { action: 'create', name: ' ' }, { action: 'create', name: 'a'.repeat(61) },
    { action: 'create', name: 'bad\nname' }, { action: 'delete', watchlistId: '../other' },
    { action: 'add', watchlistId: 'list1', symbol: '<script>', assetType: 'CRYPTO' },
    { action: 'add', watchlistId: 'list1', symbol: 'BTC', assetType: 'OTHER' }]) {
    assert.equal(validation.parseWatchlistAction(input), null);
  }
});

test('rejects cross-origin and anonymous requests before writes', async () => {
  const { routes, calls } = harness({ user: null });
  assert.equal((await routes.GET()).status, 401);
  assert.equal((await routes.POST(request({ action: 'create', name: 'Test' }))).status, 401);
  const crossOrigin = new Request('https://terminal.example/api/watchlists', { method: 'POST', headers: { origin: 'https://attacker.example' } });
  assert.equal((await routes.POST(crossOrigin)).status, 403);
  assert.equal((await routes.POST(new Request('https://terminal.example', { method: 'POST' }))).status, 403);
  assert.equal(calls.length, 0);
});

test('scopes reads to session owner and disables caching', async () => {
  const { routes, calls } = harness();
  const response = await routes.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(calls[0][1].where.userId, 'owner');
});

test('blocks every mutation of another users list before item access', async () => {
  for (const action of ['delete', 'remove', 'add']) {
    const { routes, calls } = harness({ owned: false });
    const response = await routes.POST(request({ action, watchlistId: 'list1', symbol: 'BTC', assetType: 'CRYPTO' }));
    assert.equal(response.status, 404);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'ownership');
    assert.equal(calls[0][1].where.userId, 'owner');
  }
});

test('enforces list/item quotas and treats repeated additions as idempotent', async () => {
  const full = harness({ listCount: 20 });
  assert.equal((await full.routes.POST(request({ action: 'create', name: 'Too many' }))).status, 409);
  assert.equal(full.calls.some(([op]) => op === 'create'), false);
  const fullItems = harness({ itemCount: 100 });
  assert.equal((await fullItems.routes.POST(request({ action: 'add', watchlistId: 'list1', symbol: 'BTC', assetType: 'CRYPTO' }))).status, 409);
  assert.equal(fullItems.calls.some(([op]) => op === 'add'), false);
  const duplicate = harness({ existing: true, itemCount: 100 });
  assert.equal((await duplicate.routes.POST(request({ action: 'add', watchlistId: 'list1', symbol: 'BTC', assetType: 'CRYPTO' }))).status, 200);
  assert.equal(duplicate.calls.some(([op]) => op === 'add'), false);
});

test('creates lists under session identity, adds normalized symbols, and removes owned items', async () => {
  const { routes, calls } = harness();
  assert.equal((await routes.POST(request({ action: 'create', name: 'Research', userId: 'attacker' }))).status, 201);
  assert.equal(calls.find(([op]) => op === 'create')[1].data.userId, 'owner');
  assert.equal((await routes.POST(request({ action: 'add', watchlistId: 'list1', symbol: ' btc/usdt ', assetType: 'CRYPTO' }))).status, 200);
  assert.equal(calls.find(([op]) => op === 'add')[1].data.symbol, 'BTC/USDT');
  assert.equal((await routes.POST(request({ action: 'remove', watchlistId: 'list1', symbol: 'BTC/USDT' }))).status, 200);
  assert.equal(calls.find(([op]) => op === 'remove')[1].where.watchlistId, 'list1');
});
