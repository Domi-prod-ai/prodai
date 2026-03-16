import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, CheckCircle2, Clock, Play, AlertCircle, Package, X, Save, RotateCcw } from "lucide-react";
import type { Order, Product } from "@shared/schema";

// ─── Konstansok ───────────────────────────────────────────────────────────────
const PRIORITIES = [
  { value: "urgent", label: "Sürgős", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "high",   label: "Magas",  color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "normal", label: "Normál", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "low",    label: "Alacsony", color: "bg-gray-100 text-gray-600 border-gray-200" },
];

const STATUSES = [
  { value: "pending",     label: "Függőben",    Icon: Clock,         bg: "bg-gray-100 text-gray-600 border-gray-200" },
  { value: "planned",     label: "Tervezett",   Icon: AlertCircle,   bg: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "in_progress", label: "Folyamatban", Icon: Play,          bg: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "done",        label: "Kész",        Icon: CheckCircle2,  bg: "bg-green-100 text-green-700 border-green-200" },
];

function PriorityBadge({ priority }: { priority: string }) {
  const p = PRIORITIES.find(x => x.value === priority) ?? PRIORITIES[2];
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${p.color}`}>{p.label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUSES.find(x => x.value === status) ?? STATUSES[0];
  const { Icon } = s;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${s.bg}`}>
      <Icon size={11} />{s.label}
    </span>
  );
}

// ─── Rendelés form (Új + Szerkesztés) ────────────────────────────────────────
interface OrderFormState {
  orderNumber: string;
  customer: string;
  productId: string;
  quantity: string;
  priority: string;
  status: string;
  dueDate: string;
  notes: string;
}

function emptyForm(): OrderFormState {
  return {
    orderNumber: `ORD-2026-${String(Date.now()).slice(-3)}`,
    customer: "",
    productId: "",
    quantity: "50",
    priority: "normal",
    status: "pending",
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    notes: "",
  };
}

