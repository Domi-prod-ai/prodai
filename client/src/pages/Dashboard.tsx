import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Brain, TrendingUp, AlertTriangle, CheckCircle2, Clock, Zap, ChevronRight, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { Machine, Order, AiSuggestion } from "@shared/schema";

function KpiCard({ label, value, sub, trend }: { label: string; value: string | number; sub?: string; trend?: "up" | "down" | "flat" }) {
  return (
    <div className="bg-white border border-border rounded-xl p-4 shadow-sm" data-testid={`kpi-${label}`}>
      <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wide font-medium">{label}</div>
      <div className="text-2xl font-bold text-foreground tabular-nums count-animate">{value}</div>
      {sub && (
        <div className="flex items-center gap-1 mt-1">
          {trend === "up" && <ArrowUpRight size={12} className="text-green-600" />}
          {trend === "down" && <ArrowDownRight size={12} className="text-red-600" />}
          {trend === "flat" && <Minus size={12} className="text-muted-foreground" />}
          <span className="text-xs text-muted-foreground">{sub}</span>
        </div>
      )}
    </div>
  );
}

function SuggestionCard({ s, onResolve }: { s: AiSuggestion; onResolve: (id: number) => void }) {
  const colorMap = {
    bottleneck: { bg: "bg-red-50 border-red-200", icon: <AlertTriangle size={14} className="text-red-600" />, label: "text-red-700" },
    optimization: { bg: "bg-green-50 border-green-200", icon: <TrendingUp size={14} className="text-green-600" />, label: "text-green-700" },
    warning: { bg: "bg-amber-50 border-amber-200", icon: <AlertTriangle size={14} className="text-amber-600" />, label: "text-amber-700" },
    info: { bg: "bg-blue-50 border-blue-200", icon: <Brain size={14} className="text-blue-600" />, label: "text-blue-700" },
  };
  const style = colorMap[s.type as keyof typeof colorMap] || colorMap.info;

  return (
    <div className={`rounded-lg border p-3 ${style.bg} ${s.resolved ? "opacity-40" : ""}`} data-testid={`suggestion-${s.id}`}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex-shrink-0">{style.icon}</span>
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-semibold ${style.label}`}>{s.title}</div>
          <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.description}</div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
              s.impact === "high" ? "bg-red-100 text-red-700" :
              s.impact === "medium" ? "bg-amber-100 text-amber-700" :
              "bg-muted text-muted-foreground"
            }`}>
              {s.impact === "high" ? "Magas hatás" : s.impact === "medium" ? "Közepes hatás" : "Alacsony hatás"}
            </span>
            {!s.resolved && (
              <button
                onClick={() => onResolve(s.id)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
                data-testid={`resolve-suggestion-${s.id}`}
              >
                Megoldva
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { toast } = useToast();

  const { data: machines = [] } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });
  const { data: orders = [] } = useQuery<Order[]>({ queryKey: ["/api/orders"] });
  const { data: suggestions = [], isLoading: suggestionsLoading } = useQuery<AiSuggestion[]>({ queryKey: ["/api/ai-suggestions"] });

  const autoPlan = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ai/auto-plan"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-suggestions"] });
      toast({ title: "AI ütemezés kész", description: "Az ütemterv optimalizálva lett a rendelések prioritása alapján." });
    },
  });

  const resolveSuggestion = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/ai-suggestions/${id}/resolve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ai-suggestions"] }),
  });

  // KPI calculations
  const onlineMachines = machines.filter(m => m.status === "online").length;
  const avgUtilization = machines.length
    ? Math.round(machines.filter(m => m.status === "online").reduce((s, m) => s + m.utilization, 0) / (onlineMachines || 1))
    : 0;
  const urgentOrders = orders.filter(o => o.priority === "urgent").length;
  const inProgressOrders = orders.filter(o => o.status === "in_progress").length;
  const pendingOrders = orders.filter(o => o.status === "pending").length;
  const unresolvedSuggestions = suggestions.filter(s => !s.resolved).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Termelési áttekintés</h1>
          <p className="text-sm text-muted-foreground mt-0.5">2026. március 15. · Vasárnap</p>
        </div>
        <button
          onClick={() => autoPlan.mutate()}
          disabled={autoPlan.isPending}
          data-testid="btn-auto-plan"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 shadow-sm"
        >
          <Zap size={14} />
          {autoPlan.isPending ? "AI tervez..." : "AI auto-ütemezés"}
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Online gépek" value={`${onlineMachines}/${machines.length}`} sub="Karbantartás alatt: 1" trend="flat" />
        <KpiCard label="Átl. kihasználtság" value={`${avgUtilization}%`} sub="Célérték: 80%" trend={avgUtilization > 80 ? "up" : "down"} />
        <KpiCard label="Aktív rendelések" value={inProgressOrders + pendingOrders} sub={`${urgentOrders} sürgős`} trend={urgentOrders > 0 ? "down" : "flat"} />
        <KpiCard label="AI javaslatok" value={unresolvedSuggestions} sub="Megoldásra vár" trend={unresolvedSuggestions > 2 ? "down" : "flat"} />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Machine status */}
        <div className="lg:col-span-2 bg-white border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Gép állapot</h2>
            <a href="#/machines" className="text-xs text-accent hover:underline flex items-center gap-1">
              Részletek <ChevronRight size={12} />
            </a>
          </div>
          <div className="space-y-3">
            {machines.map(m => (
              <div key={m.id} className="flex items-center gap-3" data-testid={`machine-row-${m.id}`}>
                <span className={`status-dot ${m.status === "online" ? "status-online" : m.status === "maintenance" ? "status-maintenance" : "status-offline"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-foreground font-medium truncate">{m.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums ml-2">
                      {m.status === "maintenance" ? "Karbantartás" : `${m.utilization}%`}
                    </span>
                  </div>
                  <div className="util-bar-bg w-full">
                    <div
                      className="util-bar"
                      style={{
                        width: `${m.utilization}%`,
                        background: m.utilization > 85 ? "#d05252" : m.utilization > 65 ? "#e8a135" : "#4d9e5a",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Suggestions */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Brain size={14} className="text-primary ai-pulse" />
            <h2 className="text-sm font-semibold text-foreground">AI javaslatok</h2>
            {unresolvedSuggestions > 0 && (
              <span className="ml-auto bg-primary/10 text-primary text-xs font-bold px-1.5 py-0.5 rounded">
                {unresolvedSuggestions}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {suggestionsLoading && (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="skeleton h-16 w-full" />)}
              </div>
            )}
            {suggestions.filter(s => !s.resolved).map(s => (
              <SuggestionCard key={s.id} s={s} onResolve={id => resolveSuggestion.mutate(id)} />
            ))}
            {!suggestionsLoading && suggestions.filter(s => !s.resolved).length === 0 && (
              <div className="flex flex-col items-center py-6 text-center">
                <CheckCircle2 size={24} className="text-green-600 mb-2" />
                <p className="text-sm text-muted-foreground">Minden javaslat megoldva</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-white border border-border rounded-xl shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Legutóbbi rendelések</h2>
          <a href="#/orders" className="text-xs text-accent hover:underline flex items-center gap-1">
            Mind <ChevronRight size={12} />
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium uppercase tracking-wide">Rendelésszám</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium uppercase tracking-wide">Mennyiség</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium uppercase tracking-wide">Prioritás</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium uppercase tracking-wide">Határidő</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium uppercase tracking-wide">Státusz</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 5).map(o => (
                <tr key={o.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`order-row-${o.id}`}>
                  <td className="px-4 py-3 font-mono text-xs text-foreground tabular-nums">{o.orderNumber}</td>
                  <td className="px-4 py-3 tabular-nums text-foreground">{o.quantity} db</td>
                  <td className="px-4 py-3">
                    <span className={`priority-${o.priority} text-xs font-semibold px-2 py-0.5 rounded-full`}>
                      {o.priority === "urgent" ? "Sürgős" : o.priority === "high" ? "Magas" : o.priority === "normal" ? "Normál" : "Alacsony"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs tabular-nums">{o.dueDate}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`status-dot ${
                        o.status === "done" ? "status-online" :
                        o.status === "in_progress" ? "status-maintenance" :
                        o.status === "planned" ? "status-online" :
                        "status-offline"
                      }`} />
                      <span className="text-xs text-muted-foreground">
                        {o.status === "done" ? "Kész" : o.status === "in_progress" ? "Folyamatban" : o.status === "planned" ? "Tervezett" : "Függőben"}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
