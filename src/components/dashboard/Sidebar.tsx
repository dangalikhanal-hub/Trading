"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const menuItems = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "NEPSE", href: "/dashboard/nepse" },
  { name: "Crypto", href: "/dashboard/crypto" },
  { name: "Chart Analysis", href: "/dashboard/chart-analysis" },
  { name: "AI Strategies", href: "/dashboard/ai-strategies" },
  { name: "Paper Trading", href: "/dashboard/paper-trading" },
  { name: "Portfolio", href: "/dashboard/portfolio" },
  { name: "Trade History", href: "/dashboard/trade-history" },
  { name: "Settings", href: "/dashboard/settings" },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between bg-gray-800 p-2 text-white">
        <button onClick={() => setOpen(!open)} aria-label="Toggle menu">
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
        <span className="font-semibold">TradeVision Pro</span>
      </div>

      {/* Overlay for mobile when sidebar is open */}
      {open && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 bg-gray-900 text-gray-100 w-64 transform ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:static md:inset-0 transition-transform duration-200 ease-in-out z-40`}
      >
        <div className="h-full flex flex-col p-4">
          <h2 className="text-xl font-bold mb-6 text-center">TradeVision Pro</h2>
          <nav className="flex-1 space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="block px-3 py-2 rounded hover:bg-gray-700"
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
