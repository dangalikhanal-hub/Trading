"use client";

import React from "react";

export default function IndicatorPanel() {
  return (
    <div className="bg-gray-800 p-4 rounded-lg mt-4">
      <h3 className="text-lg font-semibold text-white mb-2">Indicators</h3>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-700 p-2 rounded text-sm text-gray-200">MA (20)</div>
        <div className="bg-gray-700 p-2 rounded text-sm text-gray-200">RSI</div>
        <div className="bg-gray-700 p-2 rounded text-sm text-gray-200">Bollinger Bands</div>
        <div className="bg-gray-700 p-2 rounded text-sm text-gray-200">MACD</div>
      </div>
    </div>
  );
}
