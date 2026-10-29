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

Run the production build with:

```bash
npm run build
```

## Standalone terminal

Open `index.html` in a modern browser to run the static terminal prototype.
Its interface and behavior are implemented in `styles.css`, `app.js`, and
`chart.js`.
