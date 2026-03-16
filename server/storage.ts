import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import {
  type Product, type InsertProduct,
  type Machine, type InsertMachine,
  type Order, type InsertOrder,
  type Task, type InsertTask,
  type AiSuggestion, type InsertAiSuggestion,
  type Mold, type InsertMold,
  type MaintenanceLog, type InsertMaintenanceLog,
} from "@shared/schema";

// ─── Auth típusok ────────────────────────────────────────────────────────────
export interface Company {
  id: number;
  name: string;
  slug: string;
  createdAt: string;
}

export interface User {
  id: number;
  companyId: number;
  email: string;
  passwordHash: string;
  name: string;
  role: string; // admin | user
  createdAt: string;
  lastLogin: string;
}

export interface IStorage {
  // Auth
  createCompany(name: string, slug: string): Promise<Company>;
  getCompanyBySlug(slug: string): Promise<Company | undefined>;
  getCompanyById(id: number): Promise<Company | undefined>;
  createUser(companyId: number, email: string, passwordHash: string, name: string, role: string): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;

  // Admin
  getAllCompanies(): Promise<Company[]>;
  getAllUsers(): Promise<User[]>;
  deleteCompany(id: number): Promise<void>;
  deleteUser(id: number): Promise<void>;
  updateUserRole(id: number, role: string): Promise<User>;
  resetUserPassword(id: number, passwordHash: string): Promise<void>;
  updateLastLogin(userId: number): Promise<void>;
  getSystemStats(): Promise<{ companies: number; users: number; orders: number; products: number; machines: number; molds: number; }>;

  getProducts(companyId: number): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductBySku(sku: string, companyId: number): Promise<Product | undefined>;
  createProduct(p: InsertProduct, companyId: number): Promise<Product>;
  updateProduct(id: number, data: Partial<Product>): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  bulkCreateProducts(items: InsertProduct[], companyId: number): Promise<Product[]>;

  getMachines(companyId: number): Promise<Machine[]>;
  getMachine(id: number): Promise<Machine | undefined>;
  createMachine(m: InsertMachine, companyId: number): Promise<Machine>;
  updateMachine(id: number, data: Partial<Machine>): Promise<Machine>;
  deleteMachine(id: number): Promise<void>;

  getOrders(companyId: number): Promise<Order[]>;
  getOrder(id: number): Promise<Order | undefined>;
  createOrder(o: InsertOrder, companyId: number): Promise<Order>;
  updateOrder(id: number, data: Partial<Order>): Promise<Order>;
  deleteOrder(id: number): Promise<void>;

  getTasks(companyId: number): Promise<Task[]>;
  getTasksByOrder(orderId: number): Promise<Task[]>;
  createTask(t: InsertTask, companyId: number): Promise<Task>;
  updateTask(id: number, data: Partial<Task>): Promise<Task>;
  deleteTask(id: number): Promise<void>;
  clearTasks(companyId: number): Promise<void>;

  getAiSuggestions(companyId: number): Promise<AiSuggestion[]>;
  createAiSuggestion(s: InsertAiSuggestion, companyId: number): Promise<AiSuggestion>;
  resolveAiSuggestion(id: number): Promise<AiSuggestion>;

  getMolds(companyId: number): Promise<Mold[]>;
  getMold(id: number): Promise<Mold | undefined>;
  createMold(m: InsertMold, companyId: number): Promise<Mold>;
  updateMold(id: number, data: Partial<Mold>): Promise<Mold>;
  deleteMold(id: number): Promise<void>;

  getMaintenanceLogs(companyId: number): Promise<MaintenanceLog[]>;
  getMaintenanceLogsByMachine(machineId: number): Promise<MaintenanceLog[]>;
  createMaintenanceLog(m: InsertMaintenanceLog, companyId: number): Promise<MaintenanceLog>;
  updateMaintenanceLog(id: number, data: Partial<MaintenanceLog>): Promise<MaintenanceLog>;
  deleteMaintenanceLog(id: number): Promise<void>;

  getSettings(): Promise<AppSettings>;
  updateSettings(data: Partial<AppSettings>): Promise<AppSettings>;
}

export interface ShiftConfig {
  enabled: boolean;
  name: string;
  start: string;
  end: string;
}

