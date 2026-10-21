"use client";

import React from "react";

interface Wallet {
  currency: string;
  balance: string; // Prisma returns string for Decimal
}

interface Props {
  wallets: Wallet[];
}

export default function AccountSummary({ wallets }: Props) {
  const nprWallet = wallets.find((w) => w.currency === "NPR");
  const usdtWallet = wallets.find((w) => w.currency === "USDT");

  return (
    <div className="bg-gray-800 p-4 rounded-lg mb-4 text-white">
      <h3 className="text-lg font-semibold mb-2">Virtual Accounts</h3>
      <ul className="space-y-1 text-sm">
        <li>NPR Balance: {nprWallet ? nprWallet.balance : "—"}</li>
        <li>USDT Balance: {usdtWallet ? usdtWallet.balance : "—"}</li>
      </ul>
    </div>
  );
}
