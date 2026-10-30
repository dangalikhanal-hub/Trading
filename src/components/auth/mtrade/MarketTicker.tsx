"use client";

import { useEffect, useState } from "react";

type Ticker = {
  symbol: string;
  price: number;
  change: number;
};

const initialTickers: Ticker[] = [
  { symbol: "SPY", price: 548.32, change: 0.42 },
  { symbol: "QQQ", price: 472.18, change: 0.67 },
  { symbol: "NVDA", price: 124.88, change: 1.92 },
  { symbol: "AAPL", price: 228.14, change: -0.31 },
  { symbol: "BTC/USD", price: 68432.8, change: 2.14 },
  { symbol: "VIX", price: 13.42, change: -1.28 },
  { symbol: "DXY", price: 104.21, change: 0.12 },
];

function money(value: number, digits = 2) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function TickerGroup({ tickers, hidden }: { tickers: Ticker[]; hidden?: boolean }) {
  return (
    <div className="mtx-ticker-group" aria-hidden={hidden || undefined}>
      {tickers.map((item) => (
        <div className="mtx-ticker-item" key={item.symbol}>
          <span className="mtx-ticker-symbol">{item.symbol}</span>
          <span className="mtx-ticker-price">{money(item.price)}</span>
          <span className={`mtx-ticker-change ${item.change >= 0 ? "mtx-up" : "mtx-down"}`}>
            {item.change >= 0 ? "+" : ""}
            {item.change.toFixed(2)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export default function MarketTicker() {
  const [tickers, setTickers] = useState<Ticker[]>(initialTickers);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTickers((current) =>
        current.map((item) => {
          const drift = (Math.random() - 0.48) * item.price * 0.0007;
          const price = Math.max(1, item.price + drift);
          const change = Math.max(-9.99, Math.min(9.99, item.change + (Math.random() - 0.5) * 0.08));
          return { ...item, price, change };
        }),
      );
    }, 2200);

    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="mtx-ticker-window min-w-0 flex-1 overflow-hidden">
      <div className="mtx-ticker-track">
        <TickerGroup tickers={tickers} />
        <TickerGroup tickers={tickers} hidden />
      </div>
    </div>
  );
}
