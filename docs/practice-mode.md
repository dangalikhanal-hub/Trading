# Practice trading workspace

Open `/dashboard/practice` after signing in, or choose **Practice terminal** in the existing dashboard navigation. The original dashboard, authentication/approval flows, demo wallets, and saved watchlists remain in place.

## Run locally

1. Install dependencies: `npm install`.
2. Configure the root application's ignored `.env` with `DATABASE_URL` (PostgreSQL), `AUTH_SECRET` (strong random secret), and `AUTH_URL` (e.g. `http://localhost:3000`). Never use a public-prefixed variable for these values.
3. Review and apply the migration to your intended database: `npx prisma migrate deploy`.
4. Run `npm run dev`, sign in with an approved user, and visit `/dashboard/practice`.

An example configuration is provided in `config/practice.env.example`. The optional **server-only** settings are:

| Setting | Default | Meaning |
| --- | --- | --- |
| `PRACTICE_INITIAL_BALANCE` | `100000` | Initial virtual USD balance for newly created accounts, up to four decimals |
| `PRACTICE_FEE_BPS` | `0` | Commission in basis points, integer 0–100 |
| `PRACTICE_SLIPPAGE_BPS` | `0` | Adverse simulated slippage in basis points, integer 0–100 |

The reset form lets users set a new balance between $100 and $1 billion. Reset deletes only that user's paper account, positions, orders, and fills in one transaction, creates a new paper account ID, and writes an audit event. Existing NPR/USDT Wallet records and chart drawings remain saved. Old signed confirmations cannot place orders after a reset. Reset has an explicit destructive-action confirmation.

## Market data and supported instruments

The existing app had no connected provider or chart library. The new `MarketDataProvider` interface wraps Coinbase Exchange's public, read-only REST endpoints. It needs **no API key or brokerage account**. Supported instruments are BTC-USD, ETH-USD, and SOL-USD; symbol search is limited to this curated supported catalog. This does not implement equities, Nepal shares, forex, or an exchange-wide symbol directory.

Quotes include provider trade timestamp, receipt timestamp, bid/ask, last price, volume, daily price/percentage change, and product status. Server quotes/portfolio refresh every 10 seconds; OHLCV every 15 seconds. The chart also subscribes to Coinbase's public WebSocket ticker for its selected symbol. Incoming valid observed trades update the existing current candle's high/low/close and latest-price line; REST reconciles volume/history and supplies new candle buckets. Display updates are capped at four per second inside the chart, not the whole application. The socket reconnects with bounded backoff and closes on unmount or symbol/timeframe changes. Delivery labels distinguish **WebSocket ticker** from **REST polling** fallback. No artificial exchange delay is applied, but network/polling delay exists. Quotes older than 30 seconds, invalid/future timestamps, and unavailable market states block fills. Client WebSocket prices are display-only; orders use fresh server-fetched quotes. Network/provider failures produce errors and unavailable valuation fields rather than fake prices.

Timeframes are restricted to Coinbase's native 1m, 5m, 15m, 1H, 6H, and 1D granularities. Earlier candles can be loaded in pages of up to 300, with a 3,000-candle client limit. No candles are generated for gaps. The currently forming candle can change; pattern detection excludes it. Quote caching lasts at most three seconds; stats and product metadata have separate bounded caches. Live deployment requires server outbound HTTPS/DNS access to `api.exchange.coinbase.com` and optional browser WebSocket access to `wss://ws-feed.exchange.coinbase.com`. There is no automatic fallback to a different provider or demo data. USD pairs are never silently substituted for saved USDT pairs; unsupported denominations show unavailable quotes.

Reference: [Coinbase candles](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles), [Coinbase ticker](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-ticker).

## Execution and accounting

