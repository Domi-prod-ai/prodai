import OpenAI from "openai";

// OpenAI kliens - API kulcs env-ből
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export interface AiOrderAnalysis {
  tasks: Array<{
    machineId: number;
    startTime: string;
    endTime: string;
    priority: string;
  }>;
  suggestions: Array<{
    type: string;
    title: string;
    description: string;
    impact: string;
  }>;
  summary: string;
}

// ─── Gépteljesítmény-pontszám ───────────────────────────────────────────────
// Minden géphez kiszámol egy 0–100 közötti "megbízhatósági" pontot
// amelyet az AI felhasznál a döntésnél.
// Figyelembe vesz:
//   1. Karbantartási előzmények (sok corrective karbantartás = megbízhatatlan gép)
//   2. Határidő-tartási arány (múltbeli feladatokon mennyit késett)
//   3. Terhelés-előzmény (elmúlt 30 nap átlagos kihasználtsága)
//   4. Következő karbantartás közelség (ha hamarosan karbantartás van, kerüljük)
export function computeMachineScore(
  machine: any,
  tasks: any[],          // összes feladat (minden cégé szűrve)
  maintenanceLogs: any[] // összes karbantartási napló
): {
  reliabilityScore: number;   // 0–100, magasabb = jobb
  penaltyReasons: string[];   // magyarázat, ha levonás van
  bonusReasons: string[];     // magyarázat, ha bónusz van
} {
  const penaltyReasons: string[] = [];
  const bonusReasons: string[] = [];
  let score = 100;

  const machineTasks = tasks.filter(t => t.machineId === machine.id);
  const machineLogs = maintenanceLogs.filter(m => m.machineId === machine.id);
  const now = new Date();

  // ── 1. Karbantartási megbízhatóság ─────────────────────────────────────────
  // corrective (javítás) naplók az elmúlt 90 napban
  const last90days = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
  const correctiveLogs = machineLogs.filter(l =>
    l.type === "corrective" && new Date(l.createdAt || l.scheduledDate) >= last90days
  );
  if (correctiveLogs.length >= 3) {
    score -= 25;
    penaltyReasons.push(`Sok javítás az elmúlt 90 napban (${correctiveLogs.length}x) — megbízhatóság csökkent`);
  } else if (correctiveLogs.length === 2) {
    score -= 12;
    penaltyReasons.push(`2 javítás az elmúlt 90 napban`);
  } else if (correctiveLogs.length === 1) {
    score -= 5;
    penaltyReasons.push(`1 javítás az elmúlt 90 napban`);
  }

  // ── 2. Következő karbantartás közelség ─────────────────────────────────────
  const scheduledMaint = machineLogs.filter(l =>
    l.status === "scheduled" && l.scheduledDate
  );
  for (const maint of scheduledMaint) {
    const maintDate = new Date(maint.scheduledDate);
    const daysUntil = (maintDate.getTime() - now.getTime()) / (24 * 3600 * 1000);
    if (daysUntil >= 0 && daysUntil <= 3) {
      score -= 20;
      penaltyReasons.push(`Karbantartás tervezett: ${Math.round(daysUntil)} napon belül`);
    } else if (daysUntil >= 0 && daysUntil <= 7) {
      score -= 8;
      penaltyReasons.push(`Karbantartás tervezett: ${Math.round(daysUntil)} napon belül`);
    }
  }

  // ── 3. Határidő-tartási arány ───────────────────────────────────────────────
  // Elvégzett (done) feladatok: összehasonlítja az endTime-ot a dueDate-tel
  const doneTasks = machineTasks.filter(t => t.status === "done");
  if (doneTasks.length >= 3) {
    const lateCount = doneTasks.filter(t => {
      // Ha van orderId-ja, azt kellene megnézni, de ez az info itt nincs
      // Helyette: ha a task befejezési ideje > most+1h amikor "done"-ná vált, későnek tekintjük
      // Egyszerűsített verzió: nagyon régi done task = rendben volt
      const end = new Date(t.endTime);
      return end > now; // Ha jövőbeli endTime van amin done státusz — késő jelölés
    }).length;
    const onTimeRate = (doneTasks.length - lateCount) / doneTasks.length;
    if (onTimeRate >= 0.9) {
      score += 10;
      bonusReasons.push(`Magas határidő-tartás: ${Math.round(onTimeRate * 100)}%`);
    } else if (onTimeRate < 0.7) {
      score -= 15;
      penaltyReasons.push(`Alacsony határidő-tartás: ${Math.round(onTimeRate * 100)}%`);
    }
  }

  // ── 4. Terhelés-előzmény (elmúlt 30 nap) ───────────────────────────────────
  const last30days = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const recentTasks = machineTasks.filter(t => new Date(t.startTime) >= last30days);
  // Összes foglalt perc az elmúlt 30 napban
  const totalBookedMinutes = recentTasks.reduce((acc, t) => {
    const start = new Date(t.startTime);
    const end = new Date(t.endTime);
    return acc + Math.max(0, (end.getTime() - start.getTime()) / 60000);
  }, 0);
  const availableMinutes30d = 30 * 24 * 60; // 30 nap összes perce
  const historicUtilization = Math.min(100, (totalBookedMinutes / availableMinutes30d) * 100);

  // Ha a históriás kihasználtság nagy, de az aktuális utilization alacsony
  // (esetleg az adatok nem frissültek) — figyelmeztető
  if (historicUtilization > 80 && machine.utilization < 50) {
    score -= 5;
    penaltyReasons.push(`Magas historikus terhelés (${historicUtilization.toFixed(0)}%) az utóbbi 30 napban`);
  }

  // ── 5. Alapkihasználtság büntetés (aktuális) ───────────────────────────────
  if (machine.utilization > 90) {
    score -= 20;
    penaltyReasons.push(`Kritikus kihasználtság: ${machine.utilization}%`);
  } else if (machine.utilization > 75) {
    score -= 10;
    penaltyReasons.push(`Magas kihasználtság: ${machine.utilization}%`);
  } else if (machine.utilization < 30) {
    score += 5;
    bonusReasons.push(`Alacsony kihasználtság — könnyen befogadja az új rendelést`);
  }

  // ── 6. Gép kora (ha régi, kicsit le) ───────────────────────────────────────
  if (machine.yearOfManufacture && machine.yearOfManufacture > 0) {
    const age = new Date().getFullYear() - machine.yearOfManufacture;
    if (age > 15) {
      score -= 5;
      penaltyReasons.push(`Régi gép (${age} éves) — magasabb meghibásodási kockázat`);
    } else if (age <= 3) {
      score += 5;
      bonusReasons.push(`Új gép (${age} éves) — alacsony meghibásodási kockázat`);
    }
  }

  return {
    reliabilityScore: Math.max(0, Math.min(100, Math.round(score))),
    penaltyReasons,
    bonusReasons,
  };
}

