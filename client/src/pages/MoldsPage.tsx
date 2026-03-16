import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Wrench, Plus, Search, Pencil, Trash2, AlertTriangle,
  CheckCircle2, Clock, BarChart2, X, ChevronRight, Package, Cpu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Machine, Product } from "@shared/schema";

interface Mold {
  id: number; name: string; moldNumber: string;
  productId: number; machineId: number; material: string;
  cavities: number; status: string; location: string;
  totalShots: number; maxShots: number;
  lastMaintenanceDate: string; nextMaintenanceDate: string;
  notes: string; manufacturer: string; yearOfManufacture: number; weight: number;
}

const EMPTY_MOLD = {
  name: "", moldNumber: "", productId: 0, machineId: 0, material: "P20",
  cavities: 1, status: "active", location: "", totalShots: 0, maxShots: 500000,
  lastMaintenanceDate: "", nextMaintenanceDate: "", notes: "",
  manufacturer: "", yearOfManufacture: new Date().getFullYear(), weight: 0,
};

function statusBadge(status: string) {
  if (status === "active") return <Badge className="bg-green-100 text-green-700 border-green-200">Aktív</Badge>;
  if (status === "maintenance") return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Karbantartás</Badge>;
  return <Badge className="bg-gray-100 text-gray-500 border-gray-200">Kivont</Badge>;
}

function ShotProgress({ total, max }: { total: number; max: number }) {
  const pct = Math.min((total / max) * 100, 100);
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-400" : "bg-green-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{total.toLocaleString("hu-HU")} lövés</span>
        <span className={`font-semibold ${pct > 90 ? "text-red-600" : pct > 70 ? "text-amber-600" : "text-green-600"}`}>{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">{(max - total).toLocaleString("hu-HU")} lövés a következő karbantartásig</p>
    </div>
  );
}

