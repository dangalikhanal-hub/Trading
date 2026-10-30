"use client";

import { useState } from "react";
import { LayoutDashboard, ChartNoAxesCombined, Wallet, BookOpen, ArrowUpRight, Menu, X, FlaskConical } from "lucide-react";

const items = [
  { name: "Overview", href: "#overview", icon: LayoutDashboard },
  { name: "Practice terminal", href: "/dashboard/practice", icon: FlaskConical },
  { name: "Markets", href: "#markets", icon: ChartNoAxesCombined },
  { name: "Saved watchlists", href: "#saved-watchlists", icon: BookOpen },
  { name: "My wallets", href: "#wallets", icon: Wallet },
  { name: "Trade preview", href: "#practice", icon: FlaskConical },
  { name: "Learning", href: "#activity", icon: BookOpen },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("Overview");
  return <><button className="tv-mobile-menu" aria-expanded={open} aria-controls="dashboard-navigation" aria-label={open ? "Close navigation" : "Open navigation"} onClick={() => setOpen(!open)}>{open ? <X size={19} /> : <Menu size={19} />}</button>{open && <button className="tv-sidebar-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <aside className={`tv-sidebar ${open ? "open" : ""}`} id="dashboard-navigation"><div className="tv-sidebar-label">WORKSPACE</div><nav aria-label="Dashboard">{items.map(item => <a key={item.name} href={item.href} className={active === item.name ? "active" : ""} aria-current={active === item.name ? "location" : undefined} onClick={() => { setActive(item.name); setOpen(false); }}><item.icon size={17} /><span>{item.name}</span>{active === item.name && <span className="tv-nav-dot" />}</a>)}</nav><div className="tv-sidebar-bottom"><div className="tv-sidebar-tip"><span className="tv-tip-icon">↗</span><strong>Practice with purpose.</strong><p>Find your rhythm without risking real funds.</p><a href="#practice" onClick={() => setOpen(false)}>Start exploring <ArrowUpRight size={14} /></a></div><div className="tv-sidebar-status"><span className="tv-dot" /> Demo workspace <small>v1.0</small></div></div></aside>
  </>;
}
