# MTrade // Institutional Dark-Mode Trading Terminal

An institutional-grade, modern dark-mode cryptocurrency & stock trading dashboard built with **HTML5**, **Tailwind CSS**, and **Vanilla JavaScript**.

---

## 🚀 Key Features

1. **Top Navigation Bar**:
   - Branding with glowing live status indicator.
   - Core exchange tabs: *Markets*, *Spot & Margin*, *Derivatives (50x)*, *Earn*, *Analytics*.
   - Global ticker metrics: 24h BTC volume, gas price tracker, and 99.99% matching engine uptime.
   - Quick search modal trigger (`Ctrl+K`), Deposit CTA button, notification bell, and wallet portfolio balance display.

2. **Pair Header Metrics Ribbon**:
   - Selected market pair selector with token badge icons (e.g. `BTC/USDT`, `ETH/USDT`, `SOL/USDT`).
   - Dynamic real-time mark price with pulse/flash animations on price ticks (green for upward, red for downward).
   - 24h Change, 24h High, 24h Low, 24h Volume (Base), 24h Turnover (Quote), and live 8-hour funding rate countdown.

3. **Left Sidebar (Trading Pairs & Markets)**:
   - Live search input to filter pairs instantly.
   - Category filter pills: *All*, *USDT*, *L1/L2*, *DeFi*.
   - Sortable columns: Pair/Vol, Last Price, 24h %.
   - Clicking any trading pair updates the entire terminal (active price, OHLC chart data, order book, and order panel defaults).

4. **Central Area (Interactive Chart & Positions Drawer)**:
   - Integrated with **TradingView Lightweight Charts** (with automatic fallback to a custom HTML5 Canvas candlestick engine if offline).
   - Timeframe switcher: `1m`, `5m`, `15m`, `1H`, `4H`, `1D`, `1W`.
   - Technical indicator triggers (`MA`, `Vol`), crosshair hover tooltip, and fullscreen mode.
   - Bottom drawer with tabs: *Open Orders*, *Order History*, *Trade History*, and *Assets & Margin*.
   - Interactive Open Orders table with real-time cancel action and "Cancel All" capability.

5. **Right-Side Container (Order Book & Execution Panel)**:
   - **Order Book**: Real-time asks (red) and bids (green) with calculated cumulative totals and background percentage depth bars.
   - **Order Execution Panel**:
     - Buy / Long (Emerald) and Sell / Short (Rose) segmented controls.
     - Limit, Market, and Stop-Limit order type toggles.
     - Quick "Best Ask" / "Best Bid" price filler.
     - Quantity input with dynamic USD equivalent calculation.
     - Preset percentage buttons (`25%`, `50%`, `75%`, `100%`) synchronized with continuous range slider.
     - Estimated taker fee and order value breakdown.
     - Order submission with interactive toast notification and automatic appending to Open Orders.

---

## 📂 File Structure

```
├── index.html     # Semantic dark-mode exchange HTML layout with Tailwind CSS
├── styles.css     # Custom exchange styles, depth bars, scrollbars & keyframe animations
├── app.js         # Reactive market state, charting, order book simulation, order placement
└── README.md      # Documentation & quickstart guide
```

---

## 🖥️ How to Run

Simply open `index.html` in any modern web browser:
- Double-click `index.html` in Windows File Explorer, or
- Serve using any static server (e.g. `npx serve`, Python `python -m http.server`, or VS Code Live Server).
