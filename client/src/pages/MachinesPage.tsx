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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cpu, Plus, Pencil, Trash2, Wrench, CheckCircle, XCircle, ChevronDown, ChevronRight, Upload, FileText, AlertCircle, CheckCircle2, X, Database } from "lucide-react";
import type { Machine } from "@shared/schema";

// ─── Form schema ──────────────────────────────────────────────────────────────
const machineFormSchema = z.object({
  name: z.string().min(2, "Min. 2 karakter"),
  type: z.string().min(2, "Min. 2 karakter"),
  capacityPerHour: z.coerce.number().min(0.1, "Minimum 0.1"),
  status: z.enum(["online", "maintenance", "offline"]),
  utilization: z.coerce.number().min(0).max(100),
  clampingForce: z.coerce.number().default(0),
  shotVolume: z.coerce.number().default(0),
  screwDiameter: z.coerce.number().default(0),
  materials: z.string().default(""),
  manufacturer: z.string().default(""),
  yearOfManufacture: z.coerce.number().default(0),
  specNotes: z.string().default(""),
  location: z.string().default(""),
});
type MachineForm = z.infer<typeof machineFormSchema>;

const statusConfig: Record<string, { label: string; dot: string; badge: string }> = {
  online: { label: "Aktív", dot: "status-dot status-online", badge: "bg-green-100 text-green-700 border-green-200" },
  maintenance: { label: "Karbantartás", dot: "status-dot status-maintenance", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  offline: { label: "Offline", dot: "status-dot status-offline", badge: "bg-red-100 text-red-700 border-red-200" },
};

function MachineSpecBadge({ value, label, unit }: { value: number | null | undefined; label: string; unit: string }) {
  if (!value) return null;
  return (
    <div className="text-center px-3 py-2 bg-muted/60 rounded-lg">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-bold text-foreground text-sm tabular-nums">{value} {unit}</div>
    </div>
  );
}

// ─── CSV parser ───────────────────────────────────────────────────────────────
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

// ─── Géplista tab ─────────────────────────────────────────────────────────────
function MachineList({
  machines,
  isLoading,
  onEdit,
  onDelete,
  onStatus,
}: {
  machines: Machine[];
  isLoading: boolean;
  onEdit: (m: Machine) => void;
  onDelete: (id: number) => void;
  onStatus: (id: number, status: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (isLoading) return (
    <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-lg" />)}</div>
  );

  return (
    <div className="space-y-3">
      {machines.map(machine => {
        const sc = statusConfig[machine.status] ?? statusConfig.offline;
        const utilColor = machine.utilization > 85 ? "#dc2626" : machine.utilization > 65 ? "#d97706" : "#16a34a";
        const isExpanded = expandedId === machine.id;

        return (
          <Card key={machine.id} data-testid={`card-machine-${machine.id}`} className="border border-border shadow-sm">
            <CardContent className="p-0">
              {/* Fő sor */}
              <div className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
                  <Cpu size={18} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground text-sm">{machine.name}</h3>
                    <Badge variant="outline" className="text-xs">{machine.type}</Badge>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sc.badge}`}>
                      <span className={`${sc.dot} inline-block mr-1`} />
                      {sc.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span>{machine.capacityPerHour} db/óra</span>
                    {machine.manufacturer && <span>{machine.manufacturer}{machine.yearOfManufacture ? ` (${machine.yearOfManufacture})` : ""}</span>}
                    {(machine as any).location && <span className="truncate max-w-[150px]">{(machine as any).location}</span>}
                    {machine.materials && <span className="truncate max-w-[160px]">{machine.materials}</span>}
                  </div>
                  {machine.status === "online" && (
                    <div className="mt-2 flex items-center gap-3">
                      <div className="util-bar-bg flex-1">
                        <div className="util-bar" style={{ width: `${machine.utilization}%`, background: utilColor }} />
                      </div>
                      <span className="text-xs font-bold tabular-nums" style={{ color: utilColor }}>{machine.utilization}%</span>
                    </div>
                  )}
                </div>
                {/* Gombok */}
                <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground"
                    onClick={() => setExpandedId(isExpanded ? null : machine.id)}
                    data-testid={`btn-spec-${machine.id}`}>
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Spec
                  </Button>
                  {machine.status !== "online" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50"
                      onClick={() => onStatus(machine.id, "online")}
                      data-testid={`btn-activate-${machine.id}`}>
                      <CheckCircle size={11} /> Aktivál
                    </Button>
                  )}
                  {machine.status !== "maintenance" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-amber-700 border-amber-200 hover:bg-amber-50"
                      onClick={() => onStatus(machine.id, "maintenance")}
                      data-testid={`btn-maintenance-${machine.id}`}>
                      <Wrench size={11} /> Karb.
                    </Button>
                  )}
                  {machine.status !== "offline" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-700 border-red-200 hover:bg-red-50"
                      onClick={() => onStatus(machine.id, "offline")}
                      data-testid={`btn-offline-${machine.id}`}>
                      <XCircle size={11} /> Offline
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => onEdit(machine)} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    data-testid={`btn-edit-${machine.id}`}>
                    <Pencil size={13} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(machine.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                    data-testid={`btn-delete-${machine.id}`}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>

              {/* Spec panel */}
              {isExpanded && (
                <div className="border-t border-border px-4 py-3 bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Műszaki specifikáció</p>
                  <div className="flex flex-wrap gap-3">
                    <MachineSpecBadge value={machine.clampingForce} label="Befogóerő" unit="t" />
                    <MachineSpecBadge value={machine.shotVolume} label="Lövéstérfogat" unit="cm³" />
                    <MachineSpecBadge value={machine.screwDiameter} label="Csigaátmérő" unit="mm" />
                    {!machine.clampingForce && !machine.shotVolume && !machine.screwDiameter && (
                      <p className="text-xs text-muted-foreground italic">Nincs speciális fröccsöntő adat megadva.</p>
                    )}
                  </div>
                  {machine.specNotes && (
                    <p className="text-xs text-muted-foreground mt-2 bg-white border border-border rounded px-3 py-2">{machine.specNotes}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {machines.length === 0 && (
        <div className="text-center py-16 text-muted-foreground bg-white border border-border rounded-xl">
          <Cpu size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Még nincs gép a rendszerben</p>
          <p className="text-sm mt-1">Add hozzá manuálisan az "Új gép" fülön, vagy importáld CSV-ből.</p>
        </div>
      )}
    </div>
  );
}

// ─── Új gép form tab ──────────────────────────────────────────────────────────
function NewMachineForm({
  editMachine,
  onSuccess,
  onCancel,
}: {
  editMachine: Machine | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();

  const defaultValues: MachineForm = {
    name: "", type: "", capacityPerHour: 10, status: "online", utilization: 0,
    clampingForce: 0, shotVolume: 0, screwDiameter: 0, materials: "",
    manufacturer: "", yearOfManufacture: new Date().getFullYear(), specNotes: "", location: "",
  };

  const form = useForm<MachineForm>({
    resolver: zodResolver(machineFormSchema),
    defaultValues: editMachine ? {
      name: editMachine.name,
      type: editMachine.type,
      capacityPerHour: editMachine.capacityPerHour,
      status: editMachine.status as any,
      utilization: editMachine.utilization,
      clampingForce: editMachine.clampingForce || 0,
      shotVolume: editMachine.shotVolume || 0,
      screwDiameter: editMachine.screwDiameter || 0,
      materials: editMachine.materials || "",
      manufacturer: editMachine.manufacturer || "",
      yearOfManufacture: editMachine.yearOfManufacture || 0,
      specNotes: editMachine.specNotes || "",
      location: (editMachine as any).location || "",
    } : defaultValues,
  });

  const createMutation = useMutation({
    mutationFn: async (data: MachineForm) => {
      const res = await apiRequest("POST", "/api/machines", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      toast({ title: "Gép hozzáadva", description: "Sikeresen felvéve a rendszerbe." });
      form.reset(defaultValues);
      onSuccess();
    },
    onError: (err: any) => {
      console.error("Gép mentési hiba:", err);
      toast({ title: "Hiba a mentésnél", description: err.message || "Ismeretlen hiba", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: MachineForm }) => {
      const res = await apiRequest("PATCH", `/api/machines/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      toast({ title: "Gép frissítve" });
      onSuccess();
    },
    onError: (err: any) => {
      toast({ title: "Hiba a mentésnél", description: err.message, variant: "destructive" });
    },
  });

  function onSubmit(data: MachineForm) {
    if (editMachine) updateMutation.mutate({ id: editMachine.id, data });
    else createMutation.mutate(data);
  }

  // Validációs hibák debug
  const errors = form.formState.errors;

  return (
    <div className="max-w-2xl">
      <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-4">
          {editMachine ? `Gép szerkesztése: ${editMachine.name}` : "Új gép hozzáadása"}
        </h2>

        {/* Validációs hibák megjelenítése */}
        {Object.keys(errors).length > 0 && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-700 space-y-1">
            {Object.entries(errors).map(([field, err]) => (
              <div key={field}>• {field}: {(err as any)?.message}</div>
            ))}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Alapadatok */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Alapadatok</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Gép neve *</FormLabel>
                    <FormControl><Input placeholder="pl. CNC Megmunkáló #3" {...field} data-testid="input-machine-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Típus / Kategória *</FormLabel>
                    <FormControl><Input placeholder="pl. CNC, Hegesztés, Fröccsöntés" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Helyszín / Csarnok</FormLabel>
                    <FormControl><Input placeholder="pl. Csarnok A, 3. sor" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="manufacturer" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gyártó</FormLabel>
                    <FormControl><Input placeholder="pl. Engel, DMG Mori, ARBURG" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="yearOfManufacture" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gyártási év</FormLabel>
                    <FormControl><Input type="number" min="1900" max="2099" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="capacityPerHour" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kapacitás (db/óra) *</FormLabel>
                    <FormControl><Input type="number" step="0.1" min="0.1" {...field} data-testid="input-capacity" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="utilization" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kihasználtság (%)</FormLabel>
                    <FormControl><Input type="number" min="0" max="100" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Állapot</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-machine-status"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="online">Aktív (online)</SelectItem>
                        <SelectItem value="maintenance">Karbantartás</SelectItem>
                        <SelectItem value="offline">Offline</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="materials" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Kompatibilis anyagok</FormLabel>
                    <FormControl><Input placeholder="pl. ABS, PP, PA66 (vesszővel elválasztva)" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Fröccsöntő spec */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Fröccsöntő specifikáció <span className="font-normal">(ha releváns)</span>
              </p>
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="clampingForce" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Befogóerő (t)</FormLabel>
                    <FormControl><Input type="number" min="0" step="0.1" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="shotVolume" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lövéstérfogat (cm³)</FormLabel>
                    <FormControl><Input type="number" min="0" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="screwDiameter" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Csigaátmérő (mm)</FormLabel>
                    <FormControl><Input type="number" min="0" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
            </div>

            <FormField control={form.control} name="specNotes" render={({ field }) => (
              <FormItem>
                <FormLabel>Egyéb megjegyzés / spec</FormLabel>
                <FormControl><Textarea rows={2} placeholder="Vezérlő típusa, érzékelők, egyéb technikai megjegyzés..." {...field} /></FormControl>
              </FormItem>
            )} />

            <div className="flex gap-3">
              {editMachine && (
                <Button type="button" variant="outline" onClick={onCancel}>Mégse</Button>
              )}
              <Button type="submit" className="flex-1" data-testid="button-save-machine"
                disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending
                  ? "Mentés..."
                  : editMachine ? "Változtatások mentése" : "Gép hozzáadása a rendszerhez"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

// ─── CSV / Adatbázis import tab ───────────────────────────────────────────────
function MachineImport() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<Record<string, string>[]>([]);
  const [importResults, setImportResults] = useState<{ created: number; errors: string[] } | null>(null);

  const csvTemplate = `name,type,capacityPerHour,status,utilization,manufacturer,yearOfManufacture,location,materials,clampingForce,shotVolume,screwDiameter,specNotes
Engel Victory 200,Fröccsöntés,120,online,65,Engel,2019,Csarnok A,ABS;PP;PA66,200,850,50,Automatikus szerszámcsere
ARBURG 470S,Fröccsöntés,90,online,72,ARBURG,2021,Csarnok B,POM;PE,300,1200,60,`;

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvPreview(parseCsv(text));
      setImportResults(null);
    };
    reader.readAsText(file, "UTF-8");
  }

  async function importAll() {
    if (csvPreview.length === 0) return;
    let created = 0;
    const errors: string[] = [];
    for (let i = 0; i < csvPreview.length; i++) {
      const row = csvPreview[i];
      try {
        await apiRequest("POST", "/api/machines", {
          name: row.name || row["Gép neve"] || `Gép ${i + 1}`,
          type: row.type || row["Típus"] || "Egyéb",
          capacityPerHour: parseFloat(row.capacityPerHour || "10") || 10,
          status: (row.status || "online") as any,
          utilization: parseFloat(row.utilization || "0") || 0,
          manufacturer: row.manufacturer || row["Gyártó"] || "",
          yearOfManufacture: parseInt(row.yearOfManufacture || "0") || 0,
          location: row.location || row["Helyszín"] || "",
          materials: row.materials || row["Anyagok"] || "",
          clampingForce: parseFloat(row.clampingForce || "0") || 0,
          shotVolume: parseFloat(row.shotVolume || "0") || 0,
          screwDiameter: parseFloat(row.screwDiameter || "0") || 0,
          specNotes: row.specNotes || row["Megjegyzés"] || "",
        });
        created++;
      } catch (err: any) {
        errors.push(`Sor ${i + 1} (${row.name || "?"}): ${err.message}`);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
    setImportResults({ created, errors });
    toast({ title: `${created} gép importálva`, description: errors.length ? `${errors.length} hiba.` : "Mind sikeresen felvéve." });
    if (errors.length === 0) setCsvPreview([]);
  }

  return (
    <div className="max-w-3xl space-y-4">
      {/* Sablon */}
      <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <FileText size={20} className="text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-foreground text-sm">CSV sablon letöltése</p>
            <p className="text-xs text-muted-foreground mt-1">
              Töltsd le a sablont, töltsd ki Excel/Calc programban, majd töltsd vissza.
            </p>
            <p className="text-xs font-mono bg-muted rounded px-2 py-1 mt-2 text-muted-foreground">
              name, type, capacityPerHour, status, utilization, manufacturer, yearOfManufacture, location, ...
            </p>
            <Button size="sm" variant="outline" className="mt-3 gap-2"
              onClick={() => {
                const blob = new Blob([csvTemplate], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = "gepek_sablon.csv"; a.click();
              }}>
              <Upload size={13} /> Sablon letöltése
            </Button>
          </div>
        </div>
      </div>

      {/* Feltöltő */}
      <div className="border border-dashed border-primary/30 bg-primary/[0.02] rounded-xl p-6 text-center">
        <Database size={28} className="mx-auto mb-3 text-primary/40" />
        <p className="text-sm font-medium text-foreground">CSV fájl feltöltése</p>
        <p className="text-xs text-muted-foreground mt-1">Gép adatbázis importálása CSV fájlból (UTF-8, vesszővel elválasztva)</p>
        <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
        <Button variant="outline" className="mt-4 gap-2" onClick={() => fileInputRef.current?.click()}>
          <Upload size={14} /> CSV kiválasztása
        </Button>
      </div>

      {/* Előnézet */}
      {csvPreview.length > 0 && (
        <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-green-600" />
              <span className="font-medium text-sm">{csvPreview.length} sor beolvasva</span>
            </div>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setCsvPreview([])}>
              <X size={14} />
            </Button>
          </div>
          <div className="overflow-x-auto max-h-52 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/60">
                <tr>
                  {Object.keys(csvPreview[0]).slice(0, 6).map(h => (
                    <th key={h} className="text-left px-3 py-2 text-muted-foreground font-semibold uppercase tracking-wide">{h}</th>
                  ))}
                  {Object.keys(csvPreview[0]).length > 6 && <th className="text-left px-3 py-2 text-muted-foreground">...</th>}
                </tr>
              </thead>
              <tbody>
                {csvPreview.slice(0, 8).map((row, i) => (
                  <tr key={i} className="border-t border-border/50 hover:bg-muted/20">
                    {Object.values(row).slice(0, 6).map((v, j) => (
                      <td key={j} className="px-3 py-1.5 text-foreground">{v || "—"}</td>
                    ))}
                    {Object.values(row).length > 6 && <td className="px-3 py-1.5 text-muted-foreground">...</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {csvPreview.length > 8 && (
            <p className="text-xs text-muted-foreground px-4 py-2">+{csvPreview.length - 8} további sor...</p>
          )}
          <div className="px-4 py-3 border-t border-border">
            <Button className="w-full gap-2" onClick={importAll}>
              <Upload size={14} /> {csvPreview.length} gép importálása
            </Button>
          </div>
        </div>
      )}

      {/* Eredmény */}
      {importResults && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${importResults.errors.length === 0 ? "bg-green-50 border-green-200 text-green-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
          <p className="font-medium">{importResults.created} gép sikeresen importálva</p>
          {importResults.errors.map((e, i) => (
            <p key={i} className="text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} />{e}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Fő oldal ─────────────────────────────────────────────────────────────────
export default function MachinesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("list");
  const [editMachine, setEditMachine] = useState<Machine | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: machines = [], isLoading } = useQuery<Machine[]>({ queryKey: ["/api/machines"] });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/machines/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/machines"] });
      toast({ title: "Gép törölve", variant: "destructive" });
      setDeleteId(null);
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/machines/${id}`, { status });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/machines"] }),
  });

  const online = machines.filter(m => m.status === "online").length;
  const avgUtil = online > 0
    ? Math.round(machines.filter(m => m.status === "online").reduce((s, m) => s + m.utilization, 0) / online)
    : 0;

  function handleEdit(m: Machine) {
    setEditMachine(m);
    setActiveTab("new");
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Gépek & munkaállomások</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{machines.length} gép a rendszerben</p>
        </div>
      </div>

      {/* KPI sáv */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Összes gép", value: machines.length, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Aktív", value: online, color: "text-green-600", bg: "bg-green-50" },
          { label: "Karbantartás", value: machines.filter(m => m.status === "maintenance").length, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Átl. kihasználtság", value: `${avgUtil}%`, color: "text-purple-600", bg: "bg-purple-50" },
        ].map(({ label, value, color, bg }) => (
          <Card key={label} className="border border-border shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                <Cpu size={18} className={color} />
              </div>
              <div>
                <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fülek */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v !== "new") setEditMachine(null); }}>
        <TabsList>
          <TabsTrigger value="list" data-testid="tab-machines-list">Összes gép</TabsTrigger>
          <TabsTrigger value="new" data-testid="tab-machines-new">
            <Plus size={13} className="mr-1" />{editMachine ? "Szerkesztés" : "Új gép"}
          </TabsTrigger>
          <TabsTrigger value="import" data-testid="tab-machines-import">
            <Database size={13} className="mr-1" />CSV / DB import
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="list">
            <MachineList
              machines={machines}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={(id) => setDeleteId(id)}
              onStatus={(id, status) => statusMutation.mutate({ id, status })}
            />
          </TabsContent>

          <TabsContent value="new">
            <NewMachineForm
              editMachine={editMachine}
              onSuccess={() => { setActiveTab("list"); setEditMachine(null); }}
              onCancel={() => { setActiveTab("list"); setEditMachine(null); }}
            />
          </TabsContent>

          <TabsContent value="import">
            <MachineImport />
          </TabsContent>
        </div>
      </Tabs>

      {/* Törlés megerősítés */}
      <AlertDialog open={deleteId !== null} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gép törlése</AlertDialogTitle>
            <AlertDialogDescription>
              Biztosan törlöd ezt a gépet a rendszerből? Ez a művelet nem vonható vissza.
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