function OrderForm({
  products,
  initial,
  onSave,
  onCancel,
  isSaving,
  isEdit,
}: {
  products: Product[];
  initial: OrderFormState;
  onSave: (f: OrderFormState) => void;
  onCancel?: () => void;
  isSaving: boolean;
  isEdit: boolean;
}) {
  const [form, setForm] = useState<OrderFormState>(initial);
  const set = (k: keyof OrderFormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  const inputCls = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="max-w-2xl bg-white border border-border rounded-xl p-6 shadow-sm space-y-4">
      <h2 className="font-semibold text-foreground text-sm">
        {isEdit ? `Rendelés szerkesztése: ${initial.orderNumber}` : "Új rendelés felvitele"}
      </h2>

      <div className="grid grid-cols-2 gap-3">
        {/* Rendelésszám */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Rendelésszám *</label>
          <input className={`${inputCls} font-mono`} value={form.orderNumber}
            onChange={e => set("orderNumber", e.target.value)} data-testid="input-order-number" />
        </div>

        {/* Vevő */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Vevő neve</label>
          <input className={inputCls} placeholder="pl. BMW Kft., Bosch Hungary..."
            value={form.customer} onChange={e => set("customer", e.target.value)}
            data-testid="input-customer" />
        </div>

        {/* Termék */}
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Termék *</label>
          <select className={inputCls} value={form.productId}
            onChange={e => set("productId", e.target.value)} data-testid="select-product">
            <option value="">— Válassz terméket —</option>
            {products.map(p => (
              <option key={p.id} value={String(p.id)}>
                {p.sku} — {p.name}
                {p.material ? ` (${p.material})` : ""}
              </option>
            ))}
          </select>
          {products.length === 0 && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertCircle size={12} /> Nincs még termék a rendszerben. Előbb add fel a termékeket.
            </p>
          )}
        </div>

        {/* Mennyiség */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Mennyiség (db) *</label>
          <input type="number" min="1" className={inputCls} value={form.quantity}
            onChange={e => set("quantity", e.target.value)} data-testid="input-quantity" />
        </div>

        {/* Határidő */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Határidő *</label>
          <input type="date" className={inputCls} value={form.dueDate}
            onChange={e => set("dueDate", e.target.value)} data-testid="input-due-date" />
        </div>

        {/* Prioritás */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioritás</label>
          <select className={inputCls} value={form.priority}
            onChange={e => set("priority", e.target.value)} data-testid="select-priority">
            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {/* Státusz */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Státusz</label>
          <select className={inputCls} value={form.status}
            onChange={e => set("status", e.target.value)} data-testid="select-status">
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {/* Megjegyzés */}
        <div className="col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Megjegyzés</label>
          <textarea className={`${inputCls} resize-none`} rows={2}
            placeholder="Különleges utasítások, technológiai megjegyzések..."
            value={form.notes} onChange={e => set("notes", e.target.value)}
            data-testid="input-notes" />
        </div>
      </div>

      {/* Gombok */}
      <div className="flex gap-2 pt-1">
        {onCancel && (
          <Button variant="outline" type="button" onClick={onCancel} className="gap-1">
            <X size={14} /> Mégse
          </Button>
        )}
        <Button
          className="flex-1 gap-2"
          disabled={isSaving || !form.orderNumber || !form.productId || !form.quantity || !form.dueDate}
          onClick={() => onSave(form)}
          data-testid="btn-save-order"
        >
          <Save size={14} />
          {isSaving ? "Mentés..." : isEdit ? "Változtatások mentése" : "Rendelés létrehozása"}
        </Button>
      </div>
    </div>
  );
}

// ─── Rendelések lista ─────────────────────────────────────────────────────────
function OrdersList({
  orders,
  products,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  orders: Order[];
  products: Product[];
  onEdit: (o: Order) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: string) => void;
}) {
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [search, setSearch] = useState("");

  const getProduct = (id: number) => products.find(p => p.id === id);

  const filtered = orders.filter(o => {
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
    if (filterPriority !== "all" && o.priority !== filterPriority) return false;
    if (search) {
      const q = search.toLowerCase();
      const prod = getProduct(o.productId);
      if (!o.orderNumber.toLowerCase().includes(q) &&
          !(o.customer || "").toLowerCase().includes(q) &&
          !(prod?.name || "").toLowerCase().includes(q) &&
          !(prod?.sku || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // KPI összesítők
  const counts = STATUSES.reduce((acc, s) => { acc[s.value] = orders.filter(o => o.status === s.value).length; return acc; }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* KPI kártyák — kattinthatók filterként */}
      <div className="grid grid-cols-4 gap-3">
        {STATUSES.map(s => {
          const { Icon } = s;
          const active = filterStatus === s.value;
          return (
            <button key={s.value}
              onClick={() => setFilterStatus(active ? "all" : s.value)}
              data-testid={`status-card-${s.value}`}
              className={`text-left p-4 rounded-xl border transition-all ${active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-white hover:border-primary/30"}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <Icon size={14} className={active ? "text-primary" : "text-muted-foreground"} />
                <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
              </div>
              <div className="text-2xl font-bold text-foreground tabular-nums">{counts[s.value] ?? 0}</div>
            </button>
          );
        })}
      </div>

      {/* Keresés + prioritás filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <input
            className="w-full border border-border rounded-lg pl-3 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Keresés rendelésszám, vevő, termék alapján..."
            value={search} onChange={e => setSearch(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground">Prioritás:</span>
          {["all", ...PRIORITIES.map(p => p.value)].map(pv => (
            <button key={pv}
              onClick={() => setFilterPriority(pv)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${filterPriority === pv ? "bg-primary text-primary-foreground border-primary" : "bg-white border-border text-muted-foreground hover:border-primary/40"}`}
              data-testid={`filter-${pv}`}>
              {pv === "all" ? "Mind" : PRIORITIES.find(p => p.value === pv)?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tábla */}
      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rendelésszám</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Vevő</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Termék</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mennyi.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prior.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Határidő</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Státusz</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const product = getProduct(o.productId);
                return (
                  <tr key={o.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors" data-testid={`order-row-${o.id}`}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[120px] truncate">{o.customer || "—"}</td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: product?.color || "#888" }} />
                        <div className="min-w-0">
                          <div className="text-sm text-foreground font-medium truncate">{product?.name || "—"}</div>
                          {product?.sku && <div className="text-xs text-muted-foreground font-mono">{product.sku}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-foreground font-medium text-sm">{o.quantity} db</td>
                    <td className="px-4 py-3"><PriorityBadge priority={o.priority} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">{o.dueDate}</td>
                    <td className="px-4 py-3">
                      {/* Inline státusz váltó */}
                      <select
                        value={o.status}
                        onChange={e => onStatusChange(o.id, e.target.value)}
                        className="text-xs border border-border rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                        data-testid={`status-select-${o.id}`}
                      >
                        {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => onEdit(o)} data-testid={`btn-edit-order-${o.id}`}>
                          <Pencil size={13} />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                          onClick={() => onDelete(o.id)} data-testid={`btn-delete-order-${o.id}`}>
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center">
                    <Package size={36} className="mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm font-medium">Nincs találat</p>
                    <p className="text-muted-foreground text-xs mt-1">Módosítsd a szűrőket, vagy adj hozzá új rendelést.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Fő oldal ─────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("list");
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: orders = [] } = useQuery<Order[]>({ queryKey: ["/api/orders"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const createMutation = useMutation({
    mutationFn: async (f: OrderFormState) => {
      const res = await apiRequest("POST", "/api/orders", {
        orderNumber: f.orderNumber,
        customer: f.customer,
        productId: Number(f.productId),
        quantity: Number(f.quantity),
        priority: f.priority,
        status: f.status,
        dueDate: f.dueDate,
        notes: f.notes,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Rendelés létrehozva", description: "Sikeresen felvéve a rendszerbe." });
      setActiveTab("list");
    },
    onError: (err: any) => toast({ title: "Hiba", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, f }: { id: number; f: OrderFormState }) => {
      const res = await apiRequest("PATCH", `/api/orders/${id}`, {
        orderNumber: f.orderNumber,
        customer: f.customer,
        productId: Number(f.productId),
        quantity: Number(f.quantity),
        priority: f.priority,
        status: f.status,
        dueDate: f.dueDate,
        notes: f.notes,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Rendelés frissítve" });
      setActiveTab("list");
      setEditOrder(null);
    },
    onError: (err: any) => toast({ title: "Hiba", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/orders/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Rendelés törölve", variant: "destructive" });
      setDeleteId(null);
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/orders/${id}`, { status });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/orders"] }),
  });

  function handleEdit(o: Order) {
    setEditOrder(o);
    setActiveTab("edit");
  }

  function editFormInitial(): OrderFormState {
    if (!editOrder) return emptyForm();
    return {
      orderNumber: editOrder.orderNumber,
      customer: editOrder.customer || "",
      productId: String(editOrder.productId),
      quantity: String(editOrder.quantity),
      priority: editOrder.priority,
      status: editOrder.status,
      dueDate: editOrder.dueDate,
      notes: editOrder.notes || "",
    };
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Rendelések</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{orders.length} rendelés összesen</p>
        </div>
        <Button onClick={() => { setEditOrder(null); setActiveTab("new"); }} className="gap-2" data-testid="btn-new-order">
          <Plus size={14} /> Új rendelés
        </Button>
      </div>

      {/* Fülek */}
      <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); if (v !== "edit") setEditOrder(null); }}>
        <TabsList>
          <TabsTrigger value="list" data-testid="tab-orders-list">Rendelések listája</TabsTrigger>
          <TabsTrigger value="new" data-testid="tab-orders-new">
            <Plus size={13} className="mr-1" /> Új rendelés
          </TabsTrigger>
          {editOrder && (
            <TabsTrigger value="edit" data-testid="tab-orders-edit">
              <Pencil size={13} className="mr-1" /> Szerkesztés
            </TabsTrigger>
          )}
        </TabsList>

        <div className="mt-4">
          {/* Lista */}
          <TabsContent value="list">
            <OrdersList
              orders={orders}
              products={products}
              onEdit={handleEdit}
              onDelete={id => setDeleteId(id)}
              onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
            />
          </TabsContent>

          {/* Új rendelés */}
          <TabsContent value="new">
            <OrderForm
              products={products}
              initial={emptyForm()}
              onSave={f => createMutation.mutate(f)}
              isSaving={createMutation.isPending}
              isEdit={false}
            />
          </TabsContent>

          {/* Szerkesztés */}
          <TabsContent value="edit">
            {editOrder && (
              <OrderForm
                products={products}
                initial={editFormInitial()}
                onSave={f => updateMutation.mutate({ id: editOrder.id, f })}
                onCancel={() => { setActiveTab("list"); setEditOrder(null); }}
                isSaving={updateMutation.isPending}
                isEdit={true}
              />
            )}
          </TabsContent>
        </div>
      </Tabs>

      {/* Törlés megerősítés */}
      <AlertDialog open={deleteId !== null} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rendelés törlése</AlertDialogTitle>
            <AlertDialogDescription>
              Biztosan törlöd ezt a rendelést? Ez a művelet nem vonható vissza.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700 text-white">
              Törlés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