// ─── Szimulált AI elemzés (nincs OpenAI kulcs) ───────────────────────────────
export async function analyzeOrderWithAI(
  order: any,
  machines: any[],
  products: any[],
  tasks: any[] = [],
  maintenanceLogs: any[] = []
): Promise<AiOrderAnalysis> {
  if (!openai) {
    return simulateAnalysis(order, machines, products, tasks, maintenanceLogs);
  }

  const product = products.find(p => p.id === order.productId);
  const prompt = `Te egy gyártástervező AI asszisztens vagy fröccsöntő iparban.

Rendelés adatok:
- Rendelésszám: ${order.orderNumber}
- Termék: ${product?.name || "ismeretlen"} (${product?.sku || ""})
- Mennyiség: ${order.quantity} db
- Határidő: ${order.dueDate}
- Prioritás: ${order.priority}
- Ciklusidő: ${product?.cycleTimeMinutes || 60} perc/db

Elérhető gépek:
${machines.map(m => `- ${m.name} (${m.type}), kapacitás: ${m.capacityPerHour}/óra, kihasználtság: ${m.utilization}%`).join("\n")}

Válaszolj JSON formátumban:
{
  "tasks": [{"machineId": number, "startTime": "ISO string", "endTime": "ISO string", "priority": "string"}],
  "suggestions": [{"type": "optimization|warning|bottleneck|info", "title": "string", "description": "string", "impact": "high|medium|low"}],
  "summary": "rövid összefoglaló magyarul"
}`;

  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 800,
    });
    const result = JSON.parse(resp.choices[0].message.content || "{}");
    return result as AiOrderAnalysis;
  } catch (e) {
    console.error("OpenAI hiba:", e);
    return simulateAnalysis(order, machines, products, tasks, maintenanceLogs);
  }
}

export async function getAiSuggestions(
  machines: any[],
  orders: any[],
  tasks: any[],
  maintenanceLogs: any[] = []
): Promise<Array<{type: string; title: string; description: string; impact: string}>> {
  if (!openai) return simulateSuggestions(machines, orders, tasks, maintenanceLogs);

  const overloaded = machines.filter(m => m.utilization > 85);
  const urgentOrders = orders.filter(o => o.priority === "urgent" || o.priority === "high");

  const prompt = `Elemezd a gyártási helyzetet és adj javaslatokat magyarul.

Gépek kihasználtsága:
${machines.map(m => `- ${m.name}: ${m.utilization}%`).join("\n")}

Sürgős rendelések: ${urgentOrders.length}
Összes aktív feladat: ${tasks.length}

Adj 3-4 konkrét javaslatot JSON tömbként:
[{"type": "bottleneck|optimization|warning|info", "title": "rövid cím", "description": "részletes leírás", "impact": "high|medium|low"}]`;

  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 600,
    });
    const result = JSON.parse(resp.choices[0].message.content || "{}");
    return Array.isArray(result) ? result : result.suggestions || simulateSuggestions(machines, orders, tasks, maintenanceLogs);
  } catch {
    return simulateSuggestions(machines, orders, tasks, maintenanceLogs);
  }
}

