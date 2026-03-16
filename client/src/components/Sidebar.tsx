import { Link, useLocation } from "wouter";
import { LayoutDashboard, CalendarDays, ClipboardList, Cpu, Zap, PackageSearch, Package, HelpCircle, Settings, Wrench, CalendarClock, BarChart2, LogOut, ShieldCheck, Users, Factory, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const navGroups = [
  {
    label: "Tervezés",
    items: [
      { href: "/", icon: LayoutDashboard, label: "Áttekintés" },
      { href: "/gantt", icon: CalendarDays, label: "Gantt ütemterv", badge: "AI" },
      { href: "/import", icon: PackageSearch, label: "Rendelés import" },
    ],
  },
  {
    label: "Gyártás",
    items: [
      { href: "/orders", icon: ClipboardList, label: "Rendelések" },
      { href: "/products", icon: Package, label: "Termékek" },
      { href: "/machines", icon: Cpu, label: "Gépek" },
      { href: "/molds", icon: Wrench, label: "Szerszámok" },
      { href: "/maintenance", icon: CalendarClock, label: "Karbantartás" },
      { href: "/floor", icon: Factory, label: "Gyárpadló nézet" },
    ],
  },
  {
    label: "Elemzés",
    items: [
      { href: "/reports", icon: BarChart2, label: "Riportok" },
      { href: "/team", icon: Users, label: "Csapattagok" },
    ],
  },
];

interface SidebarProps {
  companyName?: string;
  userName?: string;
  onLogout?: () => void;
  onAdmin?: () => void;
  onNavClick?: () => void;
}

export default function Sidebar({ companyName: propCompanyName, userName, onLogout, onAdmin, onNavClick }: SidebarProps) {
  const [location] = useLocation();
  const { data: settings } = useQuery<{ companyName: string; plantName: string }>({ queryKey: ["/api/settings"] });
  const companyName = propCompanyName || settings?.companyName?.trim() || "ProdAI";
  const isCustom = !!settings?.companyName?.trim() && settings.companyName.trim() !== "ProdAI Kft.";

  return (
    <aside className="sidebar flex flex-col h-full" style={{
      background: "linear-gradient(180deg, #0f172a 0%, #0c1525 60%, #091020 100%)",
      borderRight: "1px solid rgba(99,179,237,0.12)",
    }}>

      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-3" style={{ borderBottom: "1px solid rgba(99,179,237,0.1)" }}>
        {/* Animated SVG logo */}
        <div className="relative flex-shrink-0">
          <svg aria-label="ProdAI logo" width="34" height="34" viewBox="0 0 34 34" fill="none">
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <polygon points="17,2 30,9.5 30,24.5 17,32 4,24.5 4,9.5"
              stroke="url(#logoGrad)" strokeWidth="1.5" fill="rgba(56,189,248,0.07)" filter="url(#glow)" />
            <circle cx="17" cy="17" r="3" fill="url(#logoGrad)" />
            <line x1="17" y1="9" x2="17" y2="14" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="17" y1="20" x2="17" y2="25" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9" y1="17" x2="14" y2="17" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="20" y1="17" x2="25" y2="17" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="17" cy="9" r="1.5" fill="#38bdf8" opacity="0.7" />
            <circle cx="17" cy="25" r="1.5" fill="#6366f1" opacity="0.7" />
            <circle cx="9" cy="17" r="1.5" fill="#38bdf8" opacity="0.7" />
            <circle cx="25" cy="17" r="1.5" fill="#6366f1" opacity="0.7" />
          </svg>
          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ background: "radial-gradient(circle, #38bdf8 0%, transparent 70%)", animationDuration: "3s" }} />
        </div>
        <div className="min-w-0">
          <div className="font-bold tracking-tight text-sm leading-none text-white">
            {isCustom ? companyName : "ProdAI"}
          </div>
          <div className="text-xs mt-1" style={{ color: "rgba(148,163,184,0.7)" }}>
            {isCustom
              ? <span>by <span className="font-semibold" style={{ color: "#38bdf8" }}>ProdAI</span></span>
              : <span className="font-medium" style={{ color: "#38bdf8" }}>Termeléstervező</span>
            }
          </div>
        </div>
      </div>

      {/* AI Status pill */}
      <div className="mx-3 mt-3 mb-2 rounded-xl px-3 py-2 flex items-center gap-2"
        style={{ background: "linear-gradient(90deg, rgba(56,189,248,0.12) 0%, rgba(99,102,241,0.10) 100%)", border: "1px solid rgba(56,189,248,0.2)" }}>
        <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" style={{ boxShadow: "0 0 6px #34d399" }} />
        <span className="text-xs font-semibold" style={{ color: "#7dd3fc" }}>AI motor aktív</span>
        <Zap size={11} className="ml-auto" style={{ color: "#38bdf8" }} />
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto" role="navigation" aria-label="Fő navigáció">
        {navGroups.map(group => (
          <div key={group.label} className="mb-4">
            <div className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "rgba(148,163,184,0.45)", letterSpacing: "0.12em" }}>
              {group.label}
            </div>
            {group.items.map(({ href, icon: Icon, label, badge }: any) => {
              const active = location === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavClick}
                  data-testid={`nav-${label}`}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 text-sm font-medium transition-all duration-150 group relative ${
                    active ? "text-white" : "hover:text-white"
                  }`}
                  style={active ? {
                    background: "linear-gradient(90deg, rgba(56,189,248,0.18) 0%, rgba(99,102,241,0.12) 100%)",
                    border: "1px solid rgba(56,189,248,0.25)",
                    color: "#fff",
                  } : {
                    color: "rgba(148,163,184,0.8)",
                    border: "1px solid transparent",
                  }}
                >
                  {/* Active left bar */}
                  {active && (
                    <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
                      style={{ background: "linear-gradient(180deg, #38bdf8, #6366f1)" }} />
                  )}
                  <Icon size={15} strokeWidth={active ? 2.5 : 1.8}
                    style={{ color: active ? "#38bdf8" : undefined, flexShrink: 0 }} />
                  <span className="flex-1 truncate">{label}</span>
                  {badge && !active && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{ background: "rgba(56,189,248,0.15)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.25)" }}>
                      {badge}
                    </span>
                  )}
                  {active && <ChevronRight size={12} style={{ color: "#38bdf8", opacity: 0.7 }} />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Beállítások + Súgó */}
      <div className="px-2 pb-2" style={{ borderTop: "1px solid rgba(99,179,237,0.08)" }}>
        <div className="pt-2 space-y-0.5">
          {[
            { href: "/help", icon: HelpCircle, label: "Súgó" },
            { href: "/settings", icon: Settings, label: "Beállítások" },
          ].map(({ href, icon: Icon, label }) => {
            const active = location === href;
            return (
              <Link key={href} href={href} data-testid={`nav-${label}`}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ color: active ? "#fff" : "rgba(148,163,184,0.6)",
                  background: active ? "rgba(56,189,248,0.1)" : "transparent" }}
              >
                <Icon size={15} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* User + logout */}
      {(userName || onLogout) && (
        <div className="px-3 py-3" style={{ borderTop: "1px solid rgba(99,179,237,0.1)" }}>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs text-white"
              style={{ background: "linear-gradient(135deg, #38bdf8, #6366f1)" }}>
              {userName ? userName[0].toUpperCase() : "U"}
            </div>
            <span className="text-xs font-medium truncate flex-1" style={{ color: "rgba(226,232,240,0.85)" }}>
              {userName || "Felhasználó"}
            </span>
          </div>
          {onAdmin && (
            <button onClick={onAdmin}
              className="flex items-center gap-2 w-full px-3 py-1.5 rounded-xl text-xs font-semibold transition-all mb-1"
              style={{ color: "#c084fc", background: "rgba(192,132,252,0.08)", border: "1px solid rgba(192,132,252,0.15)" }}>
              <ShieldCheck size={13} />
              <span>Admin panel</span>
            </button>
          )}
          {onLogout && (
            <button onClick={onLogout}
              className="flex items-center gap-2 w-full px-3 py-1.5 rounded-xl text-xs transition-all"
              style={{ color: "rgba(148,163,184,0.6)" }}>
              <LogOut size={13} />
              <span>Kijelentkezés</span>
            </button>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2.5" style={{ borderTop: "1px solid rgba(99,179,237,0.07)" }}>
        <p className="text-[10px]" style={{ color: "rgba(148,163,184,0.35)" }}>
          <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer"
            className="hover:opacity-60 transition-opacity">
            Created with Perplexity Computer
          </a>
        </p>
      </div>
    </aside>
  );
}
