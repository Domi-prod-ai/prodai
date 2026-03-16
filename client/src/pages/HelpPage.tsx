import { useState } from "react";
import {
  BookOpen, Search, ChevronDown, ChevronRight, Brain, Package, Cpu,
  ClipboardList, CalendarDays, LayoutDashboard, PackageSearch, Lightbulb,
  CheckCircle2, AlertTriangle, Info, Zap, FileText, Upload, Plus,
  ArrowRight, Star
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Article {
  id: string;
  title: string;
  category: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  tags: string[];
}

// ─── Segéd komponensek ────────────────────────────────────────────────────────

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <CheckCircle2 size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
      <Lightbulb size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-blue-700">{children}</p>
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
      <AlertTriangle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-amber-700">{children}</p>
    </div>
  );
}

// ─── Cikkek adatai ────────────────────────────────────────────────────────────

const articles: Article[] = [
  {
    id: "dashboard",
    title: "Dashboard – Áttekintés oldal",
    category: "Navigáció",
    icon: <LayoutDashboard size={15} />,
    tags: ["dashboard", "áttekintés", "kpi", "gép állapot", "ai javaslat"],
    content: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>Az Áttekintés oldal a gyártás aktuális állapotát mutatja egyetlen képernyőn.</p>
        <StepList steps={[
          `A felső KPI kártyák mutatják az online gépek számát, az átlagos kihasználtságot, az aktív rendelések számát és a függőben lévő AI javaslatokat.`,
          `A "Gép állapot" panel minden gépet felsorol a jelenlegi kihasználtsággal és státusszal (online / karbantartás / offline).`,
          `Az "AI javaslatok" panelen az AI figyelmeztetései jelennek meg. A "Megoldva" gombra kattintva archiválhatók.`,
          `Az "AI auto-ütemezés" gombbal az összes rendelést automatikusan ütemezi az AI a szabad gépkapacitásokra.`,
        ]} />
        <Tip>Ha a KPI-kártya piros nyilat mutat, az AI észlelt egy kritikus eltérést — nézd meg az AI javaslatokat.</Tip>
      </div>
    ),
  },
  {
    id: "import-manual",
    title: "Rendelés felvétele – Kézi import + AI elemzés",
    category: "Rendelés import",
    icon: <Brain size={15} />,
    tags: ["rendelés import", "ai elemzés", "kézi", "gép javaslat", "gyártás indítás"],
    content: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>A kézi import segítségével egyetlen rendelést vihetsz fel, az AI pedig automatikusan megkeresi a legjobb szabad gépet.</p>
        <StepList steps={[
          `Nyisd meg a "Rendelés import" menüpontot (bal oldali sávon, kék AI badge-dzsel jelölve).`,
          `Maradj a "Kézi import + AI elemzés" fülön.`,
          `Töltsd ki a mezőket: Rendelésszám, Vevő neve, Termék (legördülőből), Mennyiség, Határidő, Prioritás.`,
          `Kattints az "AI elemzés indítása" gombra — az AI kiértékeli az összes gép szabad kapacitását.`,
          `A javaslatlistából válaszd ki a neked megfelelő gépet (a legmagasabb pontozású a legjobb).`,
          `Kattints az "Elfogadom – Gyártás indítása" gombra. A rendelés bekerül az ütemtervbe.`,
          `Opcionálisan letöltheted a tervet .txt vagy .csv formátumban.`,
        ]} />
        <Warn>Ha nincs termék a legördülőben, először add hozzá a terméket a Termékek menüpontban.</Warn>
        <Tip>A Sürgős prioritással feladott rendelések magasabb pontszámot kapnak az AI-tól, így hamarabb kerülnek a legjobb gépre.</Tip>
      </div>
    ),
  },
  {
    id: "import-pdf",
    title: "Rendelés felvétele – PDF import",
    category: "Rendelés import",
    icon: <FileText size={15} />,
    tags: ["pdf import", "fájl feltöltés", "automatikus felismerés", "rendelés"],
    content: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>Ha a vevőtől PDF formátumú rendeléslistát kaptál, az AI kinyeri belőle az adatokat.</p>
        <StepList steps={[
          `Nyisd meg a "Rendelés import" menüpontot, majd válts a "PDF import" fülre.`,
          `Kattints a "PDF kiválasztása" gombra, és töltsd fel a fájlt (max. 10 MB, .pdf formátum).`,
          `Az AI elemzi a PDF szövegét és megkeresi a rendelésszámokat, cikkszámokat, mennyiségeket és határidőket.`,
          `A felismert rendelések táblázatban jelennek meg. Ha egy sor sárga figyelmeztetést mutat, a cikkszám nem egyezett egyik termékkel sem.`,
          `Kattints egy sor "Import" gombjára, vagy a "Mind importálása" gombra az összes egyszerre való felviteléhez.`,
        ]} />
        <Warn>A PDF-nek szöveges tartalmat kell tartalmaznia (nem szkennelt képet). Ha az automatikus felismerés sikertelen, a nyers szöveg megjelenik — másolhatod át kézzel.</Warn>
      </div>
    ),
  },
  {
    id: "orders",
    title: "Rendelések kezelése",
    category: "Rendelések",
    icon: <ClipboardList size={15} />,
    tags: ["rendelések", "státusz", "szerkesztés", "törlés", "prioritás", "szűrő"],
    content: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>A Rendelések oldalon áttekintheted és kezelheted az összes rendelést.</p>
        <StepList steps={[
          `A "Lista" fülön látod az összes rendelést. A felső keresőben rendelésszámra vagy vevőre kereshetsz.`,
          `A prioritás chipek (Sürgős / Magas / Normál / Alacsony) szűrőként is működnek — kattints rájuk.`,
          `Az egyes sorok végén lévő "Szerkeszt" gombra kattintva a harmadik "Szerkesztés" fülre kerülsz, ahol módosíthatod az adatokat.`,
          `A "Töröl" gombbal véglegesen eltávolíthatod a rendelést.`,
          `A státusz legördülő menüből közvetlenül a listából módosíthatod az állapotot (függőben / tervezett / gyártás alatt / kész / törölve).`,
          `Új rendelés felviteléhez használd az "Új rendelés" fület, vagy a "Rendelés import" menüpontot az AI gépelemzéssel.`,
        ]} />
        <Tip>A KPI kártyák (Sürgős / Aktív / Kész) szintén szűrőként működnek a listán.</Tip>
      </div>
    ),
  },
  {
    id: "products",
    title: "Termékek kezelése",
    category: "Termékek",
    icon: <Package size={15} />,
    tags: ["termékek", "cikkszám", "sku", "cikktörzs", "csv import", "külső adatbázis"],
    content: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>A Termékek oldal az összes gyártható terméket (cikktörzset) tartalmazza.</p>
        <StepList steps={[
          `A "Lista" fülön böngészd a meglévő termékeket. Kereshetsz cikkszámra és névre.`,
          `Új termék felviteléhez menj az "Új termék" fülre. Kötelező mezők: Megnevezés, Cikkszám (SKU), Ciklusidő (mp), Kapacitás (db/óra).`,
          `A "CSV import" fülön több terméket is feltölthetsz egyszerre táblázatból másolva.`,
          `A "Külső adatbázis" fülön saját CSV fájlt tölthetsz fel rugalmas oszlopleképezéssel — jelöld meg, melyik oszlop melyik mezőnek felel meg.`,
          `Termék törlése: a lista sorvégén lévő kuka ikonra kattints.`,
        ]} />
        <Warn>Ha egy rendeléshez nincs érvényes termék rendelve, az AI elemzés nem tud gépet javasolni.</Warn>
      </div>
    ),
  },
  {
    id: "machines",
    title: "Gépek kezelése",
    category: "Gépek",
    icon: <Cpu size={15} />,
    tags: ["gépek", "kapacitás", "karbantartás", "státusz", "csv", "aktiválás"],
    content: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>A Gépek oldal az összes gyártóberendezést kezeli.</p>
        <StepList steps={[
          `A "Lista" fülön minden gép látható a jelenlegi státuszával és kihasználtságával.`,
          `Az "Aktivál", "Karbantartás", "Offline" gombok azonnal átállítják a gép státuszát.`,
          `Szerkesztéshez kattints a ceruza ikonra — a "Gép szerkesztése" fülre kerülsz, ahol módosíthatod a nevet, típust, kapacitást.`,
          `Új gép hozzáadásához menj az "Új gép" fülre. Kötelező mezők: Megnevezés, Típus, Kapacitás/óra, Kihasználtság %.`,
          `A "CSV import" fülön több gépet is feltölthetsz egyszerre.`,
          `Gép törlése: a lista sorvégén lévő kuka ikonra kattints.`,
        ]} />
        <Tip>Az Online státuszú, alacsony kihasználtságú gépek kerülnek az AI javaslatlistájának elejére.</Tip>
      </div>
    ),
  },
  {
    id: "gantt",
    title: "Gantt ütemterv olvasása",
    category: "Gantt ütemterv",
    icon: <CalendarDays size={15} />,
    tags: ["gantt", "ütemterv", "idővonal", "feladatok", "gép"],
    content: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>A Gantt nézet az összes gyártási feladatot időrendben, gépenként csoportosítva mutatja.</p>
        <StepList steps={[
          `Minden vízszintes sor egy gépet jelöl.`,
          `A színes sávok az egyes gyártási feladatokat reprezentálják — a sáv hossza az előre jelzett gyártási időt mutatja.`,
          `Az AI auto-ütemezés gombra kattintva (Dashboard) az AI az összes rendelést ütemezi be a szabad időablakokba.`,
          `Ha egy sáv piros szélű, a feladat kockáztatja a határidő elmulasztását.`,
        ]} />
        <Tip>Ha üres a Gantt nézet, menj a Dashboardra és nyomd meg az AI auto-ütemezés gombot.</Tip>
      </div>
    ),
  },
  {
    id: "faq-no-machines",
    title: "Miért nem javasol az AI gépet?",
    category: "Gyakori kérdések",
    icon: <AlertTriangle size={15} />,
    tags: ["ai", "hiba", "nincs javaslat", "gép", "termék"],
    content: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>Az AI gépelemzés csak akkor tud javaslatot adni, ha az alábbi feltételek teljesülnek:</p>
        <CheckList items={[
          `Van legalább egy Online státuszú gép a Gépek listában.`,
          `A kiválasztott terméknek van érvényes Ciklusideje (mp) és Kapacitása (db/óra).`,
          `A rendeléshez ki van választva egy termék.`,
        ]} />
        <p>Ha ezek teljesülnek és az AI mégis hibát jelez, ellenőrizd, hogy a határidő nem a múltban van-e.</p>
      </div>
    ),
  },
  {
    id: "faq-white-screen",
    title: "Fehér képernyő / az oldal lefagy",
    category: "Gyakori kérdések",
    icon: <AlertTriangle size={15} />,
    tags: ["hiba", "fehér képernyő", "lefagy", "crash"],
    content: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>Ha az oldal fehér lesz és nem reagál:</p>
        <StepList steps={[
          `Nyomj Ctrl+Shift+J (Chrome) / F12 billentyűt a fejlesztői konzol megnyitásához — a hibaüzenet ott látható.`,
          `Frissítsd az oldalt (F5) — az in-memory adatok visszaállnak az alapértelmezett demo adatokra.`,
          `Ha a Rendelés import oldalon fehéredett el az AI elemzés közben: ez egy ismert hiba volt, amely ki lett javítva (v9). Frissíts.`,
        ]} />
      </div>
    ),
  },
  {
    id: "faq-save-error",
    title: "Hiba a mentéssel – üzenet jelenik meg",
    category: "Gyakori kérdések",
    icon: <AlertTriangle size={15} />,
    tags: ["mentési hiba", "hiba", "gép mentés", "szám"],
    content: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>Ha mentéskor hibás üzenet jelenik meg:</p>
        <CheckList items={[
          `Ellenőrizd, hogy a szám mezők (kapacitás, kihasználtság %) valóban számot tartalmaznak, nem szöveget.`,
          `A kihasználtság értéke 0–100 között kell legyen.`,
          `A ciklusidő és kapacitás mezők nem lehetnek üresek.`,
        ]} />
      </div>
    ),
  },
  {
    id: "faq-data-lost",
    title: "Elvesznek az adatok frissítéskor?",
    category: "Gyakori kérdések",
    icon: <Info size={15} />,
    tags: ["adatok", "mentés", "frissítés", "adatbázis"],
    content: (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>A ProdAI jelenlegi verziója <strong>in-memory</strong> (memóriában tárolt) adatbázist használ. Ez azt jelenti:</p>
        <CheckList items={[
          `Az oldal frissítésekor az adatok visszaállnak az alapértelmezett demo adatokra.`,
          `Bezárás / szerver újraindítás után az egyéni módosítások elvesznek.`,
          `Ez az állapot az egyetemi projekt jelenlegi fázisára vonatkozik — terv szerint valós adatbázis (PostgreSQL) kerül be egy későbbi verzióban.`,
        ]} />
        <Tip>Exportáld a gyártási tervet .csv vagy .txt formátumban a Rendelés import elfogadás lépésnél, hogy megőrizd az eredményt.</Tip>
      </div>
    ),
  },
];