- This is an unleveraged, spot, long-only USD simulation. The Live Trading selector is disabled because no live broker integration exists. Practice code has no broker credentials or live execution client. `mode: LIVE` is rejected on the server.
- Every manual order requires a server-signed preview bound to the user, current account ID, canonical order fields, and a unique client order ID. The confirmation expires after 60 seconds. Market submissions require a fresh quote and a new preview if the market moved over 1%.
- Buys use the fresh ask; sells use the fresh bid, with configured adverse slippage. Limits cannot fill outside their limit price. Stop-market triggers on ask >= stop for buys or bid <= stop for sells. Stop-limit stores its triggered state and waits for a limit-compatible quote. No partial fills/order-book liquidity simulation is claimed.
- Pending buys reserve cash including fees. Stop-market orders reserve a 2% buffer above the larger of the current ask and stop; a gap may still cause rejection for insufficient funds at execution. Pending sells reserve owned quantity. Cancel releases reservations atomically. Maximum 100 pending orders and 1 million units per symbol position.
- Decimal arithmetic rounds monetary values to four places and supports eight places for quantities. The position's `marginUsed` field is reused as fee-inclusive cost basis for this spot engine. Average entry is price-weighted before fees; realized P/L subtracts allocated entry fees and exit fees. Closing the entire position allocates remaining basis exactly to avoid residual rounding balances.
- Cash, position, order, fill, and audit changes occur in serializable Prisma transactions with bounded concurrency retries and a database unique client-order key. Repeating a confirmation cannot create another fill. Other users' accounts/orders/drawings are inaccessible through these handlers.
- Optional buy-order SL/TP applies to the **whole resulting symbol position**, not an independent lot. A protection trigger cancels pending orders for that symbol and sells the position with one simulated market order. Stop losses are not guaranteed maximum losses. Educational risk/reward estimates exclude spread, fees, gaps, and slippage.
- Pending orders/protection evaluate on account polling **only while a practice workspace is open**. There is no always-on worker. No fills are invented for prices crossed during a closed/disconnected session. A continuously deployed quote-driven worker is required for continuous offline simulation; the same engine can be called by that worker later.
- Equity marks positions at fresh bids. A missing quote makes total equity/unrealized P/L unavailable; cash and realized P/L remain valid. UTC daily P/L is equity since the first successful valuation of each UTC day (or initial balance on account creation/reset). It is explicitly not a reconstructed midnight valuation. Win/loss statistics count sale fills, including partial closes. Tables show the latest 200 fills/orders plus all pending orders, with symbol filter and time direction controls; they are not a complete paginated export.

## Charts and drawings

Added `lightweight-charts` (with its `fancy-canvas` transitive dependency). There was no financial charting library to reuse. It provides canvas candlesticks, price/time scales, crosshair, volume, zoom/pan, responsive resize, current-price line and OHLC inspection. Chart-specific code is isolated in `PracticeChart.tsx`; the existing illustrative MarketChart is preserved on the original dashboard. The chart includes TradingView attribution per its Apache/NOTICE requirements.

Use **Trend line**, tap the first price/time point, then the second. **Select / move** selects a drawing; drag its endpoint handles or body. **Pan / zoom** restores the underlying chart interactions. Horizontal, vertical, ray, price-line, rectangle, and Fibonacci overlays are also supported. Undo/redo/clear/delete operate locally; **Save drawings** persists them per user/symbol/timeframe. Unsaved changes prompt before symbol/timeframe switches or unloading. Reload resolves conflicting saves; version checks prevent overwriting a newer tab's drawings. Touch pointer events use the same coordinate mapping. Save explicitly before leaving through other app navigation.

Optional pattern markers detect Doji, Hammer, Inverted Hammer, Shooting Star, Bullish/Bearish Engulfing, Morning/Evening Star using documented educational heuristics. Click a marked candle in Pan mode or use the pattern selector for time, interpretation, and explanation. These are informational patterns, not guaranteed trade signals. Morning/evening stars use a gapless crypto variant; hammer/star interpretation uses recent trend context.

## Endpoints

All routes require authentication. Cookie-authenticated writes require the configured origin. Requests are rate limited per user and responses are not publicly cached.

| Route | Operation |
| --- | --- |
| `GET /api/practice/account` | Create/read practice account, process pending/protective orders on valid observed quotes, return positions, recent orders/fills and metrics |
| `POST /api/practice/account` | Explicitly confirmed reset with configured balance |
| `POST /api/practice/orders` | `preview` or explicitly confirmed `confirm` action using signed token |
| `DELETE /api/practice/orders` | Cancel own pending order by ID |
| `GET /api/market?action=symbols&q=...` | Search the supported instrument catalog |
| `GET /api/market?action=quotes` | Supported quotes with individual provider errors |
| `GET /api/market?symbol=BTC-USD&timeframe=1H&end=...` | Actual historical OHLCV page |
| `GET /api/chart/drawings?symbol=BTC-USD&timeframe=1H` | Read own saved shapes/version |
| `PUT /api/chart/drawings` | Validate/save own shapes with optimistic version check |

