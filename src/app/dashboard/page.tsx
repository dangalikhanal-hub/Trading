"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import MarketWatchlist from "@/components/dashboard/MarketWatchlist";
import ChartPlaceholder from "@/components/dashboard/ChartPlaceholder";
import IndicatorPanel from "@/components/dashboard/IndicatorPanel";
import AccountSummary from "@/components/dashboard/AccountSummary";
import BuySellControls from "@/components/dashboard/BuySellControls";
import ResetWalletButton from "@/components/dashboard/ResetWalletButton";

interface Wallet {
  id: string;
  currency: string;
  balance: string;
}

export default function DashboardPage() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWallets = async () => {
      try {
        const res = await fetch("/api/wallet");
        if (!res.ok) throw new Error("Failed to load wallets");
        const data = await res.json();
        setWallets(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchWallets();
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 p-4 overflow-y-auto">
        {/* Top-level sections */}
        {loading ? (
          <div className="text-center py-8">Loading wallets...</div>
        ) : (
          <>
            <AccountSummary wallets={wallets} />
            <ResetWalletButton />
          </>
        )}
        <MarketWatchlist />
        <ChartPlaceholder />
        <IndicatorPanel />
        <BuySellControls />
      </main>
    </div>
  );
}
