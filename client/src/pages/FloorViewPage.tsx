import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Cpu, Clock, Package, CheckCircle2, AlertTriangle, PlayCircle, RefreshCw, Factory } from "lucide-react";
import type { Task, Machine, Order, Product } from "@shared/schema";

const STATUS_CONFIG: Record<string, { label: string; bg: string; border: string; icon: any; textColor: string }> = {
  in_progress: { label: "Folyamatban", bg: "bg-blue-50", border: "border-blue-400", icon: PlayCircle, textColor: "text-blue-700" },
  planned:     { label: "Tervezett",   bg: "bg-slate-50", border: "border-slate-300", icon: Clock,        textColor: "text-slate-600" },
  done:        { label: "Kész",        bg: "bg-green-50", border: "border-green-400", icon: CheckCircle2,  textColor: "text-green-700" },
  delayed:     { label: "Késedelmes",  bg: "bg-red-50",   border: "border-red-400",   icon: AlertTriangle, textColor: "text-red-700"   },
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high:   "bg-orange-100 text-orange-700",
  normal: "bg-blue-100 text-blue-700",
  low:    "bg-slate-100 text-slate-500",
};
const PRIORITY_HU: Record<string, string> = {
  urgent: "Sürgős", high: "Magas", normal: "Normál", low: "Alacsony",
};

