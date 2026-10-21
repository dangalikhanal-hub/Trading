// src/app/dashboard/header.tsx
"use client";

import { signOut } from "next-auth/react";

export default function DashboardHeader() {
  return (
    <header className="flex items-center justify-between bg-gray-800 p-4">
      <h1 className="text-xl font-bold text-white">TradeVision Pro</h1>
      <button
        onClick={() => signOut({ callbackUrl: "/auth/login" })}
        className="rounded bg-red-600 px-3 py-1 text-sm font-medium hover:bg-red-500"
      >
        Sign Out
      </button>
    </header>
  );
}
