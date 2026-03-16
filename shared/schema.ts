import { pgTable, text, integer, timestamp, real, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Termékek ────────────────────────────────────────────────────────────────
export const products = pgTable("products", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  sku: text("sku").notNull(),           // termék kód / cikkszám
  unit: text("unit").notNull().default("db"),
  cycleTimeMinutes: integer("cycle_time_minutes").notNull().default(60),
  color: text("color").notNull().default("#4f98a3"),
  // Bővített spec mezők
  material: text("material").default(""),          // anyag (pl. ABS, PP, PA66)
  weight: real("weight").default(0),               // tömeg (gramm)
  machineType: text("machine_type").default(""),   // melyik gép típushoz illik
  notes: text("notes").default(""),
});

export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// ─── Gépek / Munkaállomások ───────────────────────────────────────────────────
export const machines = pgTable("machines", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  capacityPerHour: real("capacity_per_hour").notNull().default(10),
  status: text("status").notNull().default("online"), // online | maintenance | offline
  utilization: real("utilization").notNull().default(0),
  // Bővített spec mezők (fröccsöntő ipar)
  clampingForce: real("clamping_force").default(0),   // befogóerő (tonna)
  shotVolume: real("shot_volume").default(0),          // lövéstérfogat (cm³)
  screwDiameter: real("screw_diameter").default(0),    // csigaátmérő (mm)
  materials: text("materials").default(""),            // kompatibilis anyagok (vesszővel elválasztva)
  specNotes: text("spec_notes").default(""),           // egyéb megjegyzés
  manufacturer: text("manufacturer").default(""),      // gyártó
  yearOfManufacture: integer("year_of_manufacture").default(0),
});

export const insertMachineSchema = createInsertSchema(machines).omit({ id: true });
export type InsertMachine = z.infer<typeof insertMachineSchema>;
export type Machine = typeof machines.$inferSelect;

// ─── Rendelések ───────────────────────────────────────────────────────────────
export const orders = pgTable("orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderNumber: text("order_number").notNull(),
  productId: integer("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  priority: text("priority").notNull().default("normal"), // urgent | high | normal | low
  status: text("status").notNull().default("pending"),    // pending | planned | in_progress | done
  dueDate: text("due_date").notNull(),
  notes: text("notes").default(""),
  customer: text("customer").default(""),                 // vevő neve
});

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// ─── Termelési feladatok (Gantt sorok) ────────────────────────────────────────
export const tasks = pgTable("tasks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderId: integer("order_id").notNull(),
  machineId: integer("machine_id").notNull(),
  productId: integer("product_id").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  quantity: integer("quantity").notNull(),
  status: text("status").notNull().default("planned"), // planned | in_progress | done | delayed
  aiOptimized: boolean("ai_optimized").notNull().default(false),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// ─── AI javaslatok ────────────────────────────────────────────────────────────
export const aiSuggestions = pgTable("ai_suggestions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  type: text("type").notNull(),        // bottleneck | optimization | warning | info
  title: text("title").notNull(),
  description: text("description").notNull(),
  impact: text("impact").notNull(),    // high | medium | low
  resolved: boolean("resolved").notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const insertAiSuggestionSchema = createInsertSchema(aiSuggestions).omit({ id: true });
export type InsertAiSuggestion = z.infer<typeof insertAiSuggestionSchema>;
export type AiSuggestion = typeof aiSuggestions.$inferSelect;

// ─── Szerszámok / Formák ──────────────────────────────────────────────────────
export const molds = pgTable("molds", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  moldNumber: text("mold_number").notNull(),        // szerszámszám
  productId: integer("product_id").default(0),      // melyik termékhez
  machineId: integer("machine_id").default(0),      // melyik gépre tervezett
  material: text("material").default(""),           // acél típus pl. P20, H13
  cavities: integer("cavities").notNull().default(1), // fészekszám
  status: text("status").notNull().default("active"), // active | maintenance | retired
  location: text("location").default(""),           // tárolási hely
  totalShots: integer("total_shots").notNull().default(0),       // összes lövés
  maxShots: integer("max_shots").notNull().default(500000),      // max lövés karbantartásig
  lastMaintenanceDate: text("last_maintenance_date").default(""),
  nextMaintenanceDate: text("next_maintenance_date").default(""),
  notes: text("notes").default(""),
  manufacturer: text("manufacturer").default(""),
  yearOfManufacture: integer("year_of_manufacture").default(0),
  weight: real("weight").default(0),               // szerszám tömeg (kg)
});

export const insertMoldSchema = createInsertSchema(molds).omit({ id: true });
export type InsertMold = z.infer<typeof insertMoldSchema>;
export type Mold = typeof molds.$inferSelect;

// ─── Karbantartási naplók ────────────────────────────────────────────────────
export const maintenanceLogs = pgTable("maintenance_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  machineId: integer("machine_id").default(0),
  moldId: integer("mold_id").default(0),            // ha formához tartozik
  type: text("type").notNull(),                     // preventive | corrective | inspection
  title: text("title").notNull(),
  description: text("description").default(""),
  status: text("status").notNull().default("scheduled"), // scheduled | in_progress | done | overdue
  scheduledDate: text("scheduled_date").notNull(),
  completedDate: text("completed_date").default(""),
  technicianName: text("technician_name").default(""),
  durationHours: real("duration_hours").default(0),
  cost: real("cost").default(0),
  notes: text("notes").default(""),
  createdAt: text("created_at").notNull(),
});

export const insertMaintenanceLogSchema = createInsertSchema(maintenanceLogs).omit({ id: true });
export type InsertMaintenanceLog = z.infer<typeof insertMaintenanceLogSchema>;
export type MaintenanceLog = typeof maintenanceLogs.$inferSelect;
