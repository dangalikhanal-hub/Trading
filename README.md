# Trading

This repository contains the TradeVision Pro trading dashboard and a standalone
static trading-terminal prototype.

## TradeVision Pro (Next.js)

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app includes a
dashboard and email-and-password sign-in, with account creation, at
`/auth/login`.

Configure the **root** application with a local `.env` containing `DATABASE_URL`
(PostgreSQL), a strong random `AUTH_SECRET`, and `AUTH_URL` (for local development,
`http://localhost:3000`). Keep these values out of source control. Apply the
existing migrations with `npx prisma migrate deploy` against your intended
development database before registering an account. The nested `tradevision-pro/`
checkout has independent configuration; the root app does not read its env files.
The current registration flow submits a request for administrator approval at
`/auth/register` before sign-in is available.

Saved watchlists support multiple lists and symbol add/remove/filter operations
using the existing PostgreSQL schema. They require authenticated access. Saved
symbols do not have live quotes yet. The existing sample market browser and trade
preview remain explicitly illustrative; no orders are executed. Wallet resets
affect only the virtual NPR/USDT wallets and create an audit event atomically.

See [the project audit and phased upgrade plan](docs/trading-upgrade-audit.md)
for implementation gaps, priorities, and planned modules. The complete trading
application described there is not yet implemented.

Run the production build with:

```bash
npm run build
```

## Standalone terminal

Open `index.html` in a modern browser to run the static terminal prototype.
Its interface and behavior are implemented in `styles.css`, `app.js`, and
`chart.js`.
