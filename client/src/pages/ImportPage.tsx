import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

// A deployed környezetben az API_BASE proxy prefixet kell használni FormData esetén is
const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
import { useToast } from "@/hooks/use-toast";
import { Brain, Upload, FileText, CheckCircle2, ChevronRight, Zap, AlertTriangle, Clock, Star, Download, FileScan, X, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Product } from "@shared/schema";

// ─── Types ───────────────────────────────────────────────────────────────────
interface MachineSuggestion {
  rank: number;
  machine: { id: number; name: string; type: string; utilization: number; capacityPerHour: number };
  score: number;
  reason: string;
  canFit: boolean;
  onTime: boolean;
  suggestedStart: string;
  suggestedEnd: string;
  estimatedMinutes: number;
}
interface AnalysisResult {
  suggestions: MachineSuggestion[];
  analysisText: string;
  product: Product;
  totalMinutesNeeded: number;
}
type Step = "form" | "analyzing" | "result" | "accepted";

// ─── Lépésjelző sáv ─────────────────────────────────────────────────────────
function StepBar({ step }: { step: Step }) {
  const steps = [
    { key: "form", label: "Rendelés adatai" },
    { key: "analyzing", label: "AI elemzés" },
    { key: "result", label: "Javaslat" },
    { key: "accepted", label: "Elfogadva" },
  ];
  const idx = steps.findIndex(s => s.key === step);
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
            i < idx ? "bg-green-500 text-white" :
            i === idx ? "bg-primary text-primary-foreground" :
            "bg-secondary text-muted-foreground"
          }`}>
            {i < idx ? <CheckCircle2 size={12} /> : i + 1}
          </div>
          <span className={`text-xs font-medium ${i === idx ? "text-foreground" : "text-muted-foreground"}`}>
            {s.label}
          </span>
          {i < steps.length - 1 && <ChevronRight size={12} className="text-muted-foreground" />}
        </div>
      ))}
    </div>
  );
}

// ─── Kézi import (AI gépelemzés) ─────────────────────────────────────────────
function ManualImport() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("form");
  const [selected, setSelected] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [form, setForm] = useState({
    orderNumber: `ORD-2026-${String(Date.now()).slice(-3)}`,
    productId: "",
    quantity: "50",
    priority: "normal",
    dueDate: "2026-03-28",
    notes: "",
    customer: "",
  });

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/analyze-order", {
        ...form,
        productId: Number(form.productId) || products[0]?.id,
        quantity: Number(form.quantity),
      });
      return res.json() as Promise<AnalysisResult>;
    },
    onMutate: () => setStep("analyzing"),
    onSuccess: (data: AnalysisResult) => { setAnalysis(data); setStep("result"); },
    onError: () => { toast({ title: "AI elemzési hiba", variant: "destructive" }); setStep("form"); },
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const sug = analysis!.suggestions[selected!];
      const res = await apiRequest("POST", "/api/ai/accept-recommendation", {
        orderData: { ...form, productId: Number(form.productId) || products[0]?.id },
        machineId: sug.machine.id,
        suggestedStart: sug.suggestedStart,
        suggestedEnd: sug.suggestedEnd,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setStep("accepted");
    },
  });

  function downloadPlan(type: "txt" | "csv") {
    const sug = analysis!.suggestions[selected ?? 0];
    if (type === "txt") {
      const txt = `ProdAI Gyártási Terv\n${"=".repeat(40)}\n\n${analysis!.analysisText}\n\nElfogadott gép: ${sug.machine.name}\nKezdés: ${sug.suggestedStart.replace("T", " ")}\nBefejezés: ${sug.suggestedEnd.replace("T", " ")}`;
      const blob = new Blob([txt], { type: "text/plain;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `terv_${form.orderNumber}.txt`; a.click();
    } else {
      const csv = `Rendelésszám,Mennyiség,Gép,Kezdés,Befejezés,Határidő\n${form.orderNumber},${form.quantity},${sug.machine.name},${sug.suggestedStart},${sug.suggestedEnd},${form.dueDate}`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `terv_${form.orderNumber}.csv`; a.click();
    }
  }

  if (step === "form") return (
    <div className="max-w-xl space-y-4">
      <StepBar step="form" />
      <div className="bg-white border border-border rounded-xl p-5 space-y-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Rendelésszám</label>
            <input className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.orderNumber} onChange={e => setForm(f => ({ ...f, orderNumber: e.target.value }))} data-testid="input-order-number" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Vevő neve</label>
            <input className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="pl. BMW Kft." value={form.customer} onChange={e => setForm(f => ({ ...f, customer: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Termék (cikkszám alapján keresve)</label>
          <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))} data-testid="select-product">
            <option value="">— Válassz terméket —</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Mennyiség (db)</label>
            <input type="number" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} data-testid="input-quantity" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Határidő</label>
            <input type="date" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioritás</label>
            <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
              <option value="urgent">Sürgős</option>
              <option value="high">Magas</option>
              <option value="normal">Normál</option>
              <option value="low">Alacsony</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Megjegyzés</label>
          <textarea rows={2} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
        <Button className="w-full gap-2" onClick={() => analyzeMutation.mutate()} data-testid="btn-analyze">
          <Brain size={15} /> AI elemzés indítása
        </Button>
      </div>
    </div>
  );

  if (step === "analyzing") return (
    <div className="max-w-xl">
      <StepBar step="analyzing" />
      <div className="bg-white border border-border rounded-xl p-10 text-center shadow-sm">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Brain size={28} className="text-primary ai-pulse" />
        </div>
        <p className="font-semibold text-foreground">AI elemzés folyamatban...</p>
        <p className="text-sm text-muted-foreground mt-2">Gépkapacitások és határidők kiértékelése</p>
      </div>
    </div>
  );

  if (step === "result" && analysis) return (
    <div className="max-w-2xl space-y-4">
      <StepBar step="result" />
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs font-mono text-blue-800 whitespace-pre-wrap leading-relaxed">{analysis.analysisText}</p>
      </div>
      <div className="space-y-3">
        {analysis.suggestions.map((sug, i) => (
          <button key={sug.rank} onClick={() => setSelected(i)}
            className={`w-full text-left rounded-xl border p-4 transition-all ${selected === i ? "border-primary bg-primary/5 shadow" : "border-border bg-white hover:border-primary/30"}`}
            data-testid={`suggestion-${i}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {i === 0 && <Star size={14} className="text-amber-500 fill-amber-400" />}
                <span className="font-semibold text-sm text-foreground">{sug.machine.name}</span>
                <Badge variant="outline" className="text-xs">{sug.machine.type}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sug.onTime ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {sug.onTime ? "Határidőn belül" : "Határidő kockázat"}
                </span>
                <span className="text-sm font-bold text-primary">{Math.round(sug.score)}p</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{sug.reason}</p>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span>Kezdés: <strong>{sug.suggestedStart.replace("T", " ")}</strong></span>
              <span>Befejezés: <strong>{sug.suggestedEnd.replace("T", " ")}</strong></span>
            </div>
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => { setStep("form"); setSelected(null); }}>Vissza</Button>
        <Button className="flex-1 gap-2" disabled={selected === null || acceptMutation.isPending}
          onClick={() => acceptMutation.mutate()} data-testid="btn-accept">
          <CheckCircle2 size={15} />
          {acceptMutation.isPending ? "Elfogadás..." : "Elfogadom — Gyártás indítása"}
        </Button>
      </div>
    </div>
  );

  if (step === "accepted") return (
    <div className="max-w-xl">
      <StepBar step="accepted" />
      <div className="bg-white border border-green-200 rounded-xl p-6 text-center shadow-sm">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={28} className="text-green-600" />
        </div>
        <h3 className="font-bold text-foreground text-lg">Gyártás elindítva</h3>
        <p className="text-sm text-muted-foreground mt-1">{form.orderNumber} — bekerült az ütemtervbe</p>
        <div className="flex gap-3 justify-center mt-5">
          <Button variant="outline" className="gap-2" onClick={() => downloadPlan("txt")}><Download size={14} /> .txt terv</Button>
          <Button variant="outline" className="gap-2" onClick={() => downloadPlan("csv")}><Download size={14} /> .csv ütemterv</Button>
        </div>
        <Button className="mt-3 gap-2" onClick={() => { setStep("form"); setSelected(null); setAnalysis(null); setForm(f => ({ ...f, orderNumber: `ORD-2026-${String(Date.now()).slice(-3)}` })); }}>
          <Plus size={14} /> Új rendelés
        </Button>
      </div>
    </div>
  );

  return null;
}