export interface AppSettings {
  companyName: string;
  plantName: string;
  shiftCount: number;
  shifts: ShiftConfig[];
  workingDaysPerWeek: number;
  shiftStart: string;
  shiftEnd: string;
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

const DEFAULT_SETTINGS: AppSettings = {
  companyName: "ProdAI Kft.",
  plantName: "1. Telephely",
  shiftCount: 2,
  shifts: [
    { enabled: true,  name: "Nappal",  start: "06:00", end: "14:00" },
    { enabled: true,  name: "Delutan", start: "14:00", end: "22:00" },
    { enabled: false, name: "Ejszaka", start: "22:00", end: "06:00" },
  ],
  shiftStart: "06:00",
  shiftEnd: "22:00",
  workingDaysPerWeek: 5,
  aiPriorityWeight: 60,
  aiAutoSchedule: true,
  aiAlertThreshold: 85,
  aiDeadlineBufferDays: 1,
  language: "hu",
  darkMode: false,
  dateFormat: "YYYY-MM-DD",
  notifyHighUtilization: true,
  notifyDeadlineRisk: true,
  notifyMaintenance: true,
  utilizationAlertLevel: 90,
  currency: "HUF",
  timezone: "Europe/Budapest",
  defaultPriority: "normal",
};

// ─── sql.js alapú SQLite (100% JS, nincs natív modul) ─────────────────────────
class SqliteStorage implements IStorage {
  private db!: SqlJsDatabase;
  private dbPath: string;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;

  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(process.cwd(), "data", "prodai.db");
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    // WASM fajl keresese: eloszor az exe mellol, aztan node_modules-bol
    const exeDir = path.dirname(process.execPath);
    const candidates = [
      path.join(process.cwd(), "dist", "sql-wasm.wasm"),
      path.join(process.cwd(), "sql-wasm.wasm"),
      path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
      path.join(exeDir, "sql-wasm.wasm"),
      path.join(exeDir, "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
    ];
    let wasmPath = "";
    for (const c of candidates) {
      if (fs.existsSync(c)) { wasmPath = c; break; }
    }
    if (!wasmPath) {
      try {
        wasmPath = path.join(path.dirname(require.resolve("sql.js")), "..", "dist", "sql-wasm.wasm");
      } catch {}
    }
    console.log("WASM eleresi ut:", wasmPath);

    const SQL = await initSqlJs({
      locateFile: () => wasmPath,
    });

    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }

    this.createTables();
    this.seedIfEmpty();
    this.initialized = true;
    console.log("SQLite (sql.js) adatbazis betoltve:", this.dbPath);
  }