function MoldForm({ initial, onSave, onCancel, machines, products }: {
  initial: Partial<Mold>; onSave: (data: any) => void; onCancel: () => void;
  machines: Machine[]; products: Product[];
}) {
  const [form, setForm] = useState({ ...EMPTY_MOLD, ...initial });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="bg-white border border-border rounded-xl p-5 space-y-4 shadow-sm">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Szerszám neve *</label>
          <input className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.name} onChange={e => set("name", e.target.value)} placeholder="pl. BMW futómű forma A" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Szerszámszám *</label>
          <input className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.moldNumber} onChange={e => set("moldNumber", e.target.value)} placeholder="pl. FM-005" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Hozzárendelt termék</label>
          <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.productId} onChange={e => set("productId", Number(e.target.value))}>
            <option value={0}>— Nincs hozzárendelve —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Hozzárendelt gép</label>
          <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.machineId} onChange={e => set("machineId", Number(e.target.value))}>
            <option value={0}>— Nincs hozzárendelve —</option>
            {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Anyag</label>
          <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.material} onChange={e => set("material", e.target.value)}>
            {["P20","H13","S136","NAK80","2344","2083","Egyéb"].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Fészekszám</label>
          <input type="number" min={1} max={32} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.cavities} onChange={e => set("cavities", Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Státusz</label>
          <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.status} onChange={e => set("status", e.target.value)}>
            <option value="active">Aktív</option>
            <option value="maintenance">Karbantartás</option>
            <option value="retired">Kivont</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Jelenlegi lövésszám</label>
          <input type="number" min={0} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.totalShots} onChange={e => set("totalShots", Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Max lövés (karbantartásig)</label>
          <input type="number" min={1000} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.maxShots} onChange={e => set("maxShots", Number(e.target.value))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Utolsó karbantartás</label>
          <input type="date" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.lastMaintenanceDate} onChange={e => set("lastMaintenanceDate", e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Következő karbantartás</label>
          <input type="date" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.nextMaintenanceDate} onChange={e => set("nextMaintenanceDate", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Gyártó</label>
          <input className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.manufacturer} onChange={e => set("manufacturer", e.target.value)} placeholder="pl. Hasco" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Gyártási év</label>
          <input type="number" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.yearOfManufacture} onChange={e => set("yearOfManufacture", Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Tömeg (kg)</label>
          <input type="number" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.weight} onChange={e => set("weight", Number(e.target.value))} />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Tárolási hely</label>
        <input className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          value={form.location} onChange={e => set("location", e.target.value)} placeholder="pl. A raktár – 3. polc" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Megjegyzés</label>
        <textarea rows={2} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          value={form.notes} onChange={e => set("notes", e.target.value)} />
      </div>
      <div className="flex gap-3 pt-1">
        <Button variant="outline" onClick={onCancel} className="gap-1.5"><X size={13} /> Mégse</Button>
        <Button className="flex-1 gap-1.5" onClick={() => onSave(form)}
          disabled={!form.name || !form.moldNumber}>
          <CheckCircle2 size={13} /> Mentés
        </Button>
      </div>
    </div>
  );
}

export default function MoldsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [tab, setTab] = useState("list");

  const { data: molds = [] } = useQuery<Mold[]>({ queryKey: ["/api/molds"] });
  const { data: machines = [] } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => { const r = await apiRequest("POST", "/api/molds", data); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/molds"] }); toast({ title: "Szerszám mentve" }); setTab("list"); },
    onError: () => toast({ title: "Mentési hiba", variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => { const r = await apiRequest("PATCH", `/api/molds/${id}`, data); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/molds"] }); toast({ title: "Módosítás mentve" }); setEditId(null); setTab("list"); },
    onError: () => toast({ title: "Mentési hiba", variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { const r = await apiRequest("DELETE", `/api/molds/${id}`); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/molds"] }); toast({ title: "Szerszám törölve" }); },
  });

  const filtered = molds.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.moldNumber.toLowerCase().includes(search.toLowerCase())
  );

  const editMold = molds.find(m => m.id === editId);

  // KPI-ok
  const active = molds.filter(m => m.status === "active").length;
  const maintenance = molds.filter(m => m.status === "maintenance").length;
  const critical = molds.filter(m => (m.totalShots / m.maxShots) > 0.9).length;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Wrench size={20} className="text-primary" /> Szerszámok / Formák
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Fröccsöntő formák nyilvántartása, lövésszám-követés és karbantartás tervezés</p>
      </div>

      {/* KPI sor */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Aktív szerszám", value: active, color: "text-green-600", bg: "bg-green-50 border-green-100" },
          { label: "Karbantartáson", value: maintenance, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
          { label: "Kritikus (>90%)", value: critical, color: "text-red-600", bg: "bg-red-50 border-red-100" },
        ].map(k => (
          <div key={k.label} className={`border rounded-xl px-4 py-3 ${k.bg}`}>
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="list"><Wrench size={14} className="mr-2" />Lista</TabsTrigger>
          <TabsTrigger value="new"><Plus size={14} className="mr-2" />Új szerszám</TabsTrigger>
          {editId && <TabsTrigger value="edit"><Pencil size={14} className="mr-2" />Szerkesztés</TabsTrigger>}
        </TabsList>

        <div className="mt-4">
          {/* Lista */}
          <TabsContent value="list">
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input className="w-full border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Keresés névben vagy szerszámszámban..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {["Szerszámszám","Megnevezés","Termék / Gép","Fészek / Anyag","Lövésszám állapot","Státusz",""].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">Nincs találat</td></tr>
                  ) : filtered.map(mold => {
                    const prod = products.find(p => p.id === mold.productId);
                    const mach = machines.find(m => m.id === mold.machineId);
                    return (
                      <tr key={mold.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{mold.moldNumber}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{mold.name}</p>
                          {mold.location && <p className="text-xs text-muted-foreground">{mold.location}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground space-y-0.5">
                          {prod && <div className="flex items-center gap-1"><Package size={11} />{prod.sku}</div>}
                          {mach && <div className="flex items-center gap-1"><Cpu size={11} />{mach.name}</div>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="font-medium">{mold.cavities} fészek</span>
                          <span className="text-muted-foreground ml-1">· {mold.material}</span>
                        </td>
                        <td className="px-4 py-3 w-48">
                          <ShotProgress total={mold.totalShots} max={mold.maxShots} />
                        </td>
                        <td className="px-4 py-3">{statusBadge(mold.status)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                              onClick={() => { setEditId(mold.id); setTab("edit"); }}>
                              <Pencil size={12} />
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:border-red-200"
                              onClick={() => deleteMutation.mutate(mold.id)}>
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

          {/* Új szerszám */}
          <TabsContent value="new">
            <MoldForm
              initial={EMPTY_MOLD}
              machines={machines}
              products={products}
              onSave={data => createMutation.mutate(data)}
              onCancel={() => setTab("list")}
            />
          </TabsContent>

          {/* Szerkesztés */}
          <TabsContent value="edit">
            {editMold && (
              <MoldForm
                initial={editMold}
                machines={machines}
                products={products}
                onSave={data => updateMutation.mutate({ id: editMold.id, data })}
                onCancel={() => { setEditId(null); setTab("list"); }}
              />
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
