"use client";

import React from "react";

const mockWatchlist = [
  { symbol: "NEPSE", price: 1234.5, change: "+1.2%" },
  { symbol: "BTC/USD", price: 42800, change: "-0.5%" },
  { symbol: "ETH/USD", price: 3100, change: "+0.8%" },
  { symbol: "AAPL", price: 178.2, change: "+0.3%" },
];

export default function MarketWatchlist() {
  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h3 className="text-lg font-semibold mb-2 text-white">Market Watchlist</h3>
      <ul className="space-y-1">
        {mockWatchlist.map((item) => (
          <li key={item.symbol} className="flex justify-between text-sm text-gray-300">
            <span>{item.symbol}</span>
            <span>{item.price}</span>
            <span className={item.change.startsWith("+") ? "text-green-400" : "text-red-400"}>
              {item.change}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