The existing `/api/watchlists` endpoints are reused; the existing component now shows supported quotes and can open the practice chart. No duplicate watchlist tables were created.

## Database migration

`20261029010000_practice_workspace` extends the existing PaperAccount, PaperOrder, and PaperTrade tables with UTC day-equity anchor, reservations, fee/protection/trigger/fill metadata, and allocated entry-price history. Adds unique account/client-order IDs and lookup indexes. Adds the ChartDrawing model with a user foreign key and unique user/symbol/timeframe versioned shape document. Relationships and ownership stay in the existing schema. No real-money tables or APIs are added.

## Tests and verification

Run `npm test`, `npm run lint`, and `npm run build`. If the environment blocks Node's test subprocess spawn, use `node --test --test-isolation=none tests/*.test.mjs`.

The optional database integration suite uses `PRACTICE_TEST_DATABASE_URL`. It refuses non-local hosts and database names without the `practice_` prefix. Create a disposable local database, apply migrations using that URL, then run:

```powershell
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@127.0.0.1:5432/practice_test'
npx prisma migrate deploy
$env:PRACTICE_TEST_DATABASE_URL = $env:DATABASE_URL
node --test --test-isolation=none tests/*.test.mjs
```

Fixtures exist **only in tests** and are explicitly labeled. Tests cover decimal buys/sells/fees/cost basis, average entry, realized/unrealized P/L, closing, all order triggers, stop-limit latching, reservations/cancellation, stale prices, concurrent duplicate confirmations, cross-user account/order/drawing isolation, reset invalidation, SL/TP, pattern detection and drawing persistence/version conflicts. No runtime mock-data provider is added.

Files created: `src/lib/market/{types,provider}.ts`, `src/lib/practice/{domain,service,http}.ts`, `src/lib/chart/{drawings,patterns}.ts`, practice/account/order/market/drawing route handlers, `src/components/practice/{PracticeTerminal,PracticeChart}.tsx`, `/dashboard/practice/page.tsx` and stylesheet, the migration, and practice/provider/integration test files plus test loader. Modified: Prisma schema, package manifest/lock, dashboard sidebar, existing SavedWatchlists, README. Other concurrent authentication/dashboard edits in the workspace are outside this implementation.

Before a production release, verify the provider is reachable from the deployment region, apply the migration, perform authenticated browser checks on desktop/touch devices, and choose whether an always-on conditional-order worker is needed. No practice account or role was provisioned in production during this work.

### Verification performed in this workspace

- Applied all four migrations successfully to a disposable, loopback-only PostgreSQL 18 test instance; no production migration was run.
- All 37 tests passed, including the database integration subtests and malformed-signature regression. TypeScript and the production build passed. ESLint passed with the two existing unused-variable warnings in the static prototype files. `git diff --check` passed.
- Authenticated HTTP smoke checks against the actual local Next app returned 200 for the practice page/account, created the default $100,000 virtual account, and returned 403 for cross-origin writes and `LIVE` order previews. The temporary HTTP-test user was removed afterward.
- Coinbase and Kraken public HTTPS connectivity attempts from this machine failed. Actual provider reachability and WebSocket delivery were therefore not verified here. Provider-response parsing, failure handling, and ticker validation were tested with explicit fixtures confined to tests; runtime code has no fixture fallback.
- The computer-use tool reported no available browsers. Visual layout, interactive drawing gestures, fullscreen, and touch behavior still require browser QA. The HTTP smoke check verifies rendering/routes, not those browser interactions.
- `npm audit --omit=dev` reported no production dependency vulnerabilities. The full audit reports three related high-severity findings in the existing Prisma CLI development chain (`prisma` → `@prisma/config` → `deepmerge-ts`). npm proposes a major Prisma upgrade; no forced major upgrade was made. Review that upgrade separately before relying on the development toolchain in an untrusted build environment.
