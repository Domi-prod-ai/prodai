import { useState } from "react";
import { CheckCircle2, Zap, ClipboardList, Cpu, BarChart2, X, ArrowRight } from "lucide-react";

interface Props {
  userName: string;
  companyName: string;
  onClose: () => void;
}

const STEPS = [
  {
    icon: <Cpu size={22} className="text-blue-500" />,
    title: "Adj hozzá gépeket",
    desc: "Vidd fel a gyártósoraidat a Gépek menüpontban — típus, kapacitás, zárási erő.",
  },
  {
    icon: <ClipboardList size={22} className="text-amber-500" />,
    title: "Importálj rendeléseket",
    desc: "PDF-ből vagy kézzel add meg a vevői rendeléseket a Rendelés import oldalon.",
  },
  {
    icon: <Zap size={22} className="text-purple-500" />,
    title: "AI auto-ütemezés",
    desc: "A főoldalon nyomd meg az \"AI auto-ütemezés\" gombot — a rendszer automatikusan beosztja a gyártást.",
  },
  {
    icon: <BarChart2 size={22} className="text-green-500" />,
    title: "Kövesd az eredményeket",
    desc: "Gantt nézet, riportok és AI javaslatok segítenek folyamatosan optimalizálni.",
  },
];

export default function WelcomeModal({ userName, companyName, onClose }: Props) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Fejléc */}
        <div style={{ background: "hsl(206,70%,40%)" }} className="px-6 pt-6 pb-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Bezárás"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={22} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-lg leading-tight">Üdvözlünk, {userName}!</div>
              <div className="text-blue-100 text-sm">{companyName} — ProdAI fiók létrehozva</div>
            </div>
          </div>
        </div>

        {/* Tartalom */}
        <div className="px-6 py-5">
          {!isLast ? (
            <>
              <p className="text-sm text-muted-foreground mb-4 font-medium">
                Hogyan indulj el? — {step + 1}/{STEPS.length}. lépés
              </p>

              {/* Progress dots */}
              <div className="flex gap-1.5 mb-5">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 rounded-full flex-1 transition-all duration-300"
                    style={{ background: i <= step ? "hsl(206,70%,40%)" : "#e2e8f0" }}
                  />
                ))}
              </div>

              {/* Aktuális lépés */}
              <div className="bg-slate-50 rounded-xl p-4 flex items-start gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-white border border-border flex items-center justify-center flex-shrink-0 shadow-sm">
                  {STEPS[step].icon}
                </div>
                <div>
                  <div className="font-semibold text-slate-800 text-sm mb-1">{STEPS[step].title}</div>
                  <div className="text-slate-500 text-sm leading-relaxed">{STEPS[step].desc}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {step > 0 && (
                  <button
                    onClick={() => setStep(s => s - 1)}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                  >
                    Vissza
                  </button>
                )}
                <button
                  onClick={() => setStep(s => s + 1)}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition hover:opacity-90"
                  style={{ background: "hsl(206,70%,40%)" }}
                >
                  {step < STEPS.length - 1 ? "Következő" : "Befejezés"}
                  <ArrowRight size={15} />
                </button>
              </div>
            </>
          ) : (
            /* Utolsó képernyő */
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={28} className="text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 mb-1">Minden készen áll!</h2>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                A ProdAI AI motorja készen áll a termelés optimalizálásra.<br />
                Kezdd el gépek és rendelések felvételével.
              </p>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl text-white text-sm font-bold transition hover:opacity-90"
                style={{ background: "hsl(206,70%,40%)" }}
              >
                Kezdjük el a munkát!
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