// ─── Gyorslinkek ─────────────────────────────────────────────────────────────

const quickLinks = [
  { label: "Első rendelés felvétele", id: "import-manual", color: "bg-blue-50 border-blue-100 text-blue-700" },
  { label: "PDF rendelés importálása", id: "import-pdf", color: "bg-purple-50 border-purple-100 text-purple-700" },
  { label: "Gép hozzáadása", id: "machines", color: "bg-green-50 border-green-100 text-green-700" },
  { label: "Elvesznek az adatok?", id: "faq-data-lost", color: "bg-amber-50 border-amber-100 text-amber-700" },
];

// ─── Accordion vezérelt cikk ──────────────────────────────────────────────────

function ArticleControlled({
  article,
  forceOpen,
  onOpen,
}: {
  article: Article;
  forceOpen: boolean;
  onOpen: () => void;
}) {
  const open = forceOpen;
  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${open ? "border-primary/30 shadow-sm" : "border-border"}`}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors"
        onClick={onOpen}
      >
        <span className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${open ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          {article.icon}
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{article.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{article.category}</p>
        </div>
        {open ? <ChevronDown size={15} className="text-muted-foreground" /> : <ChevronRight size={15} className="text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border/50 bg-white">
          {article.content}
        </div>
      )}
    </div>
  );
}

// ─── Fő oldal ────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [openArticle, setOpenArticle] = useState<string | null>(null);

  const categories = [...new Set(articles.map(a => a.category))];

  const filtered = articles.filter(a => {
    const q = query.toLowerCase();
    const matchQ = !q || a.title.toLowerCase().includes(q) || a.tags.some(t => t.includes(q));
    const matchCat = !activeCategory || a.category === activeCategory;
    return matchQ && matchCat;
  });

  function scrollTo(id: string) {
    setOpenArticle(id);
    setQuery("");
    setActiveCategory(null);
    setTimeout(() => {
      document.getElementById(`article-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      {/* Fejléc */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BookOpen size={20} className="text-primary" /> Súgó &amp; Útmutató
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Minden funkcióhoz lépésről-lépésre útmutató és válaszok a leggyakoribb kérdésekre.
        </p>
      </div>

      {/* Keresősáv */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          className="w-full border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={`Keresés a súgóban... (pl. "rendelés", "gép", "pdf")`}
          value={query}
          onChange={e => setQuery(e.target.value)}
          data-testid="input-help-search"
        />
      </div>

      {/* Gyorslinkek – csak ha nincs aktív keresés */}
      {!query && !activeCategory && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Star size={11} /> Gyorslinkek
          </p>
          <div className="grid grid-cols-2 gap-2">
            {quickLinks.map(ql => (
              <button
                key={ql.id}
                onClick={() => scrollTo(ql.id)}
                className={`flex items-center gap-2 border rounded-lg px-3 py-2.5 text-xs font-medium text-left transition-all hover:opacity-80 ${ql.color}`}
              >
                <ArrowRight size={12} className="flex-shrink-0" />
                {ql.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Kategória chipek */}
      {!query && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${!activeCategory ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-foreground/30"}`}
          >
            Minden
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${activeCategory === cat ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-foreground/30"}`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Cikkek */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Nincs találat</p>
          <p className="text-xs mt-1">Próbálj más kulcsszót (pl. "importálás", "hiba", "gép")</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(article => (
            <div key={article.id} id={`article-${article.id}`}>
              <ArticleControlled
                article={article}
                forceOpen={openArticle === article.id}
                onOpen={() => setOpenArticle(article.id === openArticle ? null : article.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Footer tipp */}
      <div className="bg-muted/40 border border-border rounded-xl p-4 flex gap-3">
        <Zap size={16} className="text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">Nem találod a választ?</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            A ProdAI egy aktívan fejlesztett projekt. Ha elakadsz, frissítsd az oldalt (F5), vagy nézd meg a Gyakori kérdések kategóriát.
          </p>
        </div>
      </div>
    </div>
  );
}
