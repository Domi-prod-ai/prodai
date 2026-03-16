import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart2, Download, Calendar, TrendingUp, Package,
  Cpu, ClipboardList, CheckCircle2, Clock, AlertTriangle, CalendarClock, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { Machine, Product } from "@shared/schema";

interface Order {
  id: number; orderNumber: string; customerName: string;
  productId: number; quantity: number; status: string;
  dueDate: string; priority: string;
}
interface Task {
  id: number; machineId: number; productId: number;
  plannedStart: string; plannedEnd: string; status: string;
  quantity: number;
}
interface MaintenanceLog {
  id: number; machineId: number; moldId: number; type: string;
  title: string; status: string; scheduledDate: string;
  durationHours: number; cost: number; technicianName: string;
}

// --- Segédfüggvények ---
function toCSV(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map(r => r.map(c => `"${(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
}

function downloadFile(content: string, filename: string, mime = "text/csv;charset=utf-8;") {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function printPDF(title: string, html: string) {
  const win = window.open("", "_blank");
  if (!win) { alert("Engedélyezd a felugró ablakokat a PDF exporthoz!"); return; }
  win.document.write(`<!DOCTYPE html><html lang="hu"><head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 32px; color: #1e293b; font-size: 13px; }
      h1 { font-size: 20px; color: #1d4ed8; border-bottom: 2px solid #1d4ed8; padding-bottom: 8px; margin-bottom: 20px; }
      h2 { font-size: 15px; color: #334155; margin-top: 20px; margin-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th { background: #f1f5f9; color: #475569; font-size: 11px; text-align: left; padding: 6px 10px; border: 1px solid #e2e8f0; }
      td { padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 12px; }
      tr:nth-child(even) td { background: #f8fafc; }
      .kpi { display: inline-block; margin: 4px 8px 4px 0; background: #f1f5f9; border-radius: 8px; padding: 8px 14px; }
      .kpi .label { font-size: 11px; color: #64748b; }
      .kpi .value { font-size: 18px; font-weight: bold; color: #1d4ed8; }
      .footer { margin-top: 32px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
      @media print { body { margin: 16px; } }
    </style>
  </head><body>${html}<div class="footer">Generalva: ${new Date().toLocaleString("hu-HU")} — ProdAI Termelestervezo</div></body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 600);
}

function isoMonth(dateStr: string): string {
  if (!dateStr) return "—";
  return dateStr.slice(0, 7);
}

function isoWeek(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

// --- Sávdiagram komponens (natív SVG) ---
function BarChartSVG({ data, color = "hsl(206, 70%, 40%)" }: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  if (!data.length) return <div className="text-center text-sm text-muted-foreground py-8">Nincs elég adat</div>;
  const max = Math.max(...data.map(d => d.value), 1);
  const H = 140;
  const BAR_W = Math.max(20, Math.min(48, Math.floor(560 / data.length) - 8));
  const GAP = Math.max(4, Math.floor(560 / data.length) - BAR_W);

  return (
    <div className="overflow-x-auto">
      <svg width={data.length * (BAR_W + GAP) + 16} height={H + 40} className="block mx-auto">
        {data.map((d, i) => {
          const barH = Math.round((d.value / max) * H);
          const x = 8 + i * (BAR_W + GAP);
          const y = H - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={BAR_W} height={barH} rx={3} fill={color} fillOpacity={0.85} />
              <text x={x + BAR_W / 2} y={y - 4} textAnchor="middle" fontSize={10} fill="#64748b">{d.value}</text>
              <text x={x + BAR_W / 2} y={H + 16} textAnchor="middle" fontSize={9} fill="#94a3b8"
                transform={`rotate(-30, ${x + BAR_W / 2}, ${H + 16})`}>{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// --- KPI kártya ---
function KpiCard({ label, value, icon: Icon, color }: {
  label: string; value: string | number; icon: any; color: string;
}) {
  return (
    <div className="bg-white border border-border rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={16} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
      </div>
    </div>
  );
}

// ======= TERMELÉS TAB =======
function ProductionReport({ tasks, machines, products }: {
  tasks: Task[]; machines: Machine[]; products: Product[];
}) {
  const [groupBy, setGroupBy] = useState<"month" | "week">("month");

  const grouped: Record<string, number> = {};
  tasks.forEach(t => {
    if (!t.plannedStart) return;
    const key = groupBy === "month" ? isoMonth(t.plannedStart) : isoWeek(t.plannedStart);
    grouped[key] = (grouped[key] ?? 0) + (t.quantity ?? 0);
  });
  const chartData = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value }));

  const machineUtil: Record<number, number> = {};
  tasks.forEach(t => { machineUtil[t.machineId] = (machineUtil[t.machineId] ?? 0) + 1; });
  const machineRows = machines.map(m => ({
    name: m.name,
    tasks: machineUtil[m.id] ?? 0,
    pct: tasks.length ? Math.round(((machineUtil[m.id] ?? 0) / tasks.length) * 100) : 0,
  })).sort((a, b) => b.tasks - a.tasks);

  const totalQty = tasks.reduce((s, t) => s + (t.quantity ?? 0), 0);
  const doneQty = tasks.filter(t => t.status === "done").reduce((s, t) => s + (t.quantity ?? 0), 0);
  const completionRate = tasks.length ? Math.round((tasks.filter(t => t.status === "done").length / tasks.length) * 100) : 0;

  function exportCSV() {
    const headers = ["Idoszak", "Tervezett darab"];
    const rows = chartData.map(d => [d.label, String(d.value)]);
    downloadFile(toCSV(headers, rows), `termelesi-riport-${groupBy}-${new Date().toISOString().slice(0, 10)}.csv`);
  }
  function exportMachineCSV() {
    const headers = ["Gep neve", "Feladatszam", "Reszarany (%)"];
    const rows = machineRows.map(r => [r.name, String(r.tasks), String(r.pct)]);
    downloadFile(toCSV(headers, rows), `gep-kihasznaltsag-${new Date().toISOString().slice(0, 10)}.csv`);
  }
  function exportPDF() {
    const kpiHtml = `<div>
      <span class="kpi"><div class="label">Osszes feladat</div><div class="value">${tasks.length}</div></span>
      <span class="kpi"><div class="label">Tervezett db</div><div class="value">${totalQty.toLocaleString("hu-HU")}</div></span>
      <span class="kpi"><div class="label">Elvegzett db</div><div class="value">${doneQty.toLocaleString("hu-HU")}</div></span>
      <span class="kpi"><div class="label">Teljesitesi arany</div><div class="value">${completionRate}%</div></span>
    </div>`;
    const tableHtml = `<h2>Tervezett mennyiseg (${groupBy === "month" ? "havi" : "heti"})</h2>
      <table><tr><th>Idoszak</th><th>Tervezett darab</th></tr>
      ${chartData.map(d => `<tr><td>${d.label}</td><td>${d.value.toLocaleString("hu-HU")}</td></tr>`).join("")}
      </table>
      <h2>Gep kihasznaltsag</h2>
      <table><tr><th>Gep neve</th><th>Feladatszam</th><th>Reszarany (%)</th></tr>
      ${machineRows.map(r => `<tr><td>${r.name}</td><td>${r.tasks}</td><td>${r.pct}%</td></tr>`).join("")}
      </table>`;
    printPDF("Termelesi Riport — ProdAI", `<h1>Termelesi Riport</h1>${kpiHtml}${tableHtml}`);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Összes feladat" value={tasks.length} icon={CalendarClock} color="bg-primary" />
        <KpiCard label="Tervezett db" value={totalQty.toLocaleString("hu-HU")} icon={Package} color="bg-blue-500" />
        <KpiCard label="Elvégzett db" value={doneQty.toLocaleString("hu-HU")} icon={CheckCircle2} color="bg-green-500" />
        <KpiCard label="Teljesítési arány" value={completionRate + "%"} icon={TrendingUp} color="bg-amber-500" />
      </div>

      <div className="bg-white border border-border rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <BarChart2 size={15} className="text-primary" /> Tervezett mennyiség
          </h3>
          <div className="flex items-center gap-2">
            <div className="flex border border-border rounded-lg overflow-hidden text-xs">
              <button
                className={`px-3 py-1.5 font-medium transition-colors ${groupBy === "month" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}
                onClick={() => setGroupBy("month")}>Havi</button>
              <button
                className={`px-3 py-1.5 font-medium transition-colors ${groupBy === "week" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}
                onClick={() => setGroupBy("week")}>Heti</button>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={exportCSV}>
              <Download size={12} /> CSV
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={exportPDF}>
              <FileText size={12} /> PDF
            </Button>
          </div>
        </div>
        <BarChartSVG data={chartData} color="hsl(206, 70%, 40%)" />
      </div>

      <div className="bg-white border border-border rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <Cpu size={15} className="text-primary" /> Gép kihasználtság
          </h3>
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={exportMachineCSV}>
            <Download size={12} /> CSV
          </Button>
        </div>
        {machineRows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nincs gépfeladat-adat</p>
        ) : (
          <div className="space-y-2">
            {machineRows.map(r => (
              <div key={r.name} className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground w-40 truncate">{r.name}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${r.pct}%` }} />
                </div>
                <span className="text-xs text-muted-foreground w-24 text-right">{r.tasks} feladat ({r.pct}%)</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ======= RENDELÉSEK TAB =======
function OrderReport({ orders, products }: { orders: Order[]; products: Product[] }) {
  const statusCount: Record<string, number> = {};
  orders.forEach(o => { statusCount[o.status] = (statusCount[o.status] ?? 0) + 1; });

  const monthly: Record<string, number> = {};
  orders.forEach(o => {
    const key = isoMonth(o.dueDate ?? "");
    if (key !== "—") monthly[key] = (monthly[key] ?? 0) + 1;
  });
  const monthlyChart = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, value]) => ({ label, value }));

  const productQty: Record<number, number> = {};
  orders.forEach(o => { productQty[o.productId] = (productQty[o.productId] ?? 0) + (o.quantity ?? 0); });
  const topProducts = products
    .map(p => ({ name: p.sku + " " + p.name, qty: productQty[p.id] ?? 0 }))
    .filter(p => p.qty > 0)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);

  const STATUS_HU: Record<string, string> = {
    pending: "Függőben", accepted: "Elfogadott", in_production: "Gyártásban",
    done: "Kész", cancelled: "Törölve",
  };
  const STATUS_COLORS: Record<string, string> = {
    pending: "bg-gray-400", accepted: "bg-blue-500", in_production: "bg-amber-500",
    done: "bg-green-500", cancelled: "bg-red-400",
  };

  function exportOrderCSV() {
    const headers = ["Rendelesszam", "Ugyfel", "Termek SKU", "Mennyiseg", "Statusz", "Prioritas", "Hatarido"];
    const rows = orders.map(o => {
      const prod = products.find(p => p.id === o.productId);
      return [o.orderNumber, o.customerName, prod?.sku ?? "-", String(o.quantity), o.status, o.priority, o.dueDate ?? "-"];
    });
    downloadFile(toCSV(headers, rows), `rendelesi-riport-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function exportOrderPDF() {
    const tableHtml = `<h2>Rendelesi lista</h2>
      <table><tr><th>Rendelesszam</th><th>Ugyfel</th><th>Termek</th><th>Mennyiseg</th><th>Statusz</th><th>Hatarido</th></tr>
      ${orders.map(o => {
        const prod = products.find(p => p.id === o.productId);
        return `<tr><td>${o.orderNumber}</td><td>${o.customerName}</td><td>${prod?.sku ?? "-"} ${prod?.name ?? ""}</td><td>${o.quantity} db</td><td>${STATUS_HU[o.status] ?? o.status}</td><td>${o.dueDate ?? "-"}</td></tr>`;
      }).join("")}
      </table>`;
    const kpiHtml = `<div>
      <span class="kpi"><div class="label">Osszes rendeles</div><div class="value">${orders.length}</div></span>
      <span class="kpi"><div class="label">Gyartasban</div><div class="value">${statusCount["in_production"] ?? 0}</div></span>
      <span class="kpi"><div class="label">Teljesitett</div><div class="value">${statusCount["done"] ?? 0}</div></span>
    </div>`;
    printPDF("Rendelesi Riport — ProdAI", `<h1>Rendelesi Riport</h1>${kpiHtml}${tableHtml}`);
  }

  function exportOrderTXT() {
    const lines = [
      "RENDELESI RIPORT — " + new Date().toLocaleDateString("hu-HU"),
      "=".repeat(50),
      "",
      `Osszes rendeles: ${orders.length}`,
      "",
      "STATUSZ SZERINT:",
      ...Object.entries(statusCount).map(([k, v]) => `  ${STATUS_HU[k] ?? k}: ${v}`),
      "",
      "TOP TERMEKEK (db szerint):",
      ...topProducts.map(p => `  ${p.name}: ${p.qty.toLocaleString("hu-HU")} db`),
      "",
      `Generalva: ${new Date().toLocaleString("hu-HU")}`,
    ];
    downloadFile(lines.join("\n"), `rendelesi-riport-${new Date().toISOString().slice(0, 10)}.txt`, "text/plain;charset=utf-8;");
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Összes rendelés" value={orders.length} icon={ClipboardList} color="bg-primary" />
        <KpiCard label="Gyártásban" value={statusCount["in_production"] ?? 0} icon={Clock} color="bg-amber-500" />
        <KpiCard label="Teljesített" value={statusCount["done"] ?? 0} icon={CheckCircle2} color="bg-green-500" />
        <KpiCard label="Törölve" value={statusCount["cancelled"] ?? 0} icon={AlertTriangle} color="bg-red-500" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-border rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
            <ClipboardList size={15} className="text-primary" /> Státusz megoszlás
          </h3>
          <div className="space-y-2">
            {Object.entries(statusCount).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[k] ?? "bg-gray-300"}`} />
                <span className="text-sm flex-1">{STATUS_HU[k] ?? k}</span>
                <span className="font-semibold text-sm">{v}</span>
              </div>
            ))}
            {Object.keys(statusCount).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nincs rendelés</p>
            )}
          </div>
        </div>

        <div className="bg-white border border-border rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sm text-foreground mb-4 flex items-center gap-2">
            <Package size={15} className="text-primary" /> Top termékek (db)
          </h3>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nincs adat</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map(p => {
                const maxQty = topProducts[0]?.qty ?? 1;
                return (
                  <div key={p.name} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-32 truncate">{p.name}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((p.qty / maxQty) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-mono font-semibold w-16 text-right">{p.qty.toLocaleString("hu-HU")} db</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <Calendar size={15} className="text-primary" /> Havi rendelésszám (határidő szerint)
          </h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={exportOrderCSV}>
              <Download size={12} /> CSV
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={exportOrderTXT}>
              <Download size={12} /> TXT
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={exportOrderPDF}>
              <FileText size={12} /> PDF
            </Button>
          </div>
        </div>
        <BarChartSVG data={monthlyChart} color="hsl(142, 60%, 45%)" />
      </div>
    </div>
  );
}

// ======= KARBANTARTÁS TAB =======
function MaintenanceSummary({ logs, machines }: { logs: MaintenanceLog[]; machines: Machine[] }) {
  const totalCost = logs.reduce((s, l) => s + (l.cost ?? 0), 0);
  const totalHours = logs.reduce((s, l) => s + (l.durationHours ?? 0), 0);
  const done = logs.filter(l => l.status === "done").length;

  const typeCount: Record<string, number> = {};
  logs.forEach(l => { typeCount[l.type] = (typeCount[l.type] ?? 0) + 1; });

  const machineCost: Record<number, number> = {};
  logs.forEach(l => { machineCost[l.machineId] = (machineCost[l.machineId] ?? 0) + (l.cost ?? 0); });
  const machineCostRows = machines
    .map(m => ({ name: m.name, cost: machineCost[m.id] ?? 0 }))
    .filter(m => m.cost > 0)
    .sort((a, b) => b.cost - a.cost);

  const TYPE_HU: Record<string, string> = {
    preventive: "Megelőző", corrective: "Hibaelhárítás", inspection: "Vizsgálat",
  };

  function exportCSV() {
    const headers = ["Bejegyzes", "Tipus", "Statusz", "Utemezett", "Technikus", "Ido (h)", "Koltseg (Ft)"];
    const rows = logs.map(l => [
      l.title, TYPE_HU[l.type] ?? l.type, l.status,
      l.scheduledDate ?? "-", l.technicianName ?? "-",
      String(l.durationHours ?? 0), String(l.cost ?? 0),
    ]);
    downloadFile(toCSV(headers, rows), `karbantartas-riport-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function exportMaintPDF() {
    const kpiHtml = `<div>
      <span class="kpi"><div class="label">Osszes bejegyzes</div><div class="value">${logs.length}</div></span>
      <span class="kpi"><div class="label">Elvegzett</div><div class="value">${done}</div></span>
      <span class="kpi"><div class="label">Osszes ora</div><div class="value">${totalHours} h</div></span>
      <span class="kpi"><div class="label">Osszes koltseg</div><div class="value">${totalCost.toLocaleString("hu-HU")} Ft</div></span>
    </div>`;
    const tableHtml = `<h2>Karbantartasi naplo</h2>
      <table><tr><th>Cim</th><th>Tipus</th><th>Statusz</th><th>Datum</th><th>Technikus</th><th>Ido (h)</th><th>Koltseg (Ft)</th></tr>
      ${logs.map(l => `<tr>
        <td>${l.title}</td><td>${TYPE_HU[l.type] ?? l.type}</td><td>${l.status}</td>
        <td>${l.scheduledDate ?? "-"}</td><td>${l.technicianName ?? "-"}</td>
        <td>${l.durationHours ?? 0}</td><td>${(l.cost ?? 0).toLocaleString("hu-HU")}</td>
      </tr>`).join("")}
      </table>`;
    printPDF("Karbantartasi Riport — ProdAI", `<h1>Karbantartasi Riport</h1>${kpiHtml}${tableHtml}`);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Összes bejegyzés" value={logs.length} icon={CalendarClock} color="bg-primary" />
        <KpiCard label="Elvégzett" value={done} icon={CheckCircle2} color="bg-green-500" />
        <KpiCard label="Összes óra" value={totalHours + " h"} icon={Clock} color="bg-amber-500" />
        <KpiCard label="Összes költség" value={totalCost.toLocaleString("hu-HU") + " Ft"} icon={TrendingUp} color="bg-blue-500" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-border rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sm text-foreground mb-4">Karbantartás típus</h3>
          <div className="space-y-2">
            {Object.entries(typeCount).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="text-sm flex-1">{TYPE_HU[k] ?? k}</span>
                <Badge variant="outline">{v} db</Badge>
              </div>
            ))}
            {Object.keys(typeCount).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nincs adat</p>
            )}
          </div>
        </div>

        <div className="bg-white border border-border rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-sm text-foreground mb-4">Karbantartási költség gépenként</h3>
          {machineCostRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nincs adat</p>
          ) : (
            <div className="space-y-2">
              {machineCostRows.map(r => {
                const maxCost = machineCostRows[0]?.cost ?? 1;
                return (
                  <div key={r.name} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-32 truncate">{r.name}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.round((r.cost / maxCost) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-mono font-semibold w-24 text-right">{r.cost.toLocaleString("hu-HU")} Ft</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" className="gap-1.5 text-sm" onClick={exportCSV}>
          <Download size={14} /> CSV export
        </Button>
        <Button variant="outline" className="gap-1.5 text-sm" onClick={exportMaintPDF}>
          <FileText size={14} /> PDF export
        </Button>
      </div>
    </div>
  );
}

// ======= FŐ OLDAL =======
export default function ReportsPage() {
  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ["/api/tasks"] });
  const { data: orders = [] } = useQuery<Order[]>({ queryKey: ["/api/orders"] });
  const { data: machines = [] } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: maintenance = [] } = useQuery<MaintenanceLog[]>({ queryKey: ["/api/maintenance"] });

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart2 size={20} className="text-primary" /> Riportok &amp; Kimutatások
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Termelési, rendelési és karbantartási összesítők – CSV és TXT exporttal
        </p>
      </div>

      <Tabs defaultValue="production">
        <TabsList>
          <TabsTrigger value="production"><BarChart2 size={14} className="mr-2" />Termelés</TabsTrigger>
          <TabsTrigger value="orders"><ClipboardList size={14} className="mr-2" />Rendelések</TabsTrigger>
          <TabsTrigger value="maintenance"><CalendarClock size={14} className="mr-2" />Karbantartás</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="production">
            <ProductionReport tasks={tasks} machines={machines} products={products} />
          </TabsContent>
          <TabsContent value="orders">
            <OrderReport orders={orders} products={products} />
          </TabsContent>
          <TabsContent value="maintenance">
            <MaintenanceSummary logs={maintenance} machines={machines} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
