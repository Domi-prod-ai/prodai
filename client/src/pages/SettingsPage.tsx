import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Settings, Building2, Brain, Bell, Palette, Globe,
  Save, RotateCcw, CheckCircle2, ChevronRight, Info,
  Clock, Calendar, Zap, AlertTriangle, Wrench, Star, Moon, Sun, Flame
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShiftConfig {
  enabled: boolean;
  name: string;
  start: string;
  end: string;
}

interface AppSettings {
  companyName: string;
  plantName: string;
  shiftCount: number;
  shifts: ShiftConfig[];
  shiftStart: string;
  shiftEnd: string;
  workingDaysPerWeek: number;
  aiPriorityWeight: number;
  aiAutoSchedule: boolean;
  aiAlertThreshold: number;
  aiDeadlineBufferDays: number;
  language: string;
  darkMode: boolean;
  dateFormat: string;
  notifyHighUtilization: boolean;
  notifyDeadlineRisk: boolean;
  notifyMaintenance: boolean;
  utilizationAlertLevel: number;
  currency: string;
  timezone: string;
  defaultPriority: string;
}

// ─── Szekció keret ────────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  description,
  badge,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-border/60 flex items-center gap-3">
        <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          {icon}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {badge && <Badge variant="outline" className="text-xs">{badge}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

// ─── Mező segédek ─────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, type = "text"
}: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function NumberInput({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
      value={value}
      onChange={e => onChange(Number(e.target.value))}
    />
  );
}

function SelectInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-sm text-foreground group-hover:text-primary transition-colors">{label}</span>
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${checked ? "bg-primary" : "bg-muted border border-border"}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${checked ? "left-5" : "left-0.5"}`} />
      </div>
    </label>
  );
}

// ─── Slider ───────────────────────────────────────────────────────────────────

function SliderField({
  label, value, onChange, min, max, leftLabel, rightLabel, hint
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; leftLabel?: string; rightLabel?: string; hint?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <span className="text-xs font-bold text-primary tabular-nums">{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right, hsl(206 70% 40%) ${pct}%, hsl(var(--border)) ${pct}%)` }}
      />
      {(leftLabel || rightLabel) && (
        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted-foreground">{leftLabel}</span>
          <span className="text-xs text-muted-foreground">{rightLabel}</span>
        </div>
      )}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

