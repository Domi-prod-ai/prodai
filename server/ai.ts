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

export async function analyzeOrderWithAI(order: any, machines: any[], products: any[]): Promise<AiOrderAnalysis> {
  if (!openai) {
    // Fallback: szimulált AI ha nincs API kulcs
    return simulateAnalysis(order, machines, products);
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
    return simulateAnalysis(order, machines, products);
  }
}

export async function getAiSuggestions(machines: any[], orders: any[], tasks: any[]): Promise<Array<{type: string; title: string; description: string; impact: string}>> {
  if (!openai) return simulateSuggestions(machines, orders);

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
    return Array.isArray(result) ? result : result.suggestions || simulateSuggestions(machines, orders);
  } catch {
    return simulateSuggestions(machines, orders);
  }
}

function simulateAnalysis(order: any, machines: any[], products: any[]): AiOrderAnalysis {
  const available = machines.filter(m => m.status === "online").sort((a, b) => a.utilization - b.utilization);
  const bestMachine = available[0] || machines[0];
  const now = new Date();
  const start = new Date(now.getTime() + 60 * 60 * 1000);
  const product = products.find(p => p.id === order.productId);
  const hours = Math.ceil((order.quantity * (product?.cycleTimeMinutes || 60)) / 60);
  const end = new Date(start.getTime() + hours * 60 * 60 * 1000);

  return {
    tasks: bestMachine ? [{ machineId: bestMachine.id, startTime: start.toISOString(), endTime: end.toISOString(), priority: order.priority }] : [],
    suggestions: [
      { type: "optimization", title: "Optimális gép kiválasztva", description: `A ${bestMachine?.name} a legkevésbé terhelt gép (${bestMachine?.utilization}%).`, impact: "medium" },
      { type: "info", title: "Becsült gyártási idő", description: `${hours} óra szükséges a ${order.quantity} db legyártásához.`, impact: "low" },
    ],
    summary: `Az AI a ${bestMachine?.name} gépet javasolta ${hours} óra gyártási idővel.`,
  };
}

function simulateSuggestions(machines: any[], orders: any[]) {
  const suggestions = [];
  const overloaded = machines.filter(m => m.utilization > 85);
  if (overloaded.length > 0) {
    suggestions.push({ type: "bottleneck", title: `Túlterhelt gép: ${overloaded[0].name}`, description: `${overloaded[0].utilization}% kihasználtság – kapacitásbővítés javasolt.`, impact: "high" });
  }
  const urgent = orders.filter(o => o.priority === "urgent");
  if (urgent.length > 0) {
    suggestions.push({ type: "warning", title: `${urgent.length} sürgős rendelés`, description: "Prioritásos ütemezés szükséges a határidők tartásához.", impact: "high" });
  }
  suggestions.push({ type: "optimization", title: "Műszakbeosztás optimalizálás", description: "3-műszakos rendszerre váltással 40%-kal növelhető a kapacitás.", impact: "medium" });
  suggestions.push({ type: "info", title: "AI elemzés aktív", description: "A rendszer folyamatosan monitorozza a termelési adatokat.", impact: "low" });
  return suggestions;
}
