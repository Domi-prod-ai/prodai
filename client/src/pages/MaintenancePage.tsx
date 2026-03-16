import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarClock, Plus, Search, Pencil, Trash2, CheckCircle2, X,
  AlertTriangle, Clock, Wrench, Cpu, ChevronLeft, ChevronRight, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Machine } from "@shared/schema";

interface Mold { id: number; name: string; moldNumber: string; }

interface MaintenanceLog {
  id: number;
  machineId: number;
  moldId: number;
  type: string;
  title: string;
  description: string;
  status: string;
  scheduledDate: string;
  completedDate: string;
  technicianName: string;
  durationHours: number;
  cost: number;
  notes: string;
  createdAt: string;
}

const EMPTY_LOG: Partial<MaintenanceLog> = {
  machineId: 0, moldId: 0, type: "preventive",
  title: "", description: "", status: "scheduled",
  scheduledDate: new Date().toISOString().split("T")[0],
  completedDate: "", technicianName: "", durationHours: 0, cost: 0, notes: "",
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  scheduled:   { label: "Ütemezett",     color: "text-blue-700",  bg: "bg-blue-50 border-blue-200" },
  in_progress: { label: "Folyamatban",   color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  done:        { label: "Kész",          color: "text-green-700", bg: "bg-green-50 border-green-200" },
  overdue:     { label: "Lejárt",        color: "text-red-700",   bg: "bg-red-50 border-red-200" },
};

const TYPE_LABELS: Record<string, string> = {
  preventive:  "Megelőző",
  corrective:  "Hibaelhárítás",
  inspection:  "Vizsgálat",
};

function statusBadge(status: string) {
  const s = STATUS_LABELS[status] ?? STATUS_LABELS.scheduled;
  return <Badge className={`${s.bg} ${s.color} border text-xs`}>{s.label}</Badge>;
}

function typeBadge(type: string) {
  const icons: Record<string, JSX.Element> = {
    preventive:  <Wrench size={10} className="inline mr-1" />,
    corrective:  <AlertTriangle size={10} className="inline mr-1" />,
    inspection:  <CheckCircle2 size={10} className="inline mr-1" />,
  };
  return (
    <span className="text-xs text-muted-foreground">
      {icons[type]}{TYPE_LABELS[type] ?? type}
    </span>
  );
}

function LogForm({ initial, onSave, onCancel, machines, molds }: {
  initial: Partial<MaintenanceLog>;
  onSave: (d: any) => void;
  onCancel: () => void;
  machines: Machine[];
  molds: Mold[];
}) {
  const [form, setForm] = useState<any>({ ...EMPTY_LOG, ...initial });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <div className="bg-white border border-border rounded-xl p-5 space-y-4 shadow-sm">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Bejegyzés neve *</label>
        <input className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          value={form.title} onChange={e => set("title", e.target.value)} placeholder="pl. Éves megelőző karbantartás – 1. gép" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Típus</label>
          <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.type} onChange={e => set("type", e.target.value)}>
            <option value="preventive">Megelőző</option>
            <option value="corrective">Hibaelhárítás</option>
            <option value="inspection">Vizsgálat</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Státusz</label>
          <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.status} onChange={e => set("status", e.target.value)}>
            <option value="scheduled">Ütemezett</option>
            <option value="in_progress">Folyamatban</option>
            <option value="done">Kész</option>
            <option value="overdue">Lejárt</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Időtartam (óra)</label>
          <input type="number" min={0} step={0.5} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.durationHours} onChange={e => set("durationHours", Number(e.target.value))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Érintett gép</label>
          <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.machineId} onChange={e => set("machineId", Number(e.target.value))}>
            <option value={0}>— Nincs kiválasztva —</option>
            {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Érintett szerszám</label>
          <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.moldId} onChange={e => set("moldId", Number(e.target.value))}>
            <option value={0}>— Nincs kiválasztva —</option>
            {molds.map(mo => <option key={mo.id} value={mo.id}>{mo.moldNumber} — {mo.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Ütemezett dátum *</label>
          <input type="date" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.scheduledDate} onChange={e => set("scheduledDate", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Befejezés dátuma</label>
          <input type="date" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.completedDate} onChange={e => set("completedDate", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Technikus neve</label>
          <input className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.technicianName} onChange={e => set("technicianName", e.target.value)} placeholder="pl. Kovács László" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Költség (Ft)</label>
          <input type="number" min={0} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.cost} onChange={e => set("cost", Number(e.target.value))} />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Leírás</label>
        <textarea rows={2} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          value={form.description} onChange={e => set("description", e.target.value)} placeholder="Elvégzett munkák részletei..." />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Megjegyzés</label>
        <textarea rows={2} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          value={form.notes} onChange={e => set("notes", e.target.value)} />
      </div>
      <div className="flex gap-3 pt-1">
        <Button variant="outline" onClick={onCancel} className="gap-1.5"><X size={13} /> Mégse</Button>
        <Button className="flex-1 gap-1.5" onClick={() => onSave(form)} disabled={!form.title || !form.scheduledDate}>
          <CheckCircle2 size={13} /> Mentés
        </Button>
      </div>
    </div>
  );
}

// Naptár nézet komponens
function CalendarView({ logs, machines, molds }: {
  logs: MaintenanceLog[];
  machines: Machine[];
  molds: Mold[];
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1; // hétfőtől

  const MONTH_NAMES = ["Január","Február","Március","Április","Május","Június",
                        "Július","Augusztus","Szeptember","Október","November","December"];

  function prev() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function next() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  function logsForDay(d: number) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return logs.filter(l => l.scheduledDate?.startsWith(iso));
  }

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const statusColor: Record<string, string> = {
    scheduled:   "bg-blue-500",
    in_progress: "bg-amber-500",
    done:        "bg-green-500",
    overdue:     "bg-red-500",
  };

  return (
    <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
      {/* Fejléc */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={prev}><ChevronLeft size={14} /></Button>
        <h3 className="font-semibold text-sm text-foreground">{MONTH_NAMES[month]} {year}</h3>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={next}><ChevronRight size={14} /></Button>
      </div>

      {/* Nap fejlécek */}
      <div className="grid grid-cols-7 border-b border-border">
        {["H","K","Sz","Cs","P","Szo","V"].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
        ))}
      </div>

      {/* Napok */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="h-20 border-b border-r border-border/40 bg-muted/20" />;
          const dayLogs = logsForDay(day);
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          return (
            <div key={i} className={`h-20 p-1 border-b border-r border-border/40 ${isToday ? "bg-primary/5" : "hover:bg-muted/30"} transition-colors`}>
              <span className={`text-xs font-medium inline-block w-5 h-5 text-center leading-5 rounded-full ${
                isToday ? "bg-primary text-white" : "text-muted-foreground"
              }`}>{day}</span>
              <div className="mt-0.5 space-y-0.5">
                {dayLogs.slice(0, 2).map(l => {
                  const mc = machines.find(m => m.id === l.machineId);
                  const mo = molds.find(m => m.id === l.moldId);
                  return (
                    <div key={l.id} className={`text-white text-[10px] px-1 py-0.5 rounded truncate flex items-center gap-0.5 ${statusColor[l.status] ?? "bg-gray-400"}`}>
                      {mc ? <Cpu size={8} className="flex-shrink-0" /> : <Wrench size={8} className="flex-shrink-0" />}
                      <span className="truncate">{mc?.name ?? mo?.name ?? l.title}</span>
                    </div>
                  );
                })}
                {dayLogs.length > 2 && (
                  <div className="text-[10px] text-muted-foreground pl-1">+{dayLogs.length - 2} több</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Jelmagyarázat */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-muted/20">
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${statusColor[k]}`} />
            <span className="text-xs text-muted-foreground">{v.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MaintenancePage() {
  const { toast } = useToast();
  const [tab, setTab] = useState("list");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [editId, setEditId] = useState<number | null>(null);

  const { data: logs = [] } = useQuery<MaintenanceLog[]>({ queryKey: ["/api/maintenance"] });
  const { data: machines = [] } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });
  const { data: molds = [] } = useQuery<Mold[]>({ queryKey: ["/api/molds"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => { const r = await apiRequest("POST", "/api/maintenance", data); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] }); toast({ title: "Bejegyzés mentve" }); setTab("list"); },
    onError: () => toast({ title: "Mentési hiba", variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => { const r = await apiRequest("PATCH", `/api/maintenance/${id}`, data); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] }); toast({ title: "Módosítás mentve" }); setEditId(null); setTab("list"); },
    onError: () => toast({ title: "Mentési hiba", variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { const r = await apiRequest("DELETE", `/api/maintenance/${id}`); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] }); toast({ title: "Bejegyzés törölve" }); },
  });

  const filtered = logs.filter(l => {
    const term = search.toLowerCase();
    const matchSearch = l.title.toLowerCase().includes(term) ||
      (l.technicianName ?? "").toLowerCase().includes(term);
    const matchStatus = filterStatus === "all" || l.status === filterStatus;
    const matchType = filterType === "all" || l.type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const editLog = logs.find(l => l.id === editId);

  // KPI-ok
  const scheduled = logs.filter(l => l.status === "scheduled").length;
  const inProgress = logs.filter(l => l.status === "in_progress").length;
  const overdue = logs.filter(l => l.status === "overdue").length;
  const done = logs.filter(l => l.status === "done").length;
  const totalCost = logs.filter(l => l.status === "done").reduce((s, l) => s + (l.cost ?? 0), 0);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <CalendarClock size={20} className="text-primary" /> Karbantartás naptár
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gép- és szerszámkarbantartások ütemezése, nyilvántartása és követése</p>
      </div>

      {/* KPI sor */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Ütemezett", value: scheduled, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
          { label: "Folyamatban", value: inProgress, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
          { label: "Lejárt", value: overdue, color: "text-red-600", bg: "bg-red-50 border-red-100" },
          { label: "Elvégzett", value: done, color: "text-green-600", bg: "bg-green-50 border-green-100" },
          { label: "Összes cost", value: totalCost.toLocaleString("hu-HU") + " Ft", color: "text-foreground", bg: "bg-muted/50 border-border" },
        ].map(k => (
          <div key={k.label} className={`border rounded-xl px-4 py-3 ${k.bg}`}>
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${k.color} leading-tight`}>{k.value}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="list"><CalendarClock size={14} className="mr-2" />Lista</TabsTrigger>
          <TabsTrigger value="calendar"><CalendarClock size={14} className="mr-2" />Naptár</TabsTrigger>
          <TabsTrigger value="new"><Plus size={14} className="mr-2" />Új bejegyzés</TabsTrigger>
          {editId && <TabsTrigger value="edit"><Pencil size={14} className="mr-2" />Szerkesztés</TabsTrigger>}
        </TabsList>

        <div className="mt-4">
          {/* Lista tab */}
          <TabsContent value="list">
            {/* Szűrők */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input className="w-full border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Keresés névben, technikusban..."
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-1.5">
                <Filter size={14} className="text-muted-foreground" />
                <select className="border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="all">Minden státusz</option>
                  <option value="scheduled">Ütemezett</option>
                  <option value="in_progress">Folyamatban</option>
                  <option value="done">Kész</option>
                  <option value="overdue">Lejárt</option>
                </select>
                <select className="border border-border rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="all">Minden típus</option>
                  <option value="preventive">Megelőző</option>
                  <option value="corrective">Hibaelhárítás</option>
                  <option value="inspection">Vizsgálat</option>
                </select>
              </div>
            </div>

            <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {["Bejegyzés","Típus","Gép / Szerszám","Ütemezett","Technikus","Ár","Státusz",""].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground text-sm">Nincs találat</td></tr>
                  ) : filtered.map(log => {
                    const mc = machines.find(m => m.id === log.machineId);
                    const mo = molds.find(m => m.id === log.moldId);
                    return (
                      <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{log.title}</p>
                          {log.description && <p className="text-xs text-muted-foreground truncate max-w-48">{log.description}</p>}
                        </td>
                        <td className="px-4 py-3">{typeBadge(log.type)}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground space-y-0.5">
                          {mc && <div className="flex items-center gap-1"><Cpu size={11} />{mc.name}</div>}
                          {mo && <div className="flex items-center gap-1"><Wrench size={11} />{mo.moldNumber}</div>}
                          {!mc && !mo && <span className="italic">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-foreground">{log.scheduledDate || "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{log.technicianName || "—"}</td>
                        <td className="px-4 py-3 text-xs font-mono">{log.cost ? log.cost.toLocaleString("hu-HU") + " Ft" : "—"}</td>
                        <td className="px-4 py-3">{statusBadge(log.status)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                              onClick={() => { setEditId(log.id); setTab("edit"); }}>
                              <Pencil size={12} />
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:border-red-200"
                              onClick={() => deleteMutation.mutate(log.id)}>
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Naptár tab */}
          <TabsContent value="calendar">
            <CalendarView logs={logs} machines={machines} molds={molds} />
          </TabsContent>

          {/* Új bejegyzés tab */}
          <TabsContent value="new">
            <LogForm
              initial={EMPTY_LOG}
              machines={machines}
              molds={molds}
              onSave={data => createMutation.mutate(data)}
              onCancel={() => setTab("list")}
            />
          </TabsContent>

          {/* Szerkesztés tab */}
          <TabsContent value="edit">
            {editLog && (
              <LogForm
                initial={editLog}
                machines={machines}
                molds={molds}
                onSave={data => updateMutation.mutate({ id: editLog.id, data })}
                onCancel={() => { setEditId(null); setTab("list"); }}
              />
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