// ─── Fő oldal ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { toast } = useToast();
  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState<AppSettings | null>(null);

  const { data: settings, isLoading } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const DEFAULT_SETTINGS: AppSettings = {
    companyName: "ProdAI Kft.", plantName: "1. Telephely",
    shiftCount: 2,
    shifts: [
      { enabled: true, name: "Nappal", start: "06:00", end: "14:00" },
      { enabled: true, name: "Delutan", start: "14:00", end: "22:00" },
      { enabled: false, name: "Ejszaka", start: "22:00", end: "06:00" },
    ],
    shiftStart: "06:00", shiftEnd: "22:00", workingDaysPerWeek: 5,
    aiPriorityWeight: 70, aiAutoSchedule: true, aiAlertThreshold: 85, aiDeadlineBufferDays: 2,
    language: "hu", darkMode: false, dateFormat: "YYYY-MM-DD",
    notifyHighUtilization: true, notifyDeadlineRisk: true, notifyMaintenance: true,
    utilizationAlertLevel: 85, currency: "HUF", timezone: "Europe/Budapest", defaultPriority: "normal",
  };

  useEffect(() => {
    if (!form) {
      if (settings) setForm(settings);
      else if (!isLoading) setForm(DEFAULT_SETTINGS);
    }
  }, [settings, isLoading]);

  const saveMutation = useMutation({
    mutationFn: async (data: AppSettings) => {
      const res = await apiRequest("PATCH", "/api/settings", data);
      return res.json() as Promise<AppSettings>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/settings"], data);
      setDirty(false);
      toast({ title: "Beállítások mentve", description: "A módosítások érvénybe léptek." });
    },
    onError: () => toast({ title: "Mentési hiba", variant: "destructive" }),
  });

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setForm(f => f ? { ...f, [key]: value } : f);
    setDirty(true);
  }

  function reset() {
    if (settings) { setForm(settings); setDirty(false); }
  }

  if (isLoading || !form) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-40 bg-muted/40 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-5">
      {/* Fejléc */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Settings size={20} className="text-primary" /> Beállítások
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gyár, AI motor, megjelenés és értesítések konfigurálása
          </p>
        </div>
        <div className="flex gap-2">
          {dirty && (
            <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
              <RotateCcw size={13} /> Visszaállít
            </Button>
          )}
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!dirty || saveMutation.isPending}
            onClick={() => form && saveMutation.mutate(form)}
            data-testid="btn-save-settings"
          >
            {saveMutation.isPending ? <><Zap size={13} className="ai-pulse" /> Mentés...</> : <><Save size={13} /> Mentés</>}
          </Button>
        </div>
      </div>

      {dirty && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle size={13} className="text-amber-500" />
          <p className="text-xs text-amber-700">Nem mentett változtatások vannak — kattints a "Mentés" gombra.</p>
        </div>
      )}

      {/* 1. Gyár / vállalat adatai */}
      <Section
        icon={<Building2 size={16} />}
        title="Gyár / vállalat adatai"
        description="A cég és telephely alapadatai — ezek megjelennek a generált tervekben"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vállalat neve">
            <TextInput value={form.companyName} onChange={v => update("companyName", v)} placeholder="pl. Kovács Ipari Kft." />
          </Field>
          <Field label="Telephely neve">
            <TextInput value={form.plantName} onChange={v => update("plantName", v)} placeholder="pl. Győri üzem" />
          </Field>
        </div>

        {/* Műszakrend konfigurátor */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">Műszakrend</label>
          <div className="flex gap-2 mb-3">
            {[1, 2, 3].map(n => (
              <button
                key={n}
                onClick={() => {
                  const newShifts = (form.shifts ?? []).map((s, i) => ({ ...s, enabled: i < n }));
                  setForm(f => f ? { ...f, shiftCount: n, shifts: newShifts } : f);
                  setDirty(true);
                }}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                  (form.shiftCount ?? 1) === n
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {n === 1 ? "1 műszak" : n === 2 ? "2 műszak" : "3 mőszak (24h)"}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {(form.shifts ?? []).map((shift, i) => {
              const icons = [<Sun size={13} />, <Flame size={13} />, <Moon size={13} />];
              const colors = [
                "bg-amber-50 border-amber-200",
                "bg-orange-50 border-orange-200",
                "bg-indigo-50 border-indigo-200",
              ];
              const labelColors = ["text-amber-700", "text-orange-700", "text-indigo-700"];
              const iconColors = ["text-amber-500", "text-orange-500", "text-indigo-500"];
              const isActive = i < (form.shiftCount ?? 1);
              return (
                <div
                  key={i}
                  className={`rounded-xl border px-4 py-3 transition-all ${
                    isActive ? colors[i] : "bg-muted/30 border-border opacity-40"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={iconColors[i]}>{icons[i]}</span>
                    <span className={`text-xs font-semibold ${labelColors[i]}`}>
                      {i + 1}. műszak
                    </span>
                    {!isActive && <span className="text-xs text-muted-foreground ml-auto">(inaktív)</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Név</label>
                      <input
                        disabled={!isActive}
                        className="w-full border border-border rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        value={shift.name}
                        onChange={e => {
                          const newShifts = (form.shifts ?? []).map((s, j) =>
                            j === i ? { ...s, name: e.target.value } : s
                          );
                          setForm(f => f ? { ...f, shifts: newShifts } : f);
                          setDirty(true);
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Kezdete</label>
                      <input
                        type="time"
                        disabled={!isActive}
                        className="w-full border border-border rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        value={shift.start}
                        onChange={e => {
                          const newShifts = (form.shifts ?? []).map((s, j) =>
                            j === i ? { ...s, start: e.target.value } : s
                          );
                          setForm(f => f ? { ...f, shifts: newShifts } : f);
                          setDirty(true);
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Vége</label>
                      <input
                        type="time"
                        disabled={!isActive}
                        className="w-full border border-border rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        value={shift.end}
                        onChange={e => {
                          const newShifts = (form.shifts ?? []).map((s, j) =>
                            j === i ? { ...s, end: e.target.value } : s
                          );
                          setForm(f => f ? { ...f, shifts: newShifts } : f);
                          setDirty(true);
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Field label="Munkanapok / hét">
          <div className="flex gap-1.5">
            {["H", "K", "Sze", "Cs", "P", "Szo", "V"].map((day, i) => (
              <button
                key={i}
                onClick={() => {
                  const active = i + 1 <= (form.workingDaysPerWeek ?? 5);
                  // Toggle: ha kattintott nap aktív ÉS utolsó aktív nap volt, csökkent; ha inaktív, növel
                  const newCount = i + 1;
                  update("workingDaysPerWeek", newCount === form.workingDaysPerWeek ? newCount - 1 : newCount);
                }}
                className={`w-9 h-9 rounded-lg text-xs font-semibold border transition-all ${
                  i < (form.workingDaysPerWeek ?? 5)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Alapértelmezett prioritás">
            <SelectInput
              value={form.defaultPriority}
              onChange={v => update("defaultPriority", v)}
              options={[
                { value: "urgent", label: "Sürgős" },
                { value: "high", label: "Magas" },
                { value: "normal", label: "Normál" },
                { value: "low", label: "Alacsony" },
              ]}
            />
          </Field>
          <Field label="Pénznem">
            <SelectInput
              value={form.currency}
              onChange={v => update("currency", v)}
              options={[
                { value: "HUF", label: "HUF – Magyar forint" },
                { value: "EUR", label: "EUR – Euro" },
                { value: "USD", label: "USD – Dollár" },
              ]}
            />
          </Field>
        </div>
      </Section>

      {/* 2. AI beállítások */}
      <Section
        icon={<Brain size={16} />}
        title="AI motor beállítások"
        description="Az AI hogyan súlyozzon ütemezésnél és mikor riasszon"
        badge="AI"
      >
        <SliderField
          label="Prioritási egyensúly"
          value={form.aiPriorityWeight}
          onChange={v => update("aiPriorityWeight", v)}
          min={0}
          max={100}
          leftLabel="Kapacitás-fókusz"
          rightLabel="Határidő-fókusz"
          hint="Magasabb érték: az AI inkább a határidő betartását részesíti előnyben. Alacsonyabb: a szabad kapacitást próbálja maximalizálni."
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Biztonsági puffer (nap)" hint="Hány nappal korábban jelezze az AI a határidő kockázatot">
            <NumberInput value={form.aiDeadlineBufferDays} onChange={v => update("aiDeadlineBufferDays", v)} min={0} max={14} />
          </Field>
          <Field label="Riasztási küszöb (%)" hint="E felett figyelmeztet az AI túlterheltségre">
            <NumberInput value={form.aiAlertThreshold} onChange={v => update("aiAlertThreshold", v)} min={50} max={100} />
          </Field>
        </div>
        <div className="pt-1 space-y-3">
          <Toggle
            checked={form.aiAutoSchedule}
            onChange={v => update("aiAutoSchedule", v)}
            label="AI auto-ütemezés engedélyezése (Dashboard gombnál)"
          />
        </div>
      </Section>

      {/* 3. Megjelenés */}
      <Section
        icon={<Palette size={16} />}
        title="Megjelenés"
        description="Nyelv, dátum formátum és téma beállítások"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nyelv">
            <SelectInput
              value={form.language}
              onChange={v => update("language", v)}
              options={[
                { value: "hu", label: "Magyar" },
                { value: "en", label: "English" },
                { value: "de", label: "Deutsch" },
              ]}
            />
          </Field>
          <Field label="Dátum formátum">
            <SelectInput
              value={form.dateFormat}
              onChange={v => update("dateFormat", v)}
              options={[
                { value: "YYYY-MM-DD", label: "2026-03-15 (ISO)" },
                { value: "DD.MM.YYYY", label: "15.03.2026 (EU)" },
                { value: "MM/DD/YYYY", label: "03/15/2026 (US)" },
              ]}
            />
          </Field>
        </div>
        <Field label="Időzóna">
          <SelectInput
            value={form.timezone}
            onChange={v => update("timezone", v)}
            options={[
              { value: "Europe/Budapest", label: "Európa / Budapest (CET/CEST)" },
              { value: "Europe/Vienna", label: "Európa / Bécs (CET/CEST)" },
              { value: "Europe/Berlin", label: "Európa / Berlin (CET/CEST)" },
              { value: "UTC", label: "UTC" },
            ]}
          />
        </Field>
        <div className="pt-1 space-y-3">
          <Toggle
            checked={form.darkMode}
            onChange={v => update("darkMode", v)}
            label="Sötét mód (fejlesztés alatt — hamarosan)"
          />
        </div>
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          <Info size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">A sötét mód és a teljes többnyelvű felület egy következő verzióban lesz elérhető. A jelenlegi beállítások mentése megmarad a szerver futásáig.</p>
        </div>
      </Section>

      {/* 4. Értesítések */}
      <Section
        icon={<Bell size={16} />}
        title="Értesítések és riasztások"
        description="Mikor jelenítsen meg az AI figyelmeztetést a Dashboardon"
      >
        <div className="space-y-3">
          <Toggle
            checked={form.notifyHighUtilization}
            onChange={v => update("notifyHighUtilization", v)}
            label="Magas kihasználtság értesítés"
          />
          {form.notifyHighUtilization && (
            <div className="ml-4">
              <Field label={`Riasztási szint: ${form.utilizationAlertLevel}%`} hint="Ha egy gép kihasználtsága ezt meghaladja, az AI jelez a Dashboardon">
                <input
                  type="range"
                  min={60}
                  max={100}
                  value={form.utilizationAlertLevel}
                  onChange={e => update("utilizationAlertLevel", Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ background: `linear-gradient(to right, hsl(206 70% 40%) ${((form.utilizationAlertLevel - 60) / 40) * 100}%, hsl(var(--border)) ${((form.utilizationAlertLevel - 60) / 40) * 100}%)` }}
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-muted-foreground">60%</span>
                  <span className="text-xs text-muted-foreground">100%</span>
                </div>
              </Field>
            </div>
          )}
          <Toggle
            checked={form.notifyDeadlineRisk}
            onChange={v => update("notifyDeadlineRisk", v)}
            label="Határidő kockázat értesítés"
          />
          <Toggle
            checked={form.notifyMaintenance}
            onChange={v => update("notifyMaintenance", v)}
            label="Karbantartási figyelmeztetés"
          />
        </div>
      </Section>

      {/* 5. Egyéb / rendszerinfó */}
      <Section
        icon={<Globe size={16} />}
        title="Rendszer információ"
        description="A jelenlegi verzió és tárolási adatok"
      >
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Verzió", value: "ProdAI v10" },
            { label: "Tárolás", value: "In-memory (demo)" },
            { label: "Backend", value: "Express + Node.js" },
            { label: "Frontend", value: "React + TypeScript" },
            { label: "Időzóna", value: "Europe/Budapest" },
            { label: "Fejlesztő", value: "Polyák Dominik" },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className="text-xs font-medium text-foreground font-mono">{item.value}</span>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            A beállítások a szerver memóriájában tárolódnak — az oldal frissítése vagy a szerver újraindítása után visszaállnak az alapértékekre. Adatbázis-alapú perzisztens tárolás egy következő verzióban kerül be.
          </p>
        </div>
      </Section>

      {/* Alsó mentés gomb */}
      {dirty && (
        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border pt-3 pb-2 flex gap-3">
          <Button variant="outline" onClick={reset} className="gap-1.5">
            <RotateCcw size={13} /> Visszaállít
          </Button>
          <Button
            className="flex-1 gap-1.5"
            disabled={saveMutation.isPending}
            onClick={() => form && saveMutation.mutate(form)}
          >
            {saveMutation.isPending ? <><Zap size={13} className="ai-pulse" /> Mentés folyamatban...</> : <><Save size={13} /> Beállítások mentése</>}
          </Button>
        </div>
      )}
    </div>
  );
}
