"use client";

import { signOut } from "next-auth/react";
import { ArrowUpRight, LogOut, ShieldCheck, UserCheck } from "lucide-react";

export default function DashboardHeader({ role }: { role?: string }) {
  return <header className="tv-header"><a href="/dashboard" className="tv-brand"><span className="tv-brand-mark"><ArrowUpRight size={22} strokeWidth={2.4} /></span><span>tradevision<span className="tv-brand-pro">PRO</span></span></a><div className="tv-header-right">{role === "ADMIN" && <a href="/dashboard/admin" className="tv-admin-link"><UserCheck size={15} /><span>Registrations</span></a>}<span className="tv-environment"><ShieldCheck size={14} /> Paper trading</span><span className="tv-header-divider" /><button onClick={() => signOut({ callbackUrl: "/auth/login" })} className="tv-signout"><LogOut size={15} /><span>Sign out</span></button><span className="tv-avatar" aria-hidden="true">T</span></div></header>;
}
