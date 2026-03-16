import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useRef, useCallback } from "react";
import { Zap, RefreshCw, GripVertical, Clock, Info, X, Save, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import type { Task, Machine, Order, Product } from "@shared/schema";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 6); // 06:00 – 18:00
const TOTAL_MINUTES = 12 * 60;
const START_HOUR = 6;

function timeToPercent(timeStr: string): number {
  const d = new Date(timeStr);
  const minuteOfDay = d.getHours() * 60 + d.getMinutes();
  const offset = minuteOfDay - START_HOUR * 60;
  return Math.max(0, Math.min(100, (offset / TOTAL_MINUTES) * 100));
}
function durationPercent(startStr: string, endStr: string): number {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const mins = (end.getTime() - start.getTime()) / 60000;
  return Math.max(1, Math.min(100, (mins / TOTAL_MINUTES) * 100));
}
function percentToTime(pct: number, baseDate: string): string {
  const base = new Date(baseDate);
  const minuteOfDay = START_HOUR * 60 + Math.round((pct / 100) * TOTAL_MINUTES);
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d.toISOString().slice(0, 16);
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  in_progress: { bg: "hsl(206 70% 40%)",        border: "hsl(206 70% 30%)",  text: "#fff" },
  planned:     { bg: "hsl(206 70% 90%)",         border: "hsl(206 70% 70%)",  text: "hsl(206 70% 35%)" },
  done:        { bg: "hsl(142 50% 45%)",         border: "hsl(142 50% 35%)",  text: "#fff" },
  delayed:     { bg: "hsl(0 65% 55%)",           border: "hsl(0 65% 45%)",    text: "#fff" },
};

const STATUS_HU: Record<string, string> = {
  in_progress: "Folyamatban", planned: "Tervezett", done: "Kész", delayed: "Késedelmes",
};

