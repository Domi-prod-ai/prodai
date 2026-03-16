import type { Express } from "express";
import { type Server } from "http";
import { storage, type AppSettings } from "./storage";
import { insertOrderSchema, insertProductSchema, insertTaskSchema, insertMachineSchema, insertMoldSchema, insertMaintenanceLogSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import pdfParse from "pdf-parse";
import { hashPassword, comparePassword, generateToken, requireAuth, requireSuperAdmin } from "./auth";
import { sendWelcomeEmail, sendInviteEmail, sendDeadlineWarningEmail } from "./email";
import crypto from "crypto";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // ─── AUTH ───────────────────────────────────────────────────────────────

  // Regisztracio
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { companyName, email, password, name } = req.body;
      if (!companyName || !email || !password || !name) {
        return res.status(400).json({ error: "Minden mezo kitoltese kotelezo" });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "A jelszo legalabb 6 karakter legyen" });
      }
      // Email egyediség
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "Ez az email mar regisztralt" });
      }
      // Ceg slug: nev -> kisbetus, szokoz -> kotojel
      const slug = companyName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 30) + "-" + Date.now().toString(36);
      const company = await storage.createCompany(companyName, slug);
      const passwordHash = await hashPassword(password);
      const user = await storage.createUser(company.id, email, passwordHash, name, "admin");
      const token = generateToken({ userId: user.id, companyId: company.id, email: user.email, role: user.role });
      // Üdvözlő email küldése aszinkron (nem blokkolja a választ)
      sendWelcomeEmail(email, name, companyName).catch(e => console.error("Welcome email hiba:", e));
      res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        company: { id: company.id, name: company.name }
      });
    } catch (e: any) {
      console.error("Register error:", e);
      res.status(500).json({ error: "Szerver hiba" });
    }
  });

  // Kolléga meghívása
  app.post("/api/invite", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email megadása kötelező" });
      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(409).json({ error: "Ez az email már regisztrált" });
      const token = crypto.randomBytes(32).toString("hex");
      const now = new Date();
      const expires = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      storage.run(
        `INSERT INTO invites (company_id, email, token, invited_by, used, created_at, expires_at) VALUES (?,?,?,?,0,?,?)`,
        [user.companyId, email, token, user.userId, now.toISOString(), expires.toISOString()]
      );
      const company = await storage.getCompanyById(user.companyId);
      const inviter = await storage.getUserById(user.userId);
      await sendInviteEmail(email, inviter?.name || "Kolléga", company?.name || "ProdAI", token);
      res.json({ ok: true, message: "Meghívó elküldve" });
    } catch (e: any) {
      console.error("Invite hiba:", e);
      res.status(500).json({ error: "Szerver hiba" });
    }
  });

  // Meghívó elfogadása
  app.post("/api/invite/accept", async (req, res) => {
    try {
      const { token, name, password } = req.body;
      if (!token || !name || !password) return res.status(400).json({ error: "Hiányzó adatok" });
      const invite = storage.getOne("SELECT * FROM invites WHERE token=? AND used=0", [token]);
      if (!invite) return res.status(404).json({ error: "Érvénytelen vagy lejárt meghívó" });
      if (new Date(invite.expires_at) < new Date()) return res.status(410).json({ error: "A meghívó lejárt" });
      const existing = await storage.getUserByEmail(invite.email);
      if (existing) return res.status(409).json({ error: "Ez az email már regisztrált" });
      const passwordHash = await hashPassword(password);
      const user = await storage.createUser(invite.company_id, invite.email, passwordHash, name, "user");
      storage.run("UPDATE invites SET used=1 WHERE token=?", [token]);
      const company = await storage.getCompanyById(invite.company_id);
      const authToken = generateToken({ userId: user.id, companyId: user.companyId, email: user.email, role: user.role });
      sendWelcomeEmail(user.email, name, company?.name || "ProdAI").catch(() => {});
      res.json({ token: authToken, user: { id: user.id, name: user.name, email: user.email, role: user.role }, company });
    } catch (e: any) {
      console.error("Invite accept hiba:", e);
      res.status(500).json({ error: "Szerver hiba" });
    }
  });

  // Kollégák listája (saját cégből)
  app.get("/api/team", requireAuth, async (req, res) => {
    const user = (req as any).user;
    const allUsers = await storage.getAllUsers();
    const team = allUsers
      .filter(u => u.companyId === user.companyId)
      .map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt }));
    res.json(team);
  });

  // Határidő figyelmeztetések küldése (manuális trigger)
  app.post("/api/notify/deadline", requireAuth, async (req, res) => {
    const user = (req as any).user;
    const orders = await storage.getOrders(user.companyId);
    const dbUser = await storage.getUserById(user.userId);
    const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const urgent = orders.filter(o => {
      const due = new Date(o.dueDate);
      return due <= in48h && o.status !== "done";
    }).map(o => ({ orderNumber: o.orderNumber, dueDate: o.dueDate, priority: o.priority }));
    if (urgent.length === 0) return res.json({ ok: true, message: "Nincs közeledő határidő" });
    await sendDeadlineWarningEmail(dbUser?.email || "", dbUser?.name || "", urgent);
    res.json({ ok: true, message: `${urgent.length} rendelésről küldtünk értesítést` });
  });

  // Bejelentkezes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email es jelszo megadasa kotelezo" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Hibas email vagy jelszo" });
      }
      const ok = await comparePassword(password, user.passwordHash);
      if (!ok) {
        return res.status(401).json({ error: "Hibas email vagy jelszo" });
      }
      const company = await storage.getCompanyById(user.companyId);
      const token = generateToken({ userId: user.id, companyId: user.companyId, email: user.email, role: user.role });
      res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        company: { id: company?.id, name: company?.name }
      });
    } catch (e: any) {
      console.error("Login error:", e);
      res.status(500).json({ error: "Szerver hiba" });
    }
  });

  // Aktualis felhasznalo
  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const u = (req as any).user;
    const user = await storage.getUserById(u.userId);
    const company = await storage.getCompanyById(u.companyId);
    if (!user) return res.status(404).json({ error: "Nem talalhato" });
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      company: { id: company?.id, name: company?.name }
    });
  });


  // ─── Globális auth middleware minden védett route-ra ──────────────────────
  app.use([
    "/api/products", "/api/machines", "/api/orders", "/api/tasks",
    "/api/ai-suggestions", "/api/molds", "/api/maintenance",
    "/api/ai", "/api/production-plan", "/api/import",
    "/api/settings", "/api/reports"
  ], requireAuth);

  // ─── Products ──────────────────────────────────────────────────────────────
  app.get("/api/products", async (req, res) => {
    const user = (req as any).user;
    res.json(await storage.getProducts(user.companyId));
  });

  app.get("/api/products/search", async (req, res) => {
    const sku = String(req.query.sku || "").trim();
    if (!sku) return res.status(400).json({ error: "SKU megadása kötelező" });
    const product = await storage.getProductBySku(sku, user.companyId);
    if (!product) return res.status(404).json({ error: `Nem található termék ezzel a kóddal: ${sku}` });
    res.json(product);
  });

  app.post("/api/products", async (req, res) => {
    const body = req.body;
    const coerced = {
      ...body,
      cycleTimeMinutes: Number(body.cycleTimeMinutes) || 60,
      weight: body.weight !== undefined ? Number(body.weight) || 0 : 0,
    };
    const parsed = insertProductSchema.safeParse(coerced);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.json(await storage.createProduct(parsed.data, user.companyId));
  });

  app.patch("/api/products/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const body = req.body;
    const coerced: any = { ...body };
    if (body.cycleTimeMinutes !== undefined) coerced.cycleTimeMinutes = Number(body.cycleTimeMinutes) || 60;
    if (body.weight !== undefined) coerced.weight = Number(body.weight) || 0;
    res.json(await storage.updateProduct(id, coerced));
  });

  app.delete("/api/products/:id", async (req, res) => {
    await storage.deleteProduct(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // CSV/tömeges termék import
  app.post("/api/products/bulk", async (req, res) => {
    const { items } = req.body as { items: any[] };
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Üres vagy hibás adatlista" });
    }
    const valid: any[] = [];
    const errors: string[] = [];
    items.forEach((item, idx) => {
      const parsed = insertProductSchema.safeParse({
        name: item.name || item.Termék || item.termek || item["Termék neve"] || "",
        sku: item.sku || item.SKU || item.cikkszam || item["Cikkszám"] || `SKU-${Date.now()}-${idx}`,
        unit: item.unit || item.Egység || "db",
        cycleTimeMinutes: parseInt(item.cycleTimeMinutes || item.ciklusido || item["Ciklus idő (perc)"] || "60") || 60,
        color: item.color || "#4f98a3",
        material: item.material || item.Anyag || item.anyag || "",
        weight: parseFloat(item.weight || item.Tömeg || item.tomeg || "0") || 0,
        machineType: item.machineType || item.Geptipus || item["Gép típusa"] || "",
        notes: item.notes || item.Megjegyzes || item.Megjegyzés || "",
      });
      if (parsed.success) valid.push(parsed.data);
      else errors.push(`Sor ${idx + 1}: ${parsed.error.issues[0]?.message}`);
    });
    const created = await storage.bulkCreateProducts(valid, user.companyId);
    res.json({ created: created.length, errors });
  });

  // ─── Machines ──────────────────────────────────────────────────────────────
  app.get("/api/machines", async (req, res) => {
    const user = (req as any).user;
    res.json(await storage.getMachines(user.companyId));
  });

  app.post("/api/machines", async (req, res) => {
    const body = req.body;
    // Explicit number coercion — HTML forms and some frontends send strings
    const coerced = {
      ...body,
      capacityPerHour: Number(body.capacityPerHour) || 0,
      utilization: Number(body.utilization) || 0,
      clampingForce: body.clampingForce !== undefined ? Number(body.clampingForce) || 0 : 0,
      shotVolume: body.shotVolume !== undefined ? Number(body.shotVolume) || 0 : 0,
      screwDiameter: body.screwDiameter !== undefined ? Number(body.screwDiameter) || 0 : 0,
      yearOfManufacture: body.yearOfManufacture !== undefined ? Number(body.yearOfManufacture) || 0 : 0,
    };
    const parsed = insertMachineSchema.safeParse(coerced);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.json(await storage.createMachine(parsed.data, user.companyId));
  });

  app.patch("/api/machines/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const body = req.body;
    const coerced: any = { ...body };
    if (body.capacityPerHour !== undefined) coerced.capacityPerHour = Number(body.capacityPerHour) || 0;
    if (body.utilization !== undefined) coerced.utilization = Number(body.utilization) || 0;
    if (body.clampingForce !== undefined) coerced.clampingForce = Number(body.clampingForce) || 0;
    if (body.shotVolume !== undefined) coerced.shotVolume = Number(body.shotVolume) || 0;
    if (body.screwDiameter !== undefined) coerced.screwDiameter = Number(body.screwDiameter) || 0;
    if (body.yearOfManufacture !== undefined) coerced.yearOfManufacture = Number(body.yearOfManufacture) || 0;
    res.json(await storage.updateMachine(id, coerced));
  });

  app.delete("/api/machines/:id", async (req, res) => {
    await storage.deleteMachine(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ─── Orders ────────────────────────────────────────────────────────────────
  app.get("/api/orders", async (req, res) => {
    const user = (req as any).user;
    res.json(await storage.getOrders(user.companyId));
  });

  app.post("/api/orders", async (req, res) => {
    const body = req.body;
    const coerced = {
      ...body,
      productId: Number(body.productId) || 1,
      quantity: Number(body.quantity) || 1,
    };
    const parsed = insertOrderSchema.safeParse(coerced);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.json(await storage.createOrder(parsed.data, user.companyId));
  });

  app.patch("/api/orders/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    res.json(await storage.updateOrder(id, req.body));
  });

  app.delete("/api/orders/:id", async (req, res) => {
    await storage.deleteOrder(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ─── PDF Rendelés import ────────────────────────────────────────────────────
  // Feltölt egy PDF-et, kiszedi belőle a rendelés adatokat szövegelemzéssel
  app.post("/api/import/pdf", upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Nincs feltöltött fájl" });
    try {
      const data = await pdfParse(req.file.buffer);
      const text = data.text;

      // AI-stílusú szöveg elemzés mintaillesztéssel
      const extracted: any[] = [];
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

      // Keressük a lehetséges rendeléssorokat különböző formátumokban
      // Formátum 1: "Rendelésszám: ORD-xxx" típusú sorok
      const orderNumberPattern = /(?:rendel[eé]s(?:sz[aá]m)?[:.]?\s*)?([A-Z]{2,}[-_ ]?\d{4}[-_ ]\d{3,}|ORD[-_]\d+[-_]\d+)/gi;
      const quantityPattern = /(?:mennyis[eé]g[:.]?\s*)(\d+)/gi;
      const datePattern = /(?:hat[aá]rid[oő][:.]?\s*)?(\d{4}[-.]\d{2}[-.]\d{2})/gi;
      const productPattern = /(?:termék|cikkszám|sku)[:.]?\s*([A-Z]{2,}[-_][A-Z0-9]+)/gi;

      // Próbáljuk soronként feldolgozni táblázatos formátumban is
      // Várható CSV-szerű sor: rendelésszám, termék/cikkszám, mennyiség, dátum
      const tableRowPattern = /([A-Z]{2,}[-_]\d{3,}[-_]?\d*)\s+([A-Z]{2,}-[A-Z0-9]+|\d+)\s+(\d+)\s+(\d{4}[-.]\d{2}[-.]\d{2})/gi;

      let match;
      // Táblázatos sorok keresése
      while ((match = tableRowPattern.exec(text)) !== null) {
        extracted.push({
          orderNumber: match[1],
          productCode: match[2],
          quantity: parseInt(match[3]),
          dueDate: match[4].replace(/\./g, "-"),
          source: "táblázat",
        });
      }

      // Ha nincs táblázatos találat, próbálj kulcsszó-alapú feldolgozást
      if (extracted.length === 0) {
        let currentOrder: any = {};
        for (const line of lines) {
          const orderMatch = line.match(/([A-Z]{2,}[-_]\d{4,}[-_]\d+)/);
          const qtyMatch = line.match(/(\d+)\s*(?:db|pcs|piece|darab)/i);
          const dateMatch = line.match(/(\d{4}[-.]\d{2}[-.]\d{2})/);
          const skuMatch = line.match(/([A-Z]{2,3}-[A-Z0-9]{2,})/);

          if (orderMatch) {
            if (currentOrder.orderNumber) extracted.push({ ...currentOrder });
            currentOrder = { orderNumber: orderMatch[1], source: "kulcsszó" };
          }
          if (qtyMatch && currentOrder.orderNumber) currentOrder.quantity = parseInt(qtyMatch[1]);
          if (dateMatch && currentOrder.orderNumber) currentOrder.dueDate = dateMatch[1].replace(/\./g, "-");
          if (skuMatch && currentOrder.orderNumber && !currentOrder.productCode) currentOrder.productCode = skuMatch[1];
        }
        if (currentOrder.orderNumber) extracted.push(currentOrder);
      }

      // Termékkódok alapján productId-k hozzárendelése
      const products = await storage.getProducts(user.companyId);
      const enriched = extracted.map(item => {
        const product = item.productCode
          ? products.find(p => p.sku.toLowerCase() === item.productCode?.toLowerCase())
          : undefined;
        return {
          ...item,
          productId: product?.id || null,
          productName: product?.name || item.productCode || "Ismeretlen",
          quantity: item.quantity || 1,
          dueDate: item.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
          priority: "normal",
          status: "pending",
        };
      });

      res.json({
        rawText: text.slice(0, 2000), // Első 2000 karakter előnézetre
        extracted: enriched,
        pageCount: data.numpages,
        message: enriched.length > 0
          ? `${enriched.length} rendelés azonosítva`
          : "Nem sikerült automatikusan azonosítani rendeléseket. Ellenőrizd a nyers szöveget és add meg manuálisan.",
      });
    } catch (err: any) {
      console.error("PDF parse error:", err);
      res.status(500).json({ error: "A PDF feldolgozása sikertelen: " + (err.message || "ismeretlen hiba") });
    }
  });

  // ─── Tasks (Gantt) ─────────────────────────────────────────────────────────
  app.get("/api/tasks", async (req, res) => {
    const user = (req as any).user;
    res.json(await storage.getTasks(user.companyId));
  });

  app.post("/api/tasks", async (req, res) => {
    const parsed = insertTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.json(await storage.createTask(parsed.data, user.companyId));
  });

  app.patch("/api/tasks/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    res.json(await storage.updateTask(id, req.body));
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    await storage.deleteTask(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ─── AI Suggestions ────────────────────────────────────────────────────────
  app.get("/api/ai-suggestions", async (req, res) => {
    const user = (req as any).user;
    res.json(await storage.getAiSuggestions(user.companyId));
  });

  app.patch("/api/ai-suggestions/:id/resolve", async (req, res) => {
    const id = parseInt(req.params.id);
    res.json(await storage.resolveAiSuggestion(id));
  });

  // ─── AI: Analyze order → machine recommendation ────────────────────────────
  app.post("/api/ai/analyze-order", async (req, res) => {
    const { orderNumber, productId, quantity, priority, dueDate, notes } = req.body;
    if (!productId || !quantity || !dueDate) {
      return res.status(400).json({ error: "Hiányzó mezők" });
    }
    const machines = await storage.getMachines(user.companyId);
    const products = await storage.getProducts(user.companyId);
    const tasks = await storage.getTasks(user.companyId);
    const product = products.find(p => p.id === Number(productId));
    if (!product) return res.status(404).json({ error: "Termék nem található" });

    const onlineMachines = machines.filter(m => m.status === "online");
    const due = new Date(dueDate);
    const now = new Date();
    const hoursAvailable = Math.max(1, (due.getTime() - now.getTime()) / 3600000);
    const totalMinutesNeeded = product.cycleTimeMinutes * Number(quantity);

    // Ha a terméknek van machineType preferenciája, először azokat preferálja
    const preferredType = product.machineType || "";
    const scored = onlineMachines.map(m => {
      const machineTasks = tasks.filter(t => t.machineId === m.id);
      const bookedMinutes = machineTasks.reduce((acc, t) => {
        const start = new Date(t.startTime);
        const end = new Date(t.endTime);
        return acc + (end.getTime() - start.getTime()) / 60000;
      }, 0);
      const availableMinutes = hoursAvailable * 60 - bookedMinutes;
      const canFit = availableMinutes >= totalMinutesNeeded;
      const utilizationScore = m.utilization;
      const capacityMatch = Math.min(100, (m.capacityPerHour / 10) * 100);
      const urgencyBonus = (priority === "urgent" || priority === "high") && m.utilization < 70 ? -20 : 0;
      // Termék-gép kompatibilitás bonus
      const typeMatch = preferredType && m.type.toLowerCase().includes(preferredType.toLowerCase()) ? -30 : 0;
      const materialMatch = preferredType && m.materials && m.materials.toLowerCase().includes(product.material?.toLowerCase() || "") ? -15 : 0;
      const score = utilizationScore - capacityMatch + urgencyBonus + (canFit ? 0 : 100) + typeMatch + materialMatch;
      let reason = `${m.name} jelenleg ${m.utilization}% kihasználtsággal üzemel.`;
      if (typeMatch < 0) reason += ` Termék típus-kompatibilis (${product.machineType}).`;
      if (canFit) reason += ` A rendelés (${totalMinutesNeeded} perc) belefér a határidő előtt.`;
      else reason += ` Figyelem: csak részlegesen fér bele a határidőbe.`;
      return { machine: m, score, reason, canFit, availableMinutes };
    });
    scored.sort((a, b) => a.score - b.score);
    const top3 = scored.slice(0, Math.min(3, scored.length));
    const suggestions = top3.map((s, idx) => {
      const machineTasks = tasks
        .filter(t => t.machineId === s.machine.id)
        .sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime());
      let startTime = new Date();
      if (machineTasks.length > 0) {
        const lastEnd = new Date(machineTasks[machineTasks.length - 1].endTime);
        if (lastEnd > startTime) startTime = lastEnd;
      }
      const endTime = new Date(startTime.getTime() + totalMinutesNeeded * 60000);
      const onTime = endTime <= due;
      return {
        rank: idx + 1,
        machine: s.machine,
        score: Math.max(0, 100 - s.score),
        reason: s.reason,
        canFit: s.canFit,
        onTime,
        suggestedStart: startTime.toISOString().slice(0, 16),
        suggestedEnd: endTime.toISOString().slice(0, 16),
        estimatedMinutes: totalMinutesNeeded,
      };
    });
    const best = suggestions[0];
    const analysisText = [
      `Rendelés: ${orderNumber || "Új rendelés"} | Termék: ${product.name} | Mennyiség: ${quantity} db`,
      `Szükséges gyártási idő: ${totalMinutesNeeded} perc (${(totalMinutesNeeded / 60).toFixed(1)} óra)`,
      `Határidő: ${dueDate} — ${hoursAvailable.toFixed(0)} óra áll rendelkezésre`,
      ``,
      `Legjobb javaslat: ${best.machine.name}`,
      best.reason,
      best.onTime
        ? `A gyártás várhatóan ${best.suggestedEnd.replace("T", " ")}-re befejezhető — HATÁRIDŐN BELÜL.`
        : `FIGYELEM: Határidőn túli kockázat! Befejezés: ${best.suggestedEnd.replace("T", " ")}`,
    ].join("\n");
    res.json({ suggestions, analysisText, product, totalMinutesNeeded });
  });

  // ─── AI: Accept recommendation ────────────────────────────────────────────
  app.post("/api/ai/accept-recommendation", async (req, res) => {
    const { orderData, machineId, suggestedStart, suggestedEnd } = req.body;
    const order = await storage.createOrder({
      orderNumber: orderData.orderNumber,
      productId: Number(orderData.productId),
      quantity: Number(orderData.quantity),
      priority: orderData.priority,
      status: "planned",
      dueDate: orderData.dueDate,
      notes: orderData.notes || "",
      customer: orderData.customer || "",
    }, user.companyId);
    const task = await storage.createTask({
      orderId: order.id,
      machineId: Number(machineId),
      productId: Number(orderData.productId),
      startTime: suggestedStart,
      endTime: suggestedEnd,
      quantity: Number(orderData.quantity),
      status: "planned",
      aiOptimized: true,
    }, user.companyId);
    await storage.createAiSuggestion({
      type: "info",
      title: `Új rendelés elfogadva: ${order.orderNumber}`,
      description: `AI javaslattal gyártás indítva: ${suggestedStart.replace("T", " ")} — ${suggestedEnd.replace("T", " ")}.`,
      impact: "low",
      resolved: false,
      createdAt: new Date().toISOString(),
    }, user.companyId);
    res.json({ order, task });
  });

  // ─── Production plan download data ────────────────────────────────────────
  app.get("/api/production-plan", async (req, res) => {
    const user = (req as any).user;
    const orders = await storage.getOrders(user.companyId);
    const tasks = await storage.getTasks(user.companyId);
    const machines = await storage.getMachines(user.companyId);
    const products = await storage.getProducts(user.companyId);
    const enriched = tasks.map(t => {
      const order = orders.find(o => o.id === t.orderId);
      const machine = machines.find(m => m.id === t.machineId);
      const product = products.find(p => p.id === t.productId);
      return { task: t, order, machine, product };
    }).sort((a, b) => new Date(a.task.startTime).getTime() - new Date(b.task.startTime).getTime());
    const onlineMachines = machines.filter(m => m.status === "online");
    const summary = {
      generatedAt: new Date().toISOString(),
      totalOrders: orders.length,
      plannedTasks: tasks.length,
      machineCount: onlineMachines.length,
      avgUtilization: Math.round(
        onlineMachines.reduce((s, m) => s + m.utilization, 0) / (onlineMachines.length || 1)
      ),
    };
    res.json({ summary, rows: enriched });
  });

  // ─── AI Auto-Plan ──────────────────────────────────────────────────────────
  app.post("/api/ai/auto-plan", async (req, res) => {
    const user = (req as any).user;
    await storage.clearTasks(user.companyId);
    const orders = await storage.getOrders(user.companyId);
    const machines = await storage.getMachines(user.companyId);
    const products = await storage.getProducts(user.companyId);
    const onlineMachines = machines.filter(m => m.status === "online");
    const priorityOrder = ["urgent", "high", "normal", "low"];
    const sorted = [...orders].sort((a, b) =>
      priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority)
    );
    const machineEndTimes: Record<number, Date> = {};
    onlineMachines.forEach(m => { machineEndTimes[m.id] = new Date(); });
    const newTasks = [];
    for (const order of sorted) {
      const product = products.find(p => p.id === order.productId);
      if (!product) continue;
      const totalMs = product.cycleTimeMinutes * 60 * 1000 * order.quantity;
      // Termék-gép kompatibilitás figyelembevétele
      let eligible = onlineMachines;
      if (product.machineType) {
        const compatible = onlineMachines.filter(m =>
          m.type.toLowerCase().includes(product.machineType!.toLowerCase())
        );
        if (compatible.length > 0) eligible = compatible;
      }
      let bestMachine = eligible[0];
      let earliest = machineEndTimes[bestMachine.id];
      for (const m of eligible) {
        if (machineEndTimes[m.id] < earliest) {
          earliest = machineEndTimes[m.id];
          bestMachine = m;
        }
      }
      const start = new Date(machineEndTimes[bestMachine.id]);
      const end = new Date(start.getTime() + totalMs);
      machineEndTimes[bestMachine.id] = end;
      const task = await storage.createTask({
        orderId: order.id,
        machineId: bestMachine.id,
        productId: order.productId,
        startTime: start.toISOString().slice(0, 16),
        endTime: end.toISOString().slice(0, 16),
        quantity: order.quantity,
        status: "planned",
        aiOptimized: true,
      }, user.companyId);
      newTasks.push(task);
      await storage.updateOrder(order.id, { status: "planned" });
    }
    const highUtil = onlineMachines.filter(m => m.utilization > 85);
    if (highUtil.length > 0) {
      await storage.createAiSuggestion({
        type: "bottleneck",
        title: "Szűk keresztmetszet érzékelve",
        description: `${highUtil.map(m => m.name).join(", ")} gép(ek) kihasználtsága kritikus szint felett van.`,
        impact: "high",
        resolved: false,
        createdAt: new Date().toISOString(),
      }, user.companyId);
    }
    res.json({ tasks: newTasks, message: "AI ütemezés kész" });
  });

  // ─── Molds ───────────────────────────────────────────────────────────────
  app.get("/api/molds", async (req, res) => {
    const user = (req as any).user;
    res.json(await storage.getMolds(user.companyId));
  });
  app.post("/api/molds", async (req, res) => {
    const body = req.body;
    const coerced = { ...body, productId: Number(body.productId)||0, machineId: Number(body.machineId)||0, cavities: Number(body.cavities)||1, totalShots: Number(body.totalShots)||0, maxShots: Number(body.maxShots)||500000, weight: Number(body.weight)||0, yearOfManufacture: Number(body.yearOfManufacture)||0 };
    const parsed = insertMoldSchema.safeParse(coerced);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.json(await storage.createMold(parsed.data, user.companyId));
  });
  app.patch("/api/molds/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const body = req.body;
    if (body.totalShots !== undefined) body.totalShots = Number(body.totalShots);
    if (body.maxShots !== undefined) body.maxShots = Number(body.maxShots);
    if (body.cavities !== undefined) body.cavities = Number(body.cavities);
    res.json(await storage.updateMold(id, body));
  });
  app.delete("/api/molds/:id", async (req, res) => {
    await storage.deleteMold(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ─── Maintenance ─────────────────────────────────────────────────────────
  app.get("/api/maintenance", async (req, res) => {
    const user = (req as any).user;
    res.json(await storage.getMaintenanceLogs(user.companyId));
  });
  app.post("/api/maintenance", async (req, res) => {
    const body = { ...req.body, machineId: Number(req.body.machineId)||0, moldId: Number(req.body.moldId)||0, durationHours: Number(req.body.durationHours)||0, cost: Number(req.body.cost)||0, createdAt: new Date().toISOString() };
    const parsed = insertMaintenanceLogSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.json(await storage.createMaintenanceLog(parsed.data, user.companyId));
  });
  app.patch("/api/maintenance/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    res.json(await storage.updateMaintenanceLog(id, req.body));
  });
  app.delete("/api/maintenance/:id", async (req, res) => {
    await storage.deleteMaintenanceLog(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ─── Settings ───────────────────────────────────────────────────────────────
  app.get("/api/settings", async (_req, res) => {
    res.json(await storage.getSettings());
  });

  app.patch("/api/settings", async (req, res) => {
    try {
      const updated = await storage.updateSettings(req.body as Partial<AppSettings>);
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ─── ADMIN API (csak superadmin) ──────────────────────────────────────────

  // Rendszer statisztikák
  app.get("/api/admin/stats", requireSuperAdmin, async (_req, res) => {
    res.json(await storage.getSystemStats());
  });

  // Összes cég
  app.get("/api/admin/companies", requireSuperAdmin, async (_req, res) => {
    const companies = await storage.getAllCompanies();
    const users = await storage.getAllUsers();
    const result = companies.map(c => ({
      ...c,
      userCount: users.filter(u => u.companyId === c.id).length,
    }));
    res.json(result);
  });

  // Cég törlése
  app.delete("/api/admin/companies/:id", requireSuperAdmin, async (req, res) => {
    await storage.deleteCompany(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // Összes felhasználó
  app.get("/api/admin/users", requireSuperAdmin, async (_req, res) => {
    const users = await storage.getAllUsers();
    const companies = await storage.getAllCompanies();
    const result = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      companyId: u.companyId,
      companyName: companies.find(c => c.id === u.companyId)?.name || "-",
    }));
    res.json(result);
  });

  // Szerepkör módosítás
  app.patch("/api/admin/users/:id/role", requireSuperAdmin, async (req, res) => {
    const user = await storage.updateUserRole(parseInt(req.params.id), req.body.role);
    res.json({ ok: true, user });
  });

  // Jelszavó visszaallítás
  app.patch("/api/admin/users/:id/password", requireSuperAdmin, async (req, res) => {
    if (!req.body.password || req.body.password.length < 6) {
      return res.status(400).json({ error: "A jelszo legalabb 6 karakter" });
    }
    const hash = await hashPassword(req.body.password);
    await storage.resetUserPassword(parseInt(req.params.id), hash);
    res.json({ ok: true });
  });

  // Felhasználó törlése
  app.delete("/api/admin/users/:id", requireSuperAdmin, async (req, res) => {
    await storage.deleteUser(parseInt(req.params.id));
    res.json({ ok: true });
  });

  return httpServer;
}
