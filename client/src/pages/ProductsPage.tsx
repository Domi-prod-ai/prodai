import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Plus, Pencil, Trash2, Upload, Search, FileText, CheckCircle, AlertCircle, X, CheckCircle2, Database } from "lucide-react";
import type { Product } from "@shared/schema";

const productFormSchema = z.object({
  name: z.string().min(2, "Min. 2 karakter"),
  sku: z.string().min(1, "Cikkszám kötelező"),
  unit: z.string().default("db"),
  cycleTimeMinutes: z.coerce.number().min(1, "Min. 1 perc"),
  color: z.string().default("#4f98a3"),
  material: z.string().default(""),
  weight: z.coerce.number().default(0),
  machineType: z.string().default(""),
  notes: z.string().default(""),
});
type ProductForm = z.infer<typeof productFormSchema>;

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  });
}

export default function ProductsPage() {
  const { toast } = useToast();
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [searchSku, setSearchSku] = useState("");
  const [skuResult, setSkuResult] = useState<Product | null>(null);
  const [skuError, setSkuError] = useState("");
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Külső adatbázis import állapot
  const [dbRows, setDbRows] = useState<Record<string, string>[]>([]);
  const [dbFileRef] = useState(() => ({ current: null as HTMLInputElement | null }));
  const dbInputRef = useRef<HTMLInputElement>(null);
  const [dbImportResult, setDbImportResult] = useState<{ created: number; errors: string[] } | null>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const form = useForm<ProductForm>({
    resolver: zodResolver(productFormSchema),
    defaultValues: { name: "", sku: "", unit: "db", cycleTimeMinutes: 60, color: "#4f98a3", material: "", weight: 0, machineType: "", notes: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ProductForm) => {
      const res = await apiRequest("POST", "/api/products", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Termék hozzáadva", description: "Az adatbázisba sikeresen felvéve." });
      setEditDialogOpen(false);
      form.reset();
    },
    onError: (err: any) => toast({ title: "Hiba", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: ProductForm }) => {
      const res = await apiRequest("PATCH", `/api/products/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Termék frissítve" });
      setEditDialogOpen(false);
      setEditProduct(null);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/products/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Termék törölve", variant: "destructive" });
      setDeleteId(null);
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async (items: Record<string, string>[]) => {
      const res = await apiRequest("POST", "/api/products/bulk", { items });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: `${data.created} termék importálva`, description: data.errors?.length ? `${data.errors.length} sor hibás.` : "Mind sikeresen felvéve." });
      setCsvPreview([]);
    },
    onError: () => toast({ title: "Import hiba", variant: "destructive" }),
  });

  function openCreate() {
    setEditProduct(null);
    form.reset({ name: "", sku: "", unit: "db", cycleTimeMinutes: 60, color: "#4f98a3", material: "", weight: 0, machineType: "", notes: "" });
    setEditDialogOpen(true);
  }

  function openEdit(p: Product) {
    setEditProduct(p);
    form.reset({ name: p.name, sku: p.sku, unit: p.unit, cycleTimeMinutes: p.cycleTimeMinutes, color: p.color, material: p.material || "", weight: p.weight || 0, machineType: p.machineType || "", notes: p.notes || "" });
    setEditDialogOpen(true);
  }

  function onSubmit(data: ProductForm) {
    if (editProduct) updateMutation.mutate({ id: editProduct.id, data });
    else createMutation.mutate(data);
  }

  async function handleSkuSearch() {
    setSkuError(""); setSkuResult(null);
    if (!searchSku.trim()) return;
    try {
      const res = await apiRequest("GET", `/api/products/search?sku=${encodeURIComponent(searchSku.trim())}`);
      setSkuResult(await res.json() as Product);
    } catch {
      setSkuError(`Nem található termék: "${searchSku}"`);
    }
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setCsvPreview(parseCsv(ev.target?.result as string)); };
    reader.readAsText(file, "UTF-8");
  }

  function handleDbFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setDbRows(parseCsv(ev.target?.result as string)); setDbImportResult(null); };
    reader.readAsText(file, "UTF-8");
  }

  async function importDbRows() {
    if (dbRows.length === 0) return;
    // Rugalmas oszlopnév-leképezés — különböző exportformátumokhoz
    const mapped = dbRows.map((row, i) => ({
      name: row.name || row["Termék neve"] || row["termek_neve"] || row["product_name"] || `Termék ${i + 1}`,
      sku: row.sku || row["SKU"] || row["Cikkszám"] || row["cikkszam"] || row["article_number"] || `SKU-${Date.now()}-${i}`,
      unit: row.unit || row["Egység"] || row["egyseg"] || "db",
      cycleTimeMinutes: row.cycleTimeMinutes || row["Ciklus idő (perc)"] || row["ciklusido"] || "60",
      material: row.material || row["Anyag"] || row["anyag"] || "",
      weight: row.weight || row["Tömeg"] || row["tomeg"] || row["Tömeg (g)"] || "0",
      machineType: row.machineType || row["Gép típusa"] || row["gep_tipusa"] || row["machine_type"] || "",
      notes: row.notes || row["Megjegyzés"] || row["megjegyzes"] || "",
      color: row.color || "#4f98a3",
    }));
    const res = await apiRequest("POST", "/api/products/bulk", { items: mapped });
    const data = await res.json() as any;
    queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    setDbImportResult({ created: data.created, errors: data.errors || [] });
    toast({ title: `${data.created} termék importálva`, description: data.errors?.length ? `${data.errors.length} hiba.` : "Mind sikeresen felvéve." });
    if (!data.errors?.length) setDbRows([]);
  }

  const csvTemplate = `name,sku,unit,cycleTimeMinutes,material,weight,machineType,notes\nAlumínium profil X1,ALU-X1,db,45,AlSi9Cu3,185,CNC,Példa termék\nMűanyag burkolat Y2,MUA-Y2,db,20,ABS,45,Fröccsöntés,`;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Termékadatbázis</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{products.length} termék a rendszerben</p>
        </div>
        <Button onClick={openCreate} data-testid="button-add-product" className="gap-2">
          <Plus size={16} /> Új termék
        </Button>
      </div>

      <Tabs defaultValue="list">
        <TabsList className="mb-4">
          <TabsTrigger value="list" data-testid="tab-list">Termékek listája</TabsTrigger>
          <TabsTrigger value="search" data-testid="tab-search">Kód alapján keresés</TabsTrigger>
          <TabsTrigger value="import" data-testid="tab-import">CSV import</TabsTrigger>
          <TabsTrigger value="dbimport" data-testid="tab-dbimport">
            <Database size={13} className="mr-1" />Külső adatbázis
          </TabsTrigger>
        </TabsList>

        {/* ── Lista ── */}
        <TabsContent value="list">
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-lg" />)}</div>
          ) : (
            <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cikkszám</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Termék neve</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Anyag</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gép típus</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ciklus</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tömeg</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors" data-testid={`product-row-${p.id}`}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                          {p.sku}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{p.material || "—"}</td>
                      <td className="px-4 py-3">
                        {p.machineType ? <Badge variant="outline" className="text-xs">{p.machineType}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs tabular-nums">{p.cycleTimeMinutes} perc</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs tabular-nums">{p.weight ? `${p.weight} g` : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(p)} data-testid={`edit-product-${p.id}`}><Pencil size={13} /></Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-red-600" onClick={() => setDeleteId(p.id)} data-testid={`delete-product-${p.id}`}><Trash2 size={13} /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      <Package size={32} className="mx-auto mb-2 opacity-30" />
                      Még nincs termék. Add hozzá manuálisan vagy importáld CSV-ből.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Kód alapján keresés ── */}
        <TabsContent value="search">
          <div className="max-w-lg space-y-4">
            <Card className="border border-border shadow-sm">
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-4">Adj meg egy cikkszámot (SKU), és a rendszer megkeresi a termék adatait és az optimális gépet.</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="pl. ALU-A1, MUA-C3..."
                    value={searchSku}
                    onChange={e => { setSearchSku(e.target.value); setSkuResult(null); setSkuError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleSkuSearch()}
                    data-testid="input-sku-search"
                    className="font-mono"
                  />
                  <Button onClick={handleSkuSearch} data-testid="button-sku-search" className="gap-2">
                    <Search size={15} /> Keresés
                  </Button>
                </div>
                {skuError && (
                  <div className="mt-3 flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <AlertCircle size={14} />{skuError}
                  </div>
                )}
                {skuResult && (
                  <div className="mt-4 border border-green-200 bg-green-50 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={16} className="text-green-600" />
                      <span className="font-semibold text-green-800">Termék megtalálva</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {[
                        ["Termék neve", skuResult.name],
                        ["Cikkszám (SKU)", skuResult.sku],
                        ["Anyag", skuResult.material || "—"],
                        ["Tömeg", skuResult.weight ? `${skuResult.weight} g` : "—"],
                        ["Ciklus idő", `${skuResult.cycleTimeMinutes} perc`],
                        ["Optimális gép típus", skuResult.machineType || "—"],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <div className="text-xs text-muted-foreground">{label}</div>
                          <div className="font-medium text-foreground">{value}</div>
                        </div>
                      ))}
                    </div>
                    {skuResult.notes && (
                      <div className="text-xs text-muted-foreground bg-white border border-border rounded px-3 py-2">
                        Megjegyzés: {skuResult.notes}
                      </div>
                    )}
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(skuResult)}>
                      <Pencil size={12} /> Szerkesztés
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── CSV import ── */}
        <TabsContent value="import">
          <div className="max-w-3xl space-y-4">
            <Card className="border border-border shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <FileText size={20} className="text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm">CSV sablon</p>
                    <p className="text-xs text-muted-foreground mt-1">Töltsd le a sablont, töltsd ki Excelben, majd töltsd vissza.</p>
                    <p className="text-xs font-mono bg-muted rounded px-2 py-1 mt-2 text-muted-foreground">
                      name, sku, unit, cycleTimeMinutes, material, weight, machineType, notes
                    </p>
                    <Button size="sm" variant="outline" className="mt-3 gap-2"
                      onClick={() => {
                        const blob = new Blob([csvTemplate], { type: "text/csv;charset=utf-8;" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url; a.download = "termekek_sablon.csv"; a.click();
                      }}
                      data-testid="button-download-template">
                      <Upload size={13} /> Sablon letöltése
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-dashed border-primary/30 bg-primary/[0.02] shadow-sm">
              <CardContent className="p-6 text-center">
                <Upload size={28} className="mx-auto mb-3 text-primary/50" />
                <p className="text-sm font-medium text-foreground">Húzd ide a CSV fájlt, vagy kattints a feltöltéshez</p>
                <p className="text-xs text-muted-foreground mt-1">Csak .csv formátum, UTF-8 kódolás, vesszővel elválasztva</p>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} data-testid="input-csv-file" />
                <Button variant="outline" className="mt-4 gap-2" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={14} /> CSV kiválasztása
                </Button>
              </CardContent>
            </Card>

            {csvPreview.length > 0 && (
              <Card className="border border-border shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-green-600" />
                      <span className="font-medium text-sm text-foreground">{csvPreview.length} sor beolvasva</span>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setCsvPreview([])}>
                      <X size={14} />
                    </Button>
                  </div>
                  <div className="overflow-x-auto max-h-48 overflow-y-auto border border-border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/60">
                        <tr>
                          {Object.keys(csvPreview[0]).map(h => (
                            <th key={h} className="text-left px-3 py-2 text-muted-foreground font-semibold uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.slice(0, 10).map((row, i) => (
                          <tr key={i} className="border-t border-border/50 hover:bg-muted/20">
                            {Object.values(row).map((v, j) => (
                              <td key={j} className="px-3 py-1.5 text-foreground">{v || "—"}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {csvPreview.length > 10 && (
                    <p className="text-xs text-muted-foreground mt-2">+{csvPreview.length - 10} további sor...</p>
                  )}
                  <Button className="mt-4 gap-2 w-full" onClick={() => bulkMutation.mutate(csvPreview)}
                    disabled={bulkMutation.isPending} data-testid="button-confirm-import">
                    <Upload size={14} />
                    {bulkMutation.isPending ? "Importálás..." : `${csvPreview.length} termék importálása`}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Külső adatbázis import ── */}
        <TabsContent value="dbimport">
          <div className="max-w-3xl space-y-4">
            <Card className="border border-border shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Database size={20} className="text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground text-sm">Külső adatbázisból való termékfelvétel</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tölts fel bármilyen CSV exportot — az ERP, WMS, SAP, Excel adatbázisodból.
                      A rendszer automatikusan felismeri a leggyakoribb oszlopneveket (magyar és angol egyaránt).
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <p className="font-semibold text-foreground mb-1">Felismert oszlopok (magyar):</p>
                        <p>Termék neve, Cikkszám, Egység, Ciklus idő (perc)</p>
                        <p>Anyag, Tömeg, Gép típusa, Megjegyzés</p>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground mb-1">Felismert oszlopok (angol):</p>
                        <p>name, sku, unit, cycleTimeMinutes</p>
                        <p>material, weight, machine_type, notes</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="border border-dashed border-primary/30 bg-primary/[0.02] rounded-xl p-6 text-center">
              <Database size={28} className="mx-auto mb-3 text-primary/40" />
              <p className="text-sm font-medium text-foreground">Adatbázis export feltöltése</p>
              <p className="text-xs text-muted-foreground mt-1">CSV formátum (Excel-ből: Mentés másként → CSV UTF-8)</p>
              <input ref={dbInputRef} type="file" accept=".csv" className="hidden" onChange={handleDbFile} />
              <Button variant="outline" className="mt-4 gap-2" onClick={() => dbInputRef.current?.click()}>
                <Upload size={14} /> Fájl kiválasztása
              </Button>
            </div>

            {dbRows.length > 0 && (
              <Card className="border border-border shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={15} className="text-green-600" />
                      <span className="font-medium text-sm">{dbRows.length} sor beolvasva az adatbázis exportból</span>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setDbRows([]); setDbImportResult(null); }}>
                      <X size={14} />
                    </Button>
                  </div>
                  <div className="overflow-x-auto max-h-48 overflow-y-auto border border-border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/60">
                        <tr>
                          {Object.keys(dbRows[0]).slice(0, 6).map(h => (
                            <th key={h} className="text-left px-3 py-2 text-muted-foreground font-semibold">{h}</th>
                          ))}
                          {Object.keys(dbRows[0]).length > 6 && <th className="px-3 py-2 text-muted-foreground">+{Object.keys(dbRows[0]).length - 6} oszlop</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {dbRows.slice(0, 8).map((row, i) => (
                          <tr key={i} className="border-t border-border/50 hover:bg-muted/20">
                            {Object.values(row).slice(0, 6).map((v, j) => (
                              <td key={j} className="px-3 py-1.5">{v || "—"}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {dbRows.length > 8 && <p className="text-xs text-muted-foreground mt-2">+{dbRows.length - 8} további sor...</p>}
                  <Button className="mt-4 w-full gap-2" onClick={importDbRows}>
                    <Database size={14} /> {dbRows.length} termék importálása az adatbázisból
                  </Button>
                </CardContent>
              </Card>
            )}

            {dbImportResult && (
              <div className={`rounded-xl border px-4 py-3 text-sm ${dbImportResult.errors.length === 0 ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
                <p className="font-semibold">{dbImportResult.created} termék sikeresen importálva</p>
                {dbImportResult.errors.map((e, i) => (
                  <p key={i} className="text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} />{e}</p>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Termék dialog (szerkesztés / új) */}
      <Dialog open={editDialogOpen} onOpenChange={(v) => { setEditDialogOpen(v); if (!v) { setEditProduct(null); form.reset(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editProduct ? "Termék szerkesztése" : "Új termék hozzáadása"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Termék neve</FormLabel>
                    <FormControl><Input placeholder="pl. Alumínium alkatrész X1" {...field} data-testid="input-product-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="sku" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cikkszám (SKU)</FormLabel>
                    <FormControl><Input placeholder="pl. ALU-X1" {...field} className="font-mono" data-testid="input-product-sku" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="unit" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mértékegység</FormLabel>
                    <FormControl><Input placeholder="db" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="material" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anyag</FormLabel>
                    <FormControl><Input placeholder="pl. ABS, PP, AlSi9Cu3" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="machineType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gép típus</FormLabel>
                    <FormControl><Input placeholder="pl. CNC, Fröccsöntés" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="cycleTimeMinutes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ciklus idő (perc)</FormLabel>
                    <FormControl><Input type="number" min="1" {...field} data-testid="input-cycle-time" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="weight" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tömeg (gramm)</FormLabel>
                    <FormControl><Input type="number" min="0" step="0.1" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="color" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Szín jelölő</FormLabel>
                    <FormControl>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={field.value} onChange={e => field.onChange(e.target.value)} className="w-10 h-9 rounded border border-border cursor-pointer" />
                        <Input value={field.value} onChange={field.onChange} className="font-mono flex-1" />
                      </div>
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Megjegyzés</FormLabel>
                    <FormControl><Textarea rows={2} placeholder="Egyéb információ..." {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Mégse</Button>
                <Button type="submit" data-testid="button-save-product"
                  disabled={createMutation.isPending || updateMutation.isPending}>
                  {editProduct ? "Mentés" : "Termék hozzáadása"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Törlés megerősítés */}
      <AlertDialog open={deleteId !== null} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Termék törlése</AlertDialogTitle>
            <AlertDialogDescription>Biztosan törlöd ezt a terméket az adatbázisból?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700 text-white">Törlés</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
