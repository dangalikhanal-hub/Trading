"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { ArrowUpRight, LogOut, ShieldCheck, UserCheck } from "lucide-react";

export default function DashboardHeader({ role }: { role?: string }) {
  const pathname = usePathname();
  if (pathname === "/dashboard") return null;
  return (
    <header className="tv-header">
      <Link href="/dashboard" className="tv-brand">
        <span className="tv-brand-mark">
          <ArrowUpRight size={22} strokeWidth={2.4} />
        </span>
        <span>
          M<span className="tv-brand-pro">TRADE</span>
        </span>
      </Link>
      <div className="tv-header-right">
        {role === "ADMIN" && (
          <Link href="/dashboard/admin" className="tv-admin-link">
            <UserCheck size={15} />
            <span>Registrations</span>
          </Link>
        )}
        <span className="tv-environment">
          <ShieldCheck size={14} /> Paper trading
        </span>
        <span className="tv-header-divider" />
        <button onClick={() => signOut({ redirectTo: "/auth/login" })} className="tv-signout">
          <LogOut size={15} />
          <span>Sign out</span>
        </button>
        <span className="tv-avatar" aria-hidden="true">T</span>
      </div>
    </header>
  );
}
