import { Link, useLocation } from "wouter";
import { LayoutDashboard, CalendarDays, ClipboardList, Cpu, Zap, PackageSearch, Package, HelpCircle, Settings, Wrench, CalendarClock, BarChart2, LogOut, ShieldCheck, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Áttekintés" },
  { href: "/import", icon: PackageSearch, label: "Rendelés import", highlight: true },
  { href: "/gantt", icon: CalendarDays, label: "Gantt ütemterv" },
  { href: "/orders", icon: ClipboardList, label: "Rendelések" },
  { href: "/products", icon: Package, label: "Termékek" },
  { href: "/machines", icon: Cpu, label: "Gépek" },
  { href: "/molds", icon: Wrench, label: "Szerszámok" },
  { href: "/maintenance", icon: CalendarClock, label: "Karbantartás" },
  { href: "/reports", icon: BarChart2, label: "Riportok" },
  { href: "/team", icon: Users, label: "Csapattagok" },
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
    <aside className="sidebar bg-white flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border flex items-center gap-3">
        <svg aria-label="ProdAI logo" width="32" height="32" viewBox="0 0 32 32" fill="none" className="flex-shrink-0">
          <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" stroke="hsl(206 70% 40%)" strokeWidth="2" fill="hsl(206 70% 40% / 0.10)" />
          <line x1="10" y1="16" x2="22" y2="16" stroke="hsl(206 70% 40%)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="16" y1="10" x2="16" y2="22" stroke="hsl(206 70% 40%)" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="16" cy="16" r="2.5" fill="hsl(206 70% 40%)" />
          <circle cx="10" cy="16" r="1.5" fill="hsl(206 70% 40% / 0.6)" />
          <circle cx="22" cy="16" r="1.5" fill="hsl(206 70% 40% / 0.6)" />
          <circle cx="16" cy="10" r="1.5" fill="hsl(206 70% 40% / 0.6)" />
          <circle cx="16" cy="22" r="1.5" fill="hsl(206 70% 40% / 0.6)" />
        </svg>
        <div className="min-w-0">
          <div className="font-bold text-foreground tracking-tight text-sm leading-none truncate">
            {isCustom ? companyName : "ProdAI"}
          </div>
          <div className="text-muted-foreground text-xs mt-0.5">
            {isCustom
              ? <span>by <span className="text-primary font-semibold">ProdAI</span></span>
              : "Termeléstervező"
            }
          </div>
        </div>
      </div>

      {/* AI Status */}
      <div className="mx-3 mt-3 mb-1 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 flex items-center gap-2">
        <span className="status-dot status-online ai-pulse" />
        <span className="text-xs text-blue-700 font-medium">AI motor aktív</span>
        <Zap size={12} className="text-blue-500 ml-auto" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3" role="navigation" aria-label="Fő navigáció">
        {navItems.map(({ href, icon: Icon, label, highlight }) => {
          const active = location === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavClick}
              data-testid={`nav-${label}`}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-all ${
                active
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : highlight
                  ? "text-foreground hover:bg-primary/5 border border-primary/15 bg-primary/[0.03]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 2} />
              <span className="flex-1">{label}</span>
              {highlight && !active && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">AI</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Alap menüpontok (Súgó + Beállítások) */}
      <div className="px-2 pb-2 space-y-0.5">
        {[
          { href: "/help", icon: HelpCircle, label: "Súgó" },
          { href: "/settings", icon: Settings, label: "Beállítások" },
        ].map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            data-testid={`nav-${label}`}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              location === href
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Icon size={16} strokeWidth={location === href ? 2.5 : 2} />
            <span className="flex-1">{label}</span>
          </Link>
        ))}
      </div>

      {/* Felhasznalo + Kijelentkezes */}
      {(userName || onLogout) && (
        <div className="px-3 py-3 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-primary">{userName ? userName[0].toUpperCase() : "U"}</span>
            </div>
            <span className="text-xs font-medium text-slate-700 truncate flex-1">{userName || "Felhasznalo"}</span>
          </div>
          {onAdmin && (
            <button
              onClick={onAdmin}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-purple-600 hover:bg-purple-50 transition-all font-medium"
            >
              <ShieldCheck size={14} />
              <span>Admin panel</span>
            </button>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-all"
            >
              <LogOut size={14} />
              <span>Kijelentkezés</span>
            </button>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-xs text-muted-foreground">
          <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
            Created with Perplexity Computer
          </a>
        </p>
      </div>
    </aside>
  );
}