function timeLeft(endTime: string): string {
  const now = new Date();
  const end = new Date(endTime);
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return "Lejárt";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} perc`;
}

function progressPercent(startTime: string, endTime: string): number {
  const now = new Date().getTime();
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (now >= end) return 100;
  if (now <= start) return 0;
  return Math.round(((now - start) / (end - start)) * 100);
}

export default function FloorViewPage() {
  const { data: tasks = [], isLoading, refetch, isFetching } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    queryFn: () => apiRequest("GET", "/api/tasks").then(r => r.json()),
    refetchInterval: 30000, // 30 másodpercenként auto-frissítés
  });
  const { data: machines = [] } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });
  const { data: orders = [] } = useQuery<Order[]>({ queryKey: ["/api/orders"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const now = new Date();

  // Aktív (folyamatban) feladatok először, aztán tervezett, aztán késedelmes
  const activeTasks = tasks.filter(t => t.status === "in_progress");
  const plannedSoon = tasks
    .filter(t => t.status === "planned" && new Date(t.startTime) <= new Date(now.getTime() + 8 * 3600000))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const delayedTasks = tasks.filter(t => t.status === "delayed" || (t.status !== "done" && new Date(t.endTime) < now));

  const getMachine = (id: number) => machines.find(m => m.id === id);
  const getOrder   = (id: number) => orders.find(o => o.id === id);
  const getProduct = (id: number) => products.find(p => p.id === id);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Factory size={20} className="text-blue-400" />
          <div>
            <h1 className="font-bold text-base text-white">Gyárpadló nézet</h1>
            <p className="text-xs text-slate-400">Auto-frissítés: 30 mp</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition"
        >
          <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
          Frissítés
        </button>
      </div>

      <div className="p-4 space-y-6 max-w-2xl mx-auto">

        {/* Összesítő stat sáv */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Folyamatban", value: activeTasks.length, color: "text-blue-400" },
            { label: "Hamarosan", value: plannedSoon.length, color: "text-slate-300" },
            { label: "Késedelmes", value: delayedTasks.length, color: "text-red-400" },
            { label: "Gépek", value: machines.filter(m => m.status === "online").length, color: "text-green-400" },
          ].map(s => (
            <div key={s.label} className="bg-slate-800 rounded-xl p-3 text-center border border-slate-700">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Folyamatban lévő feladatok */}
        <section>
          <h2 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <PlayCircle size={13} /> Most gyártás alatt ({activeTasks.length})
          </h2>
          {activeTasks.length === 0 ? (
            <div className="bg-slate-800 rounded-xl p-6 text-center text-slate-500 border border-slate-700">
              Jelenleg nincs aktív gyártás
            </div>
          ) : (
            <div className="space-y-3">
              {activeTasks.map(task => {
                const machine = getMachine(task.machineId);
                const order = getOrder(task.orderId);
                const product = getProduct(task.productId);
                const pct = progressPercent(task.startTime, task.endTime);
                const tLeft = timeLeft(task.endTime);
                return (
                  <div key={task.id} className="bg-slate-800 border border-blue-500/50 rounded-2xl p-4 shadow-lg shadow-blue-900/20">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-bold text-white text-base">{machine?.name || "Gép"}</div>
                        <div className="text-sm text-slate-300 mt-0.5">{product?.name || "-"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-400">{pct}%</div>
                        <div className="text-xs text-slate-400">kész</div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-slate-700 rounded-full h-2.5 mb-3">
                      <div
                        className="bg-blue-500 h-2.5 rounded-full transition-all duration-1000"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Package size={11} />
                        <span>{task.quantity} db · {order?.orderNumber || "-"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock size={11} />
                        <span className={tLeft === "Lejárt" ? "text-red-400 font-semibold" : "text-slate-300"}>
                          {tLeft} hátra
                        </span>
                      </div>
                    </div>
                    {order && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[order.priority] || "bg-slate-700 text-slate-300"}`}>
                          {PRIORITY_HU[order.priority] || order.priority}
                        </span>
                        <span className="text-xs text-slate-500">Határidő: {new Date(order.dueDate).toLocaleDateString("hu-HU")}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Késedelmes feladatok */}
        {delayedTasks.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <AlertTriangle size={13} /> Késedelmes ({delayedTasks.length})
            </h2>
            <div className="space-y-2">
              {delayedTasks.map(task => {
                const machine = getMachine(task.machineId);
                const order = getOrder(task.orderId);
                const product = getProduct(task.productId);
                return (
                  <div key={task.id} className="bg-slate-800 border border-red-500/40 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white text-sm">{machine?.name || "Gép"}</div>
                        <div className="text-xs text-slate-400">{product?.name} · {order?.orderNumber}</div>
                      </div>
                      <div className="text-xs text-red-400 font-semibold">
                        {new Date(task.endTime).toLocaleDateString("hu-HU")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Következő 8 órában induló feladatok */}
        {plannedSoon.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock size={13} /> Hamarosan indul ({plannedSoon.length})
            </h2>
            <div className="space-y-2">
              {plannedSoon.map(task => {
                const machine = getMachine(task.machineId);
                const order = getOrder(task.orderId);
                const product = getProduct(task.productId);
                const startsIn = Math.round((new Date(task.startTime).getTime() - now.getTime()) / 60000);
                return (
                  <div key={task.id} className="bg-slate-800 border border-slate-600 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white text-sm">{machine?.name || "Gép"}</div>
                        <div className="text-xs text-slate-400">{product?.name} · {task.quantity} db</div>
                      </div>
                      <div className="text-xs text-slate-300 text-right">
                        <div>{startsIn <= 0 ? "Most" : `${startsIn} perc múlva`}</div>
                        <div className="text-slate-500">{new Date(task.startTime).toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" })}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Gép státuszok */}
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Cpu size={13} /> Gép állapotok
          </h2>
          <div className="grid grid-cols-1 gap-2">
            {machines.map(m => {
              const currentTask = tasks.find(t => t.machineId === m.id && t.status === "in_progress");
              const product = currentTask ? getProduct(currentTask.productId) : null;
              const statusDot = m.status === "online" ? "bg-green-400" : m.status === "maintenance" ? "bg-amber-400" : "bg-red-400";
              const statusLabel = m.status === "online" ? "Online" : m.status === "maintenance" ? "Karbantartás" : "Offline";
              return (
                <div key={m.id} className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${statusDot} flex-shrink-0`} />
                    <div>
                      <div className="font-medium text-white text-sm">{m.name}</div>
                      <div className="text-xs text-slate-400">{currentTask ? `Gyárt: ${product?.name || "—"}` : statusLabel}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${m.utilization > 85 ? "text-red-400" : m.utilization > 60 ? "text-amber-400" : "text-green-400"}`}>
                      {m.utilization}%
                    </div>
                    <div className="text-xs text-slate-500">terhelés</div>
                  </div>
                </div>
              );
            })}
            {machines.length === 0 && (
              <div className="bg-slate-800 rounded-xl p-6 text-center text-slate-500 border border-slate-700">
                Nincs gép rögzítve
              </div>
            )}
          </div>
        </section>

        <div className="text-center text-xs text-slate-600 pb-4">
          ProdAI · Gyárpadló nézet · {now.toLocaleTimeString("hu-HU")}
        </div>
      </div>
    </div>
  );
}
