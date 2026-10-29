"use client";

import React from "react";

export default function BuySellControls() {
  return (
    <div className="bg-gray-800 p-4 rounded-lg mt-4 text-center text-white">
      <h3 className="text-lg font-semibold mb-2">Demo Trading Controls</h3>
      <div className="flex justify-center space-x-4">
        <button className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md transition">
          Buy
        </button>
        <button className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md transition">
          Sell
        </button>
      </div>
    </div>
  );
}