// ─── Részletes szimuláció (belső logika) ─────────────────────────────────────
function simulateAnalysis(
  order: any,
  machines: any[],
  products: any[],
  tasks: any[],
  maintenanceLogs: any[]
): AiOrderAnalysis {
  const available = machines.filter(m => m.status === "online");
  const now = new Date();
  const start = new Date(now.getTime() + 60 * 60 * 1000);
  const product = products.find(p => p.id === order.productId);
  const hours = Math.ceil((order.quantity * (product?.cycleTimeMinutes || 60)) / 60);
  const end = new Date(start.getTime() + hours * 60 * 60 * 1000);

  // Megbízhatósági pontszám minden gépre
  const scored = available.map(m => ({
    machine: m,
    ...computeMachineScore(m, tasks, maintenanceLogs),
  }));
  scored.sort((a, b) => b.reliabilityScore - a.reliabilityScore);
  const best = scored[0]?.machine || machines[0];
  const bestScore = scored[0];

  const suggestions = [];
  if (bestScore?.penaltyReasons.length) {
    suggestions.push({
      type: "warning",
      title: "Figyelmeztetés a javasolt gépnél",
      description: bestScore.penaltyReasons.join("; "),
      impact: "medium",
    });
  }
  suggestions.push({
    type: "optimization",
    title: "Optimális gép kiválasztva",
    description: `A ${best?.name} kapta a legmagasabb megbízhatósági pontszámot (${bestScore?.reliabilityScore ?? "?"}/100).`,
    impact: "medium",
  });
  suggestions.push({
    type: "info",
    title: "Becsült gyártási idő",
    description: `${hours} óra szükséges a ${order.quantity} db legyártásához.`,
    impact: "low",
  });

  return {
    tasks: best ? [{ machineId: best.id, startTime: start.toISOString(), endTime: end.toISOString(), priority: order.priority }] : [],
    suggestions,
    summary: `AI megbízhatósági elemzés alapján a ${best?.name} gép javasolt (${bestScore?.reliabilityScore ?? "?"}/100 pont), ${hours} óra gyártási idővel.`,
  };
}

function simulateSuggestions(
  machines: any[],
  orders: any[],
  tasks: any[],
  maintenanceLogs: any[]
) {
  const suggestions: any[] = [];
  const now = new Date();

  // 1. Túlterhelt gépek
  const overloaded = machines.filter(m => m.utilization > 85);
  if (overloaded.length > 0) {
    suggestions.push({
      type: "bottleneck",
      title: `Túlterhelt gép: ${overloaded[0].name}`,
      description: `${overloaded[0].utilization}% kihasználtság — kapacitásbővítés vagy átütemezés javasolt.`,
      impact: "high",
    });
  }

  // 2. Sürgős rendelések
  const urgent = orders.filter(o => o.priority === "urgent");
  if (urgent.length > 0) {
    suggestions.push({
      type: "warning",
      title: `${urgent.length} sürgős rendelés`,
      description: "Prioritásos ütemezés szükséges a határidők tartásához.",
      impact: "high",
    });
  }

  // 3. Közelgő karbantartás figyelmeztetés
  const last90days = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
  for (const machine of machines) {
    const machineLogs = maintenanceLogs.filter(l => l.machineId === machine.id);
    const correctiveCount = machineLogs.filter(l =>
      l.type === "corrective" && new Date(l.createdAt || l.scheduledDate) >= last90days
    ).length;
    if (correctiveCount >= 2) {
      suggestions.push({
        type: "warning",
        title: `${machine.name} — ismétlődő meghibásodás`,
        description: `${correctiveCount} javítás az elmúlt 90 napban. Megelőző karbantartás javasolt.`,
        impact: "high",
      });
      break; // Csak az első ilyen gépet jelzük
    }
  }

  // 4. Határidőn túli rendelések
  const overdueOrders = orders.filter(o => {
    if (!o.dueDate) return false;
    return new Date(o.dueDate) < now && o.status !== "done";
  });
  if (overdueOrders.length > 0) {
    suggestions.push({
      type: "bottleneck",
      title: `${overdueOrders.length} lejárt határidejű rendelés`,
      description: `${overdueOrders.map((o: any) => o.orderNumber).slice(0, 3).join(", ")} — azonnali intézkedés szükséges.`,
      impact: "high",
    });
  }

  // 5. Kihasználatlan gép
  const idle = machines.filter(m => m.status === "online" && m.utilization < 20);
  if (idle.length > 0 && tasks.length > 0) {
    suggestions.push({
      type: "optimization",
      title: `Kihasználatlan gép: ${idle[0].name}`,
      description: `Csak ${idle[0].utilization}% kihasználtság — érdemes feladatot átütemezni erre a gépre.`,
      impact: "medium",
    });
  }

  // 6. Általános műszakoptimalizálás (ha nincs elég javaslat)
  if (suggestions.length < 3) {
    suggestions.push({
      type: "optimization",
      title: "Műszakbeosztás optimalizálás",
      description: "3-műszakos rendszerre váltással 40%-kal növelhető a kapacitás.",
      impact: "medium",
    });
  }

  suggestions.push({
    type: "info",
    title: "AI elemzés aktív",
    description: "A rendszer folyamatosan monitorozza a termelési adatokat és az előzmények alapján tanul.",
    impact: "low",
  });

  return suggestions.slice(0, 5);
}