// ─── PDF import ──────────────────────────────────────────────────────────────
function PdfImport() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pdfResult, setPdfResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [importedRows, setImportedRows] = useState<number[]>([]);

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setPdfResult(null);
    setImportedRows([]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/api/import/pdf`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ismeretlen hiba");
      setPdfResult(data);
      toast({ title: data.message });
    } catch (err: any) {
      toast({ title: "PDF feldolgozási hiba", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function importRow(row: any, idx: number) {
    try {
      await apiRequest("POST", "/api/orders", {
        orderNumber: row.orderNumber,
        productId: Number(row.productId) || (products[0]?.id ?? 1),
        quantity: Number(row.quantity) || 1,
        priority: row.priority || "normal",
        status: "pending",
        dueDate: row.dueDate,
        notes: row.source ? `PDF-ből importálva (${row.source})` : "PDF-ből importálva",
        customer: row.customer || "",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setImportedRows(r => [...r, idx]);
      toast({ title: `${row.orderNumber} importálva` });
    } catch {
      toast({ title: "Import hiba", variant: "destructive" });
    }
  }

  async function importAll() {
    if (!pdfResult?.extracted) return;
    for (let i = 0; i < pdfResult.extracted.length; i++) {
      if (!importedRows.includes(i)) await importRow(pdfResult.extracted[i], i);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Instrukció */}
      <Card className="border border-border shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <FileScan size={20} className="text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm text-foreground">PDF rendelés import</p>
              <p className="text-xs text-muted-foreground mt-1">
                A rendszer automatikusan felismeri a rendelésszámokat, cikkszámokat, mennyiségeket és határidőket a PDF-ből.
                Legjobb eredmény érhető el, ha a PDF táblázatos formátumban tartalmazza az adatokat.
              </p>
              <div className="mt-2 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2 font-mono">
                Ajánlott oszlopok: Rendelésszám &nbsp;·&nbsp; Cikkszám &nbsp;·&nbsp; Mennyiség &nbsp;·&nbsp; Határidő
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fájl feltöltő */}
      <Card className="border border-dashed border-primary/30 bg-primary/[0.02] shadow-sm">
        <CardContent className="p-8 text-center">
          <FileScan size={32} className="mx-auto mb-3 text-primary/40" />
          <p className="font-medium text-sm text-foreground">PDF fájl feltöltése</p>
          <p className="text-xs text-muted-foreground mt-1">Max. 10 MB · .pdf formátum</p>
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFile} data-testid="input-pdf-file" />
          <Button className="mt-4 gap-2" onClick={() => fileRef.current?.click()} disabled={loading}>
            {loading ? <><Brain size={14} className="ai-pulse" /> Feldolgozás...</> : <><Upload size={14} /> PDF kiválasztása</>}
          </Button>
        </CardContent>
      </Card>

      {/* Eredmény */}
      {pdfResult && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-green-600" />
              <span className="font-medium text-sm text-foreground">{pdfResult.message}</span>
              {pdfResult.pageCount && <Badge variant="outline" className="text-xs">{pdfResult.pageCount} oldal</Badge>}
            </div>
            {pdfResult.extracted?.length > 0 && (
              <Button size="sm" onClick={importAll} className="gap-1 text-xs">
                <Plus size={12} /> Mind importálása
              </Button>
            )}
          </div>

          {pdfResult.extracted?.length > 0 ? (
            <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Rendelésszám</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Termék</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Mennyiség</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Határidő</th>
                    <th className="w-24" />
                  </tr>
                </thead>
                <tbody>
                  {pdfResult.extracted.map((row: any, i: number) => (
                    <tr key={i} className={`border-b border-border/50 ${importedRows.includes(i) ? "bg-green-50" : "hover:bg-muted/20"}`}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{row.orderNumber}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {row.productId
                          ? <span className="text-foreground font-medium">{row.productName}</span>
                          : <span className="text-amber-600">{row.productCode || "Ismeretlen"} ⚠ Nincs egyezés</span>}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums">{row.quantity} db</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{row.dueDate}</td>
                      <td className="px-4 py-3">
                        {importedRows.includes(i)
                          ? <span className="text-xs text-green-600 font-medium flex items-center gap-1"><CheckCircle2 size={12} /> Importálva</span>
                          : <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => importRow(row, i)}>
                              <Plus size={11} /> Import
                            </Button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            // Nyers szöveg megjelenítése ha nem sikerült auto-felismerés
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Automatikus felismerés sikertelen</span>
              </div>
              <p className="text-xs text-amber-700">A PDF-ből kinyert nyers szöveg:</p>
              <pre className="text-xs text-muted-foreground bg-white border border-border rounded px-3 py-2 max-h-48 overflow-y-auto whitespace-pre-wrap">
                {pdfResult.rawText}
              </pre>
              <p className="text-xs text-amber-700">Ellenőrizd, hogy a PDF olvasható szöveget tartalmaz-e (nem szkennelt kép).</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Fő oldal ────────────────────────────────────────────────────────────────
export default function ImportPage() {
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Rendelés import</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kézi beküldés AI gépjavaslattal, vagy PDF fájlból automatikus felismerés</p>
      </div>

      <Tabs defaultValue="manual">
        <TabsList>
          <TabsTrigger value="manual" data-testid="tab-manual">
            <Brain size={14} className="mr-2" /> Kézi import + AI elemzés
          </TabsTrigger>
          <TabsTrigger value="pdf" data-testid="tab-pdf">
            <FileScan size={14} className="mr-2" /> PDF import
          </TabsTrigger>
        </TabsList>

        <div className="mt-5">
          <TabsContent value="manual"><ManualImport /></TabsContent>
          <TabsContent value="pdf"><PdfImport /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