  private persistDb() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      try {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
        fs.writeFileSync(this.dbPath, buffer);
      } catch (e) {
        console.error("DB mentes hiba:", e);
      }
    }, 200);
  }

  private exec(sql: string) {
    this.db.run(sql);
  }

  // Egy sor visszaadása (SELECT ... WHERE id=?)
  private getOne(sql: string, params: any[] = []): any | undefined {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }

  // Több sor visszaadása
  private getAll(sql: string, params: any[] = []): any[] {
    const results: any[] = [];
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  // INSERT/UPDATE/DELETE + utolsó rowid visszaadása
  private run(sql: string, params: any[] = []): number {
    const stmt = this.db.prepare(sql);
    stmt.run(params);
    stmt.free();
    const lastId = this.db.exec("SELECT last_insert_rowid() as id");
    this.persistDb();
    if (lastId.length > 0 && lastId[0].values.length > 0) {
      return lastId[0].values[0][0] as number;
    }
    return 0;
  }

  private createTables() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL DEFAULT 1,
        name TEXT NOT NULL,
        sku TEXT NOT NULL,
        unit TEXT NOT NULL DEFAULT 'db',
        cycle_time_minutes INTEGER NOT NULL DEFAULT 60,
        color TEXT NOT NULL DEFAULT '#4f98a3',
        material TEXT DEFAULT '',
        weight REAL DEFAULT 0,
        machine_type TEXT DEFAULT '',
        notes TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS machines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL DEFAULT 1,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        capacity_per_hour REAL NOT NULL DEFAULT 10,
        status TEXT NOT NULL DEFAULT 'online',
        utilization REAL NOT NULL DEFAULT 0,
        clamping_force REAL DEFAULT 0,
        shot_volume REAL DEFAULT 0,
        screw_diameter REAL DEFAULT 0,
        materials TEXT DEFAULT '',
        spec_notes TEXT DEFAULT '',
        manufacturer TEXT DEFAULT '',
        year_of_manufacture INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL DEFAULT 1,
        order_number TEXT NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        priority TEXT NOT NULL DEFAULT 'normal',
        status TEXT NOT NULL DEFAULT 'pending',
        due_date TEXT NOT NULL,
        notes TEXT DEFAULT '',
        customer TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL DEFAULT 1,
        order_id INTEGER NOT NULL,
        machine_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'planned',
        ai_optimized INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS ai_suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL DEFAULT 1,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        impact TEXT NOT NULL,
        resolved INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS molds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL DEFAULT 1,
        name TEXT NOT NULL,
        mold_number TEXT NOT NULL,
        product_id INTEGER DEFAULT 0,
        machine_id INTEGER DEFAULT 0,
        material TEXT DEFAULT '',
        cavities INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'active',
        location TEXT DEFAULT '',
        total_shots INTEGER NOT NULL DEFAULT 0,
        max_shots INTEGER NOT NULL DEFAULT 500000,
        last_maintenance_date TEXT DEFAULT '',
        next_maintenance_date TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        manufacturer TEXT DEFAULT '',
        year_of_manufacture INTEGER DEFAULT 0,
        weight REAL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS maintenance_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL DEFAULT 1,
        machine_id INTEGER DEFAULT 0,
        mold_id INTEGER DEFAULT 0,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'scheduled',
        scheduled_date TEXT NOT NULL,
        completed_date TEXT DEFAULT '',
        technician_name TEXT DEFAULT '',
        duration_hours REAL DEFAULT 0,
        cost REAL DEFAULT 0,
        notes TEXT DEFAULT '',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS invites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        invited_by INTEGER NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
    `);

    // ── Migration: last_login oszlop hozzaadasa users tablahoz ──────────────
    try {
      this.run("ALTER TABLE users ADD COLUMN last_login TEXT DEFAULT ''");
    } catch (_) { /* mar letezik */ }
  }

  private row2product(r: any): Product {
    return { id: r.id, name: r.name, sku: r.sku, unit: r.unit, cycleTimeMinutes: r.cycle_time_minutes,
      color: r.color, material: r.material, weight: r.weight, machineType: r.machine_type, notes: r.notes };
  }
  private row2machine(r: any): Machine {
    return { id: r.id, name: r.name, type: r.type, capacityPerHour: r.capacity_per_hour,
      status: r.status, utilization: r.utilization, clampingForce: r.clamping_force,
      shotVolume: r.shot_volume, screwDiameter: r.screw_diameter, materials: r.materials,
      specNotes: r.spec_notes, manufacturer: r.manufacturer, yearOfManufacture: r.year_of_manufacture };
  }
  private row2order(r: any): Order {
    return { id: r.id, orderNumber: r.order_number, productId: r.product_id, quantity: r.quantity,
      priority: r.priority, status: r.status, dueDate: r.due_date, notes: r.notes, customer: r.customer };
  }
  private row2task(r: any): Task {
    return { id: r.id, orderId: r.order_id, machineId: r.machine_id, productId: r.product_id,
      startTime: r.start_time, endTime: r.end_time, quantity: r.quantity, status: r.status,
      aiOptimized: r.ai_optimized === 1 };
  }
  private row2suggestion(r: any): AiSuggestion {
    return { id: r.id, type: r.type, title: r.title, description: r.description,
      impact: r.impact, resolved: r.resolved === 1, createdAt: r.created_at };
  }
  private row2mold(r: any): Mold {
    return { id: r.id, name: r.name, moldNumber: r.mold_number, productId: r.product_id,
      machineId: r.machine_id, material: r.material, cavities: r.cavities, status: r.status,
      location: r.location, totalShots: r.total_shots, maxShots: r.max_shots,
      lastMaintenanceDate: r.last_maintenance_date, nextMaintenanceDate: r.next_maintenance_date,
      notes: r.notes, manufacturer: r.manufacturer, yearOfManufacture: r.year_of_manufacture, weight: r.weight };
  }
  private row2maintenance(r: any): MaintenanceLog {
    return { id: r.id, machineId: r.machine_id, moldId: r.mold_id, type: r.type, title: r.title,
      description: r.description, status: r.status, scheduledDate: r.scheduled_date,
      completedDate: r.completed_date, technicianName: r.technician_name,
      durationHours: r.duration_hours, cost: r.cost, notes: r.notes, createdAt: r.created_at };
  }

  private seedDemoUserIfMissing() {
    // Demo ceg letrehozasa ha meg nem letezik
    const companyRow = this.getOne("SELECT id FROM companies WHERE slug=?", ["prodai-demo"]);
    let companyId: number;
    if (!companyRow) {
      const now = new Date().toISOString();
      companyId = this.run(
        `INSERT INTO companies (name, slug, created_at) VALUES (?,?,?)`,
        ["ProdAI Demo Kft.", "prodai-demo", now]
      );
    } else {
      companyId = companyRow.id;
    }

    // Demo user letrehozasa ha meg nem letezik
    const userRow = this.getOne("SELECT id FROM users WHERE LOWER(email)=LOWER(?)", ["demo@prodai.hu"]);
    if (!userRow) {
      const now = new Date().toISOString();
      const hash = bcrypt.hashSync("ProdAI2026!", 10);
      this.run(
        `INSERT INTO users (company_id, email, password_hash, name, role, created_at) VALUES (?,?,?,?,?,?)`,
        [companyId, "demo@prodai.hu", hash, "Poly\u00e1k Dominik", "admin", now]
      );
      console.log("Demo user letrehozva: demo@prodai.hu");
    }

    // fekete0410@gmail.com user letrehozasa ha meg nem letezik
    const adminRow = this.getOne("SELECT id FROM users WHERE LOWER(email)=LOWER(?)", ["fekete0410@gmail.com"]);
    if (!adminRow) {
      const now = new Date().toISOString();
      const hash = bcrypt.hashSync("ProdAI2026!", 10);
      this.run(
        `INSERT INTO users (company_id, email, password_hash, name, role, created_at) VALUES (?,?,?,?,?,?)`,
        [companyId, "fekete0410@gmail.com", hash, "Poly\u00e1k Dominik", "admin", now]
      );
      console.log("Admin user letrehozva: fekete0410@gmail.com");
    }
  }

  private seedIfEmpty() {
    // Demo user/ceg mindig legyen meg
    this.seedDemoUserIfMissing();

    // Demo ceg ID-jének lekérése
    const demoCompany = this.getOne("SELECT id FROM companies WHERE slug=?", ["prodai-demo"]);
    if (!demoCompany) return;
    const demoCId = demoCompany.id as number;

    // Csak akkor seed-elünk demo adatot, ha a demo cégnek még nincs terméke
    const res = this.db.exec(`SELECT COUNT(*) as n FROM products WHERE company_id=${demoCId}`);
    const count = res.length > 0 ? (res[0].values[0][0] as number) : 0;
    if (count > 0) return;

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    // Termékek — csak demo céghez
    [
      ["Aluminium alkatresz A1","ALU-A1","db",45,"#4f98a3","AlSi9Cu3",185,"CNC","BMW futomualkatresz"],
      ["Acel profil B2","ACL-B2","db",30,"#6daa45","S235JR",320,"Presszereles",""],
      ["Muanyag burkolat C3","MUA-C3","db",20,"#fdab43","ABS",45,"Froccsонtes","Bosch panel"],
      ["Osszeszerelesesi egyseg D4","OSZ-D4","db",90,"#a86fdf","Vegyes",680,"Osszeszerelesec","Audi A6 modul"],
    ].forEach(r => this.run(
      `INSERT INTO products (company_id,name,sku,unit,cycle_time_minutes,color,material,weight,machine_type,notes) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [demoCId, ...r]
    ));

    // Gépek — csak demo céghez
    [
      ["CNC Megmunkalo #1","CNC",12,"online",78,0,0,0,"Aluminium, Acel","Fanuc vezerlo, 5 tengelyes","Mazak",2019],
      ["CNC Megmunkalo #2","CNC",12,"online",91,0,0,0,"Aluminium, Acel, Titan","Siemens 840D vezerlo","DMG Mori",2021],
      ["Hesztelo Robot A","Hegesztes",8,"maintenance",0,0,0,0,"Acel, Rozsdamentes","MIG/MAG, erintesmentes erzekelo","KUKA",2018],
      ["Presszer #1","Presszereles",20,"online",55,250,850,60,"ABS, PP, PA66, PE","Hidraulikus, ketfele szerszam","Engel",2020],
      ["Osszeszereleo sor","Osszeszerelesec",6,"online",83,0,0,0,"Vegyes","Kezi + felautomata, 4 allomas","Sajat gyartas",2017],
      ["Minoseg-ellenorzos","QA",30,"online",42,0,0,0,"Minden","CMM merogep, vizualis ellenorzes","Zeiss",2022],
    ].forEach(r => this.run(
      `INSERT INTO machines (company_id,name,type,capacity_per_hour,status,utilization,clamping_force,shot_volume,screw_diameter,materials,spec_notes,manufacturer,year_of_manufacture) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [demoCId, ...r]
    ));

    // Rendelések — csak demo céghez (termék ID-k a demo cég termékeire mutatnak)
    const demoProds = this.getAll(`SELECT id FROM products WHERE company_id=? ORDER BY id`, [demoCId]);
    if (demoProds.length >= 4) {
      const [p1,p2,p3,p4] = demoProds.map((p:any)=>p.id);
      [
        ["ORD-2026-001",p1,120,"urgent","in_progress",today,"","BMW Kft."],
        ["ORD-2026-002",p2,80,"high","planned",today,"","Bosch Hungary"],
        ["ORD-2026-003",p3,200,"normal","pending",today,"",""],
        ["ORD-2026-004",p4,40,"high","planned",today,"","Audi Hungaria"],
        ["ORD-2026-005",p1,60,"low","pending",today,"",""],
      ].forEach(r => this.run(
        `INSERT INTO orders (company_id,order_number,product_id,quantity,priority,status,due_date,notes,customer) VALUES (?,?,?,?,?,?,?,?,?)`,
        [demoCId, ...r]
      ));
    }

    // Feladatok — csak demo céghez
    const demoOrds = this.getAll(`SELECT id FROM orders WHERE company_id=? ORDER BY id`, [demoCId]);
    const demoMachs = this.getAll(`SELECT id FROM machines WHERE company_id=? ORDER BY id`, [demoCId]);
    if (demoOrds.length >= 5 && demoMachs.length >= 5 && demoProds.length >= 4) {
      const [o1,o2,o3,o4,o5] = demoOrds.map((o:any)=>o.id);
      const [m1,m2,,m4,m5] = demoMachs.map((m:any)=>m.id);
      const [p1,p2,p3,p4] = demoProds.map((p:any)=>p.id);
      [
        [o1,m1,p1,`${today}T08:00`,`${today}T12:00`,60,"in_progress",1],
        [o1,m2,p1,`${today}T10:00`,`${today}T14:30`,60,"planned",1],
        [o2,m4,p2,`${today}T08:00`,`${today}T10:00`,80,"in_progress",0],
        [o4,m5,p4,`${today}T09:00`,`${today}T15:40`,40,"planned",1],
        [o3,m4,p3,`${today}T13:00`,`${today}T17:00`,120,"planned",0],
      ].forEach(r => this.run(
        `INSERT INTO tasks (company_id,order_id,machine_id,product_id,start_time,end_time,quantity,status,ai_optimized) VALUES (?,?,?,?,?,?,?,?,?)`,
        [demoCId, ...r]
      ));
    }

    // AI javaslatok — csak demo céghez
    [
      ["bottleneck","Szuk keresztmetszet: CNC #2","A CNC Megmunkalo #2 kihasznaltsaga 91% -- 2 oran belul tuleterheles varhato.","high",0,now],
      ["optimization","Atallasi ido csokkentese","Az egymast utani utemezesevel 35 perc takaritthato meg.","medium",0,now],
      ["warning","Karbantartas: Hegeszto Robot A","A Hegeszto Robot A karbantartas alatt van. Hatarido veszelybe kerulhet.","high",0,now],
      ["info","Optimalis nap: hetfo","Az AI szerint hetfon 23%-kal magasabb hatekonysag erheto el.","low",0,now],
    ].forEach(r => this.run(
      `INSERT INTO ai_suggestions (company_id,type,title,description,impact,resolved,created_at) VALUES (?,?,?,?,?,?,?)`,
      [demoCId, ...r]
    ));

    // Szerszámok — csak demo céghez
    if (demoProds.length >= 4 && demoMachs.length >= 4) {
      const [p1,p2,p3,p4] = demoProds.map((p:any)=>p.id);
      const [m1,,,m4] = demoMachs.map((m:any)=>m.id);
      [
        ["BMW futommu forma A","FM-001",p1,m1,"P20",2,"active","A raktar - 3. polc",182400,500000,"2026-01-15","2026-06-15","2 feszkeses, hideg csatorna","Hasco",2021,480],
        ["Acel profil presforma","FM-002",p2,m4,"H13",4,"active","B raktar - 1. polc",310000,400000,"2025-11-20","2026-04-01","4 feszkeses, meleg csatorna","DME",2019,920],
        ["ABS burkolat forma","FM-003",p3,m4,"P20",1,"maintenance","Karbantarto muhely",495000,500000,"2026-03-10","2026-03-20","Elesites + polizalas alatt","Sajat gyartas",2018,320],
        ["Osszeszerelesesi egyseg forma","FM-004",p4,m1,"H13",1,"active","A raktar - 1. polc",95000,300000,"2025-09-05","2026-09-05","Komplex betetes szerszam","Hasco",2023,1100],
      ].forEach(r => this.run(
        `INSERT INTO molds (company_id,name,mold_number,product_id,machine_id,material,cavities,status,location,total_shots,max_shots,last_maintenance_date,next_maintenance_date,notes,manufacturer,year_of_manufacture,weight) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [demoCId, ...r]
      ));
    }

    // Karbantartási naplók — csak demo céghez
    if (demoMachs.length >= 5) {
      const [m1,m2,m3,m4,m5] = demoMachs.map((m:any)=>m.id);
      const demoMoldsList = this.getAll(`SELECT id FROM molds WHERE company_id=? ORDER BY id`, [demoCId]);
      const moldId3 = demoMoldsList.length >= 3 ? demoMoldsList[2].id : 0;
      [
        [m3,0,"corrective","Hegeszto Robot A - aramkor csere","Vezerloegyseg meghibasodas, aramkori lap csere szukseges.","in_progress",today,"","Kovacs Peter",8,85000,"",now],
        [m2,0,"preventive","CNC #2 - kenoanyag csere + beallitas","Negyedeveves PM: kenesi pontok, tengelyek beallitasa, szurOcsere.","scheduled",today,"","Nagy Imre",4,12000,"",now],
        [m4,moldId3,"preventive","Presszer #1 + FM-003 - teljes atvizsgalas","ABS burkolat forma elesites es presszer hidraulika ellenorzes.","in_progress",today,"","Toth Gabor",16,45000,"Forma polizalas folyamatban",now],
        [m1,0,"inspection","CNC #1 - eves felulvizsgalat","Eves biztonsagi es muszaki felulvizsgalat.","scheduled",today,"","",2,0,"",now],
        [m5,0,"preventive","Osszeszereleo sor - futoszalag karbantartas","Szijak, gorgek ellenorzese es zsarozasa.","done",today,today,"Varga Laszlo",3,8000,"Rendben elvegezve",now],
      ].forEach(r => this.run(
        `INSERT INTO maintenance_logs (company_id,machine_id,mold_id,type,title,description,status,scheduled_date,completed_date,technician_name,duration_hours,cost,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [demoCId, ...r]
      ));
    }
  }

  // ── Products ──
  async getProducts(companyId: number) { return this.getAll("SELECT * FROM products WHERE company_id=?", [companyId]).map(r => this.row2product(r)); }
  async getProduct(id: number) { const r = this.getOne("SELECT * FROM products WHERE id=?", [id]); return r ? this.row2product(r) : undefined; }
  async getProductBySku(sku: string, companyId: number) { const r = this.getOne("SELECT * FROM products WHERE LOWER(sku)=LOWER(?) AND company_id=?", [sku, companyId]); return r ? this.row2product(r) : undefined; }
  async createProduct(p: InsertProduct, companyId: number) {
    const id = this.run(`INSERT INTO products (company_id,name,sku,unit,cycle_time_minutes,color,material,weight,machine_type,notes) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [companyId, p.name, p.sku, p.unit??'db', p.cycleTimeMinutes??60, p.color??'#4f98a3', p.material??'', p.weight??0, p.machineType??'', p.notes??'']);
    return this.getProduct(id) as Promise<Product>;
  }
  async updateProduct(id: number, data: Partial<Product>) {
    const cur = await this.getProduct(id); if (!cur) throw new Error("Not found");
    const u = { ...cur, ...data };
    this.run(`UPDATE products SET name=?,sku=?,unit=?,cycle_time_minutes=?,color=?,material=?,weight=?,machine_type=?,notes=? WHERE id=?`,
      [u.name, u.sku, u.unit, u.cycleTimeMinutes, u.color, u.material, u.weight, u.machineType, u.notes, id]);
    return this.getProduct(id) as Promise<Product>;
  }
  async deleteProduct(id: number) { this.run("DELETE FROM products WHERE id=?", [id]); }
  async bulkCreateProducts(items: InsertProduct[], companyId: number) {
    const results: Product[] = [];
    for (const item of items) results.push(await this.createProduct(item, companyId));
    return results;
  }

  // ── Machines ──
  async getMachines(companyId: number) { return this.getAll("SELECT * FROM machines WHERE company_id=?", [companyId]).map(r => this.row2machine(r)); }
  async getMachine(id: number) { const r = this.getOne("SELECT * FROM machines WHERE id=?", [id]); return r ? this.row2machine(r) : undefined; }
  async createMachine(m: InsertMachine, companyId: number) {
    const id = this.run(`INSERT INTO machines (company_id,name,type,capacity_per_hour,status,utilization,clamping_force,shot_volume,screw_diameter,materials,spec_notes,manufacturer,year_of_manufacture) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [companyId, m.name, m.type, m.capacityPerHour??10, m.status??'online', m.utilization??0, m.clampingForce??0, m.shotVolume??0, m.screwDiameter??0, m.materials??'', m.specNotes??'', m.manufacturer??'', m.yearOfManufacture??0]);
    return this.getMachine(id) as Promise<Machine>;
  }
  async updateMachine(id: number, data: Partial<Machine>) {
    const cur = await this.getMachine(id); if (!cur) throw new Error("Not found");
    const u = { ...cur, ...data };
    this.run(`UPDATE machines SET name=?,type=?,capacity_per_hour=?,status=?,utilization=?,clamping_force=?,shot_volume=?,screw_diameter=?,materials=?,spec_notes=?,manufacturer=?,year_of_manufacture=? WHERE id=?`,
      [u.name, u.type, u.capacityPerHour, u.status, u.utilization, u.clampingForce, u.shotVolume, u.screwDiameter, u.materials, u.specNotes, u.manufacturer, u.yearOfManufacture, id]);
    return this.getMachine(id) as Promise<Machine>;
  }
  async deleteMachine(id: number) { this.run("DELETE FROM machines WHERE id=?", [id]); }

  // ── Orders ──
  async getOrders(companyId: number) { return this.getAll("SELECT * FROM orders WHERE company_id=?", [companyId]).map(r => this.row2order(r)); }
  async getOrder(id: number) { const r = this.getOne("SELECT * FROM orders WHERE id=?", [id]); return r ? this.row2order(r) : undefined; }
  async createOrder(o: InsertOrder, companyId: number) {
    const id = this.run(`INSERT INTO orders (company_id,order_number,product_id,quantity,priority,status,due_date,notes,customer) VALUES (?,?,?,?,?,?,?,?,?)`,
      [companyId, o.orderNumber, o.productId, o.quantity, o.priority??'normal', o.status??'pending', o.dueDate, o.notes??'', o.customer??'']);
    return this.getOrder(id) as Promise<Order>;
  }
  async updateOrder(id: number, data: Partial<Order>) {
    const cur = await this.getOrder(id); if (!cur) throw new Error("Not found");
    const u = { ...cur, ...data };
    this.run(`UPDATE orders SET order_number=?,product_id=?,quantity=?,priority=?,status=?,due_date=?,notes=?,customer=? WHERE id=?`,
      [u.orderNumber, u.productId, u.quantity, u.priority, u.status, u.dueDate, u.notes, u.customer, id]);
    return this.getOrder(id) as Promise<Order>;
  }
  async deleteOrder(id: number) { this.run("DELETE FROM orders WHERE id=?", [id]); }

  // ── Tasks ──
  async getTasks(companyId: number) { return this.getAll("SELECT * FROM tasks WHERE company_id=?", [companyId]).map(r => this.row2task(r)); }
  async getTasksByOrder(orderId: number) { return this.getAll("SELECT * FROM tasks WHERE order_id=?", [orderId]).map(r => this.row2task(r)); }
  async createTask(t: InsertTask, companyId: number) {
    const id = this.run(`INSERT INTO tasks (company_id,order_id,machine_id,product_id,start_time,end_time,quantity,status,ai_optimized) VALUES (?,?,?,?,?,?,?,?,?)`,
      [companyId, t.orderId, t.machineId, t.productId, t.startTime, t.endTime, t.quantity, t.status??'planned', t.aiOptimized?1:0]);
    return this.getTaskById(id) as Promise<Task>;
  }
  private getTaskById(id: number) { const r = this.getOne("SELECT * FROM tasks WHERE id=?", [id]); return r ? this.row2task(r) : undefined; }
  async updateTask(id: number, data: Partial<Task>) {
    const cur = this.getTaskById(id); if (!cur) throw new Error("Not found");
    const u = { ...cur, ...data };
    this.run(`UPDATE tasks SET order_id=?,machine_id=?,product_id=?,start_time=?,end_time=?,quantity=?,status=?,ai_optimized=? WHERE id=?`,
      [u.orderId, u.machineId, u.productId, u.startTime, u.endTime, u.quantity, u.status, u.aiOptimized?1:0, id]);
    return this.getTaskById(id) as Task;
  }
  async deleteTask(id: number) { this.run("DELETE FROM tasks WHERE id=?", [id]); }
  async clearTasks(companyId: number) { this.run("DELETE FROM tasks WHERE company_id=?", [companyId]); }

  // ── AI Suggestions ──
  async getAiSuggestions(companyId: number) { return this.getAll("SELECT * FROM ai_suggestions WHERE company_id=?", [companyId]).map(r => this.row2suggestion(r)); }
  async createAiSuggestion(s: InsertAiSuggestion, companyId: number) {
    const id = this.run(`INSERT INTO ai_suggestions (company_id,type,title,description,impact,resolved,created_at) VALUES (?,?,?,?,?,?,?)`,
      [companyId, s.type, s.title, s.description, s.impact, 0, s.createdAt]);
    const row = this.getOne("SELECT * FROM ai_suggestions WHERE id=?", [id]);
    return this.row2suggestion(row);
  }
  async resolveAiSuggestion(id: number) {
    this.run("UPDATE ai_suggestions SET resolved=1 WHERE id=?", [id]);
    const row = this.getOne("SELECT * FROM ai_suggestions WHERE id=?", [id]);
    if (!row) throw new Error("Not found");
    return this.row2suggestion(row);
  }

  // ── Molds ──
  async getMolds(companyId: number) { return this.getAll("SELECT * FROM molds WHERE company_id=?", [companyId]).map(r => this.row2mold(r)); }
  async getMold(id: number) { const r = this.getOne("SELECT * FROM molds WHERE id=?", [id]); return r ? this.row2mold(r) : undefined; }
  async createMold(m: InsertMold, companyId: number) {
    const id = this.run(`INSERT INTO molds (company_id,name,mold_number,product_id,machine_id,material,cavities,status,location,total_shots,max_shots,last_maintenance_date,next_maintenance_date,notes,manufacturer,year_of_manufacture,weight) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [companyId, m.name, m.moldNumber, m.productId??0, m.machineId??0, m.material??'', m.cavities??1, m.status??'active', m.location??'', m.totalShots??0, m.maxShots??500000, m.lastMaintenanceDate??'', m.nextMaintenanceDate??'', m.notes??'', m.manufacturer??'', m.yearOfManufacture??0, m.weight??0]);
    return this.getMold(id) as Promise<Mold>;
  }
  async updateMold(id: number, data: Partial<Mold>) {
    const cur = await this.getMold(id); if (!cur) throw new Error("Not found");
    const u = { ...cur, ...data };
    this.run(`UPDATE molds SET name=?,mold_number=?,product_id=?,machine_id=?,material=?,cavities=?,status=?,location=?,total_shots=?,max_shots=?,last_maintenance_date=?,next_maintenance_date=?,notes=?,manufacturer=?,year_of_manufacture=?,weight=? WHERE id=?`,
      [u.name, u.moldNumber, u.productId, u.machineId, u.material, u.cavities, u.status, u.location, u.totalShots, u.maxShots, u.lastMaintenanceDate, u.nextMaintenanceDate, u.notes, u.manufacturer, u.yearOfManufacture, u.weight, id]);
    return this.getMold(id) as Promise<Mold>;
  }
  async deleteMold(id: number) { this.run("DELETE FROM molds WHERE id=?", [id]); }

  // ── Maintenance ──
  async getMaintenanceLogs(companyId: number) { return this.getAll("SELECT * FROM maintenance_logs WHERE company_id=?", [companyId]).map(r => this.row2maintenance(r)); }
  async getMaintenanceLogsByMachine(machineId: number) { return this.getAll("SELECT * FROM maintenance_logs WHERE machine_id=?", [machineId]).map(r => this.row2maintenance(r)); }
  async createMaintenanceLog(m: InsertMaintenanceLog, companyId: number) {
    const id = this.run(`INSERT INTO maintenance_logs (company_id,machine_id,mold_id,type,title,description,status,scheduled_date,completed_date,technician_name,duration_hours,cost,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [companyId, m.machineId??0, m.moldId??0, m.type, m.title, m.description??'', m.status??'scheduled', m.scheduledDate, m.completedDate??'', m.technicianName??'', m.durationHours??0, m.cost??0, m.notes??'', m.createdAt]);
    const row = this.getOne("SELECT * FROM maintenance_logs WHERE id=?", [id]);
    return this.row2maintenance(row);
  }
  async updateMaintenanceLog(id: number, data: Partial<MaintenanceLog>) {
    const cur = this.getOne("SELECT * FROM maintenance_logs WHERE id=?", [id]);
    if (!cur) throw new Error("Not found");
    const u = { ...this.row2maintenance(cur), ...data };
    this.run(`UPDATE maintenance_logs SET machine_id=?,mold_id=?,type=?,title=?,description=?,status=?,scheduled_date=?,completed_date=?,technician_name=?,duration_hours=?,cost=?,notes=?,created_at=? WHERE id=?`,
      [u.machineId, u.moldId, u.type, u.title, u.description, u.status, u.scheduledDate, u.completedDate, u.technicianName, u.durationHours, u.cost, u.notes, u.createdAt, id]);
    const row = this.getOne("SELECT * FROM maintenance_logs WHERE id=?", [id]);
    return this.row2maintenance(row);
  }
  async deleteMaintenanceLog(id: number) { this.run("DELETE FROM maintenance_logs WHERE id=?", [id]); }

  // ── Auth ──
  async createCompany(name: string, slug: string): Promise<Company> {
    const now = new Date().toISOString();
    const id = this.run(`INSERT INTO companies (name, slug, created_at) VALUES (?,?,?)`, [name, slug, now]);
    return { id, name, slug, createdAt: now };
  }
  async getCompanyBySlug(slug: string): Promise<Company | undefined> {
    const r = this.getOne("SELECT * FROM companies WHERE slug=?", [slug]);
    if (!r) return undefined;
    return { id: r.id, name: r.name, slug: r.slug, createdAt: r.created_at };
  }
  async getCompanyById(id: number): Promise<Company | undefined> {
    const r = this.getOne("SELECT * FROM companies WHERE id=?", [id]);
    if (!r) return undefined;
    return { id: r.id, name: r.name, slug: r.slug, createdAt: r.created_at };
  }
  async createUser(companyId: number, email: string, passwordHash: string, name: string, role: string): Promise<User> {
    const now = new Date().toISOString();
    const id = this.run(`INSERT INTO users (company_id, email, password_hash, name, role, created_at) VALUES (?,?,?,?,?,?)`,
      [companyId, email, passwordHash, name, role, now]);
    return { id, companyId, email, passwordHash, name, role, createdAt: now };
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    const r = this.getOne("SELECT * FROM users WHERE LOWER(email)=LOWER(?)", [email]);
    if (!r) return undefined;
    return { id: r.id, companyId: r.company_id, email: r.email, passwordHash: r.password_hash, name: r.name, role: r.role, createdAt: r.created_at, lastLogin: r.last_login || "" };
  }
  async getUserById(id: number): Promise<User | undefined> {
    const r = this.getOne("SELECT * FROM users WHERE id=?", [id]);
    if (!r) return undefined;
    return { id: r.id, companyId: r.company_id, email: r.email, passwordHash: r.password_hash, name: r.name, role: r.role, createdAt: r.created_at, lastLogin: r.last_login || "" };
  }
  async updateLastLogin(userId: number): Promise<void> {
    this.run("UPDATE users SET last_login=? WHERE id=?", [new Date().toISOString(), userId]);
  }

  // ── Admin ──
  async getAllCompanies(): Promise<Company[]> {
    return this.getAll("SELECT * FROM companies ORDER BY id DESC").map((r: any) => ({ id: r.id, name: r.name, slug: r.slug, createdAt: r.created_at }));
  }
  async getAllUsers(): Promise<User[]> {
    return this.getAll("SELECT * FROM users ORDER BY id DESC").map((r: any) => ({ id: r.id, companyId: r.company_id, email: r.email, passwordHash: r.password_hash, name: r.name, role: r.role, createdAt: r.created_at, lastLogin: r.last_login || "" }));
  }
  async deleteCompany(id: number): Promise<void> {
    this.run("DELETE FROM users WHERE company_id=?", [id]);
    this.run("DELETE FROM companies WHERE id=?", [id]);
  }
  async deleteUser(id: number): Promise<void> {
    this.run("DELETE FROM users WHERE id=?", [id]);
  }
  async updateUserRole(id: number, role: string): Promise<User> {
    this.run("UPDATE users SET role=? WHERE id=?", [role, id]);
    return this.getUserById(id) as Promise<User>;
  }
  async resetUserPassword(id: number, passwordHash: string): Promise<void> {
    this.run("UPDATE users SET password_hash=? WHERE id=?", [passwordHash, id]);
  }
  async getSystemStats() {
    const count = (tbl: string) => {
      const r = this.db.exec(`SELECT COUNT(*) FROM ${tbl}`);
      return r.length > 0 ? (r[0].values[0][0] as number) : 0;
    };
    return {
      companies: count("companies"),
      users: count("users"),
      orders: count("orders"),
      products: count("products"),
      machines: count("machines"),
      molds: count("molds"),
    };
  }

  // ── Settings ──
  async getSettings(): Promise<AppSettings> {
    const row = this.getOne("SELECT data FROM settings WHERE id=1");
    if (!row) return { ...DEFAULT_SETTINGS };
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(row.data) }; }
    catch { return { ...DEFAULT_SETTINGS }; }
  }
  async updateSettings(data: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...data };
    this.run("INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)", [JSON.stringify(updated)]);
    return updated;
  }
}

// Singleton + async init wrapper
const storageInstance = new SqliteStorage();
let initPromise: Promise<void> | null = null;

function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = storageInstance.init();
  }
  return initPromise;
}

// Proxy: minden metódushívásnál biztosítja az inicializálást
export const storage: IStorage = new Proxy(storageInstance, {
  get(target: any, prop: string) {
    const value = target[prop];
    if (typeof value === "function" && prop !== "init") {
      return async (...args: any[]) => {
        await ensureInit();
        return value.apply(target, args);
      };
    }
    return value;
  }
}) as IStorage;