function printGanttPDF(tasks: any[], machines: any[], orders: any[], products: any[]) {
  const win = window.open("", "_blank");
  if (!win) { alert("Engedélyezd a felugró ablakokat a PDF exporthoz!"); return; }
  const now = new Date().toLocaleString("hu-HU");
  const priorityLabel: Record<string, string> = { urgent: "Sürgős", high: "Magas", normal: "Normál", low: "Alacsony" };
  const statusLabel: Record<string, string> = { planned: "Tervezett", in_progress: "Folyamatban", done: "Kész", delayed: "Késedelmes" };
  const statusColor: Record<string, string> = { planned: "#3b82f6", in_progress: "#f59e0b", done: "#22c55e", delayed: "#ef4444" };

  const rows = tasks.map(t => {
    const machine = machines.find((m: any) => m.id === t.machineId);
    const order = orders.find((o: any) => o.id === t.orderId);
    const product = products.find((p: any) => p.id === t.productId);
    const start = new Date(t.startTime);
    const end = new Date(t.endTime);
    const hours = ((end.getTime() - start.getTime()) / 3600000).toFixed(1);
    const status = t.status || "planned";
    return `<tr>
      <td>${order?.orderNumber || "-"}</td>
      <td>${product?.name || "-"}</td>
      <td>${machine?.name || "-"}</td>
      <td>${start.toLocaleString("hu-HU")}</td>
      <td>${end.toLocaleString("hu-HU")}</td>
      <td>${hours} h</td>
      <td>${t.quantity} db</td>
      <td><span style="background:${statusColor[status]}22;color:${statusColor[status]};padding:2px 8px;border-radius:4px;font-weight:600">${statusLabel[status] || status}</span></td>
      <td>${order ? (priorityLabel[order.priority] || order.priority) : "-"}</td>
    </tr>`;
  }).join("");

  const machineRows = machines.map((m: any) => {
    const machineTasks = tasks.filter((t: any) => t.machineId === m.id);
    const totalHours = machineTasks.reduce((acc: number, t: any) => {
      const s = new Date(t.startTime); const e = new Date(t.endTime);
      return acc + (e.getTime() - s.getTime()) / 3600000;
    }, 0);
    return `<tr><td>${m.name}</td><td>${m.type}</td><td>${machineTasks.length}</td><td>${totalHours.toFixed(1)} h</td><td>${m.utilization}%</td></tr>`;
  }).join("");

  win.document.write(`<!DOCTYPE html><html lang="hu"><head>
    <meta charset="UTF-8"><title>Termelési Terv — ProdAI</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 32px; color: #1e293b; font-size: 12px; }
      h1 { font-size: 20px; color: #1d4ed8; border-bottom: 2px solid #1d4ed8; padding-bottom: 8px; margin-bottom: 4px; }
      .meta { color: #64748b; font-size: 11px; margin-bottom: 20px; }
      h2 { font-size: 14px; margin: 24px 0 8px; color: #334155; border-left: 3px solid #1d4ed8; padding-left: 8px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
      th { background: #1d4ed8; color: white; padding: 7px 10px; text-align: left; font-size: 11px; }
      td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
      tr:nth-child(even) td { background: #f8fafc; }
      .summary { display: flex; gap: 24px; margin-bottom: 20px; }
      .kpi { background: #f1f5f9; border-radius: 8px; padding: 12px 20px; text-align: center; }
      .kpi-val { font-size: 24px; font-weight: bold; color: #1d4ed8; }
      .kpi-label { font-size: 10px; color: #64748b; margin-top: 2px; }
      @media print { body { margin: 16px; } }
    </style>
  </head><body>
    <h1>Termelési Terv — ProdAI</h1>
    <div class="meta">Generálva: ${now} · Összes feladat: ${tasks.length} · Gépek: ${machines.length}</div>
    <div class="summary">
      <div class="kpi"><div class="kpi-val">${tasks.length}</div><div class="kpi-label">Feladat</div></div>
      <div class="kpi"><div class="kpi-val">${tasks.filter((t: any) => t.status === "in_progress").length}</div><div class="kpi-label">Folyamatban</div></div>
      <div class="kpi"><div class="kpi-val">${tasks.filter((t: any) => t.status === "done").length}</div><div class="kpi-label">Kész</div></div>
      <div class="kpi"><div class="kpi-val">${tasks.filter((t: any) => t.status === "delayed").length}</div><div class="kpi-label">Késedelmes</div></div>
    </div>
    <h2>Feladatok részletezése</h2>
    <table>
      <thead><tr><th>Rendelés</th><th>Termék</th><th>Gép</th><th>Kezdés</th><th>Befejezés</th><th>Idő</th><th>Mennyiség</th><th>Státusz</th><th>Prioritás</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="9" style="text-align:center;color:#94a3b8">Nincs feladat</td></tr>'}</tbody>
    </table>
    <h2>Gép terhelés összesítő</h2>
    <table>
      <thead><tr><th>Gép neve</th><th>Típus</th><th>Feladatok</th><th>Összes idő</th><th>Kihasználtság</th></tr></thead>
      <tbody>${machineRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8">Nincs gép</td></tr>'}</tbody>
    </table>
    <div style="text-align:center;color:#94a3b8;font-size:10px;margin-top:32px">Generálva: ProdAI — ${now}</div>
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

export default function GanttPage() {
  const { toast } = useToast();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dragState, setDragState] = useState<{ taskId: number; startX: number; origLeft: number; origWidth: number } | null>(null);
  const [resizeState, setResizeState] = useState<{ taskId: number; startX: number; origLeft: number; origWidth: number } | null>(null);
  // localOffsets: id -> { leftPct, widthPct } — átmeneti módosítás drag közben
  const [localOffsets, setLocalOffsets] = useState<Record<number, { leftPct: number; widthPct: number }>>({});
  const [pendingSaves, setPendingSaves] = useState<Set<number>>(new Set());
  const timelineRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({ queryKey: ["/api/tasks"] });
  const { data: machines = [] } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });
  const { data: orders = [] } = useQuery<Order[]>({ queryKey: ["/api/orders"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const autoPlan = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ai/auto-plan"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-suggestions"] });
      setLocalOffsets({});
      setPendingSaves(new Set());
      toast({ title: "AI ütemezés frissítve" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Task> }) => {
      const r = await apiRequest("PATCH", `/api/tasks/${id}`, data);
      return r.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setPendingSaves(prev => { const s = new Set(prev); s.delete(id); return s; });
      toast({ title: "Feladat mentve", description: "Az időpont módosítva." });
    },
    onError: () => toast({ title: "Mentési hiba", variant: "destructive" }),
  });

  const tasksByMachine: Record<number, Task[]> = {};
  tasks.forEach(t => {
    if (!tasksByMachine[t.machineId]) tasksByMachine[t.machineId] = [];
    tasksByMachine[t.machineId].push(t);
  });

  const getOrder = (id: number) => orders.find(o => o.id === id);
  const getProduct = (id: number) => products.find(p => p.id === id);

  // ── Drag move handler ──
  const handleMouseDown = useCallback((e: React.MouseEvent, task: Task, mode: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    const timelineEl = timelineRefs.current[task.machineId];
    if (!timelineEl) return;
    const rect = timelineEl.getBoundingClientRect();
    const left = timeToPercent(task.startTime);
    const width = durationPercent(task.startTime, task.endTime);

    if (mode === "move") {
      setDragState({ taskId: task.id, startX: e.clientX, origLeft: left, origWidth: width });
    } else {
      setResizeState({ taskId: task.id, startX: e.clientX, origLeft: left, origWidth: width });
    }

    const onMouseMove = (ev: MouseEvent) => {
      const timelineEl2 = timelineRefs.current[task.machineId];
      if (!timelineEl2) return;
      const rect2 = timelineEl2.getBoundingClientRect();
      const deltaPct = ((ev.clientX - e.clientX) / rect2.width) * 100;

      if (mode === "move") {
        const newLeft = Math.max(0, Math.min(100 - width, left + deltaPct));
        setLocalOffsets(prev => ({ ...prev, [task.id]: { leftPct: newLeft, widthPct: width } }));
      } else {
        const newWidth = Math.max(2, Math.min(100 - left, width + deltaPct));
        setLocalOffsets(prev => ({ ...prev, [task.id]: { leftPct: left, widthPct: newWidth } }));
      }
    };

    const onMouseUp = (ev: MouseEvent) => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      setDragState(null);
      setResizeState(null);

      // Kiszámítjuk az új időpontot
      const timelineEl3 = timelineRefs.current[task.machineId];
      if (!timelineEl3) return;
      const rect3 = timelineEl3.getBoundingClientRect();
      const deltaPct2 = ((ev.clientX - e.clientX) / rect3.width) * 100;

      const baseDate = task.startTime;
      let newStart = task.startTime;
      let newEnd = task.endTime;

      if (mode === "move") {
        const newLeftPct = Math.max(0, Math.min(100 - width, left + deltaPct2));
        newStart = percentToTime(newLeftPct, baseDate);
        newEnd = percentToTime(newLeftPct + width, baseDate);
      } else {
        const newWidthPct = Math.max(2, Math.min(100 - left, width + deltaPct2));
        newEnd = percentToTime(left + newWidthPct, baseDate);
      }

      // Ha érdemi változás van
      if (newStart !== task.startTime || newEnd !== task.endTime) {
        setPendingSaves(prev => new Set([...prev, task.id]));
        updateTaskMutation.mutate({ id: task.id, data: { startTime: newStart, endTime: newEnd } });
      } else {
        // Nincs változás — visszaállítjuk
        setLocalOffsets(prev => { const n = { ...prev }; delete n[task.id]; return n; });
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [tasks, updateTaskMutation]);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            Gantt ütemterv
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Húzással mozgathatod a feladatokat · Jobb széllel átméretezheted
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingSaves.size > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              <Save size={12} className="animate-pulse" /> {pendingSaves.size} mentés folyamatban…
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => printGanttPDF(tasks, machines, orders, products)}
            data-testid="btn-gantt-pdf"
          >
            <FileText size={14} /> PDF export
          </Button>
          <Button
            onClick={() => autoPlan.mutate()}
            disabled={autoPlan.isPending}
            data-testid="btn-gantt-replan"
            size="sm"
            className="gap-2"
          >
            {autoPlan.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
            {autoPlan.isPending ? "Tervez..." : "AI újratervezés"}
          </Button>
        </div>
      </div>

      {/* Drag info banner */}
      <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
        <Info size={13} className="flex-shrink-0" />
        <span>
          <strong>Húzd</strong> a feladatblokkot az átütemezéshez · <strong>Jobb szélt húzd</strong> az időtartam megváltoztatásához · Kattints a részletekért
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {Object.entries(STATUS_COLORS).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: v.bg, border: `1px solid ${v.border}` }} />
            {STATUS_HU[k]}
          </div>
        ))}
        <div className="flex items-center gap-1 ml-2">
          <Zap size={10} className="text-primary" />
          <span className="text-primary">AI optimalizált</span>
        </div>
        <div className="flex items-center gap-1">
          <GripVertical size={10} className="text-muted-foreground" />
          <span>Húzható</span>
        </div>
      </div>

      {/* Gantt container */}
      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm select-none">
        {/* Time header */}
        <div className="gantt-row border-b border-border bg-muted/30">
          <div className="px-3 py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wide flex items-end border-r border-border">Gép</div>
          <div className="relative" style={{ minHeight: 32 }}>
            {HOURS.map(h => (
              <div key={h} className="absolute top-0 bottom-0 flex items-center"
                style={{ left: `${((h - START_HOUR) / (HOURS.length - 1)) * 100}%` }}>
                <span className="text-xs text-muted-foreground tabular-nums pl-1">{h}:00</span>
                <div className="absolute top-0 bottom-0 w-px bg-border/50" />
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        {tasksLoading ? (
          <div>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="gantt-row">
                <div className="px-3 py-3"><div className="skeleton h-4 w-28" /></div>
                <div className="relative p-2"><div className="skeleton h-8 w-32" /></div>
              </div>
            ))}
          </div>
        ) : (
          machines.map(machine => {
            const machineTasks = tasksByMachine[machine.id] || [];
            return (
              <div key={machine.id} className="gantt-row hover:bg-muted/10 transition-colors" data-testid={`gantt-machine-${machine.id}`}>
                {/* Machine label */}
                <div className="px-3 py-2 flex items-center gap-2 border-r border-border bg-white">
                  <span className={`status-dot flex-shrink-0 ${
                    machine.status === "online" ? "status-online" :
                    machine.status === "maintenance" ? "status-maintenance" : "status-offline"
                  }`} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground truncate">{machine.name}</div>
                    <div className="text-xs text-muted-foreground">{machine.type}</div>
                  </div>
                </div>

                {/* Timeline */}
                <div
                  className="gantt-timeline relative"
                  style={{ minHeight: 52 }}
                  ref={el => { timelineRefs.current[machine.id] = el; }}
                >
                  {/* Hour grid lines */}
                  {HOURS.map(h => (
                    <div key={h} className="absolute top-0 bottom-0 w-px bg-border/20"
                      style={{ left: `${((h - START_HOUR) / (HOURS.length - 1)) * 100}%` }} />
                  ))}

                  {machineTasks.map(task => {
                    const offset = localOffsets[task.id];
                    const left = offset ? offset.leftPct : timeToPercent(task.startTime);
                    const width = offset ? offset.widthPct : durationPercent(task.startTime, task.endTime);
                    const colors = STATUS_COLORS[task.status] ?? STATUS_COLORS.planned;
                    const order = getOrder(task.orderId);
                    const product = getProduct(task.productId);
                    const isDragging = dragState?.taskId === task.id || resizeState?.taskId === task.id;
                    const isSaving = pendingSaves.has(task.id);

                    return (
                      <div
                        key={task.id}
                        className={`gantt-bar group ${isDragging ? "opacity-75 shadow-lg z-20" : "hover:brightness-95 z-10"} ${isSaving ? "opacity-60" : ""}`}
                        data-testid={`gantt-task-${task.id}`}
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          background: colors.bg,
                          border: `1.5px solid ${colors.border}`,
                          color: colors.text,
                          cursor: isDragging ? "grabbing" : "grab",
                          transition: isDragging ? "none" : "left 0.15s, width 0.15s",
                          userSelect: "none",
                        }}
                        onMouseDown={e => handleMouseDown(e, task, "move")}
                        onClick={e => {
                          if (dragState || resizeState) return;
                          setSelectedTask(task);
                        }}
                        title={`${order?.orderNumber} — ${product?.name} (${task.quantity} db) | Mozgasd átütemezéshez`}
                      >
                        {/* Drag grip icon */}
                        <GripVertical size={10} className="flex-shrink-0 opacity-60" />
                        <span className="truncate text-xs font-medium">
                          {task.aiOptimized && "⚡ "}
                          {order?.orderNumber || `#${task.id}`}
                        </span>
                        {/* Resize handle — jobb szél */}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 flex items-center justify-center"
                          style={{ background: "rgba(0,0,0,0.15)", borderRadius: "0 4px 4px 0" }}
                          onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, task, "resize"); }}
                          title="Húzd az időtartam megváltoztatásához"
                        >
                          <div className="w-0.5 h-3 bg-current rounded-full opacity-60" />
                        </div>
                      </div>
                    );
                  })}

                  {machineTasks.length === 0 && machine.status === "maintenance" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs text-amber-500/70 font-medium">Karbantartás alatt</span>
                    </div>
                  )}
                  {machineTasks.length === 0 && machine.status !== "maintenance" && (
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className="text-xs text-muted-foreground/40 italic">Nincs ütemezett feladat</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Task detail popup */}
      {selectedTask && (() => {
        const order = getOrder(selectedTask.orderId);
        const product = getProduct(selectedTask.productId);
        const machine = machines.find(m => m.id === selectedTask.machineId);
        const colors = STATUS_COLORS[selectedTask.status] ?? STATUS_COLORS.planned;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setSelectedTask(null)}
          >
            <div
              className="bg-white border border-border rounded-xl p-5 w-full max-w-sm shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: colors.bg, border: `1px solid ${colors.border}` }} />
                  <h3 className="font-bold text-foreground">{order?.orderNumber || `Feladat #${selectedTask.id}`}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {selectedTask.aiOptimized && (
                    <span className="flex items-center gap-1 text-xs text-primary bg-primary/10 border border-primary/20 rounded px-2 py-0.5">
                      <Zap size={10} /> AI
                    </span>
                  )}
                  <button onClick={() => setSelectedTask(null)} className="text-muted-foreground hover:text-foreground">
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="space-y-2.5 text-sm">
                {[
                  ["Termék", product?.name || "—"],
                  ["Gép", machine?.name || "—"],
                  ["Mennyiség", `${selectedTask.quantity} db`],
                  ["Kezdés", new Date(selectedTask.startTime).toLocaleString("hu-HU")],
                  ["Befejezés", new Date(selectedTask.endTime).toLocaleString("hu-HU")],
                  ["Státusz", STATUS_HU[selectedTask.status] ?? selectedTask.status],
                  ["Vevő", order?.customer || "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="text-foreground font-medium">{v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-xs text-blue-700 flex items-center gap-1.5">
                  <Info size={11} /> Húzással is átütemezheted a Gantt diagramon
                </p>
              </div>
              <button
                className="mt-3 w-full py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
                onClick={() => setSelectedTask(null)}
              >
                Bezárás
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
