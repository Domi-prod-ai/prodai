import { useState } from "react";
import { saveAuth } from "@/lib/auth";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

interface Props {
  onSuccess: () => void;
  onGoLogin: () => void;
}

export default function RegisterPage({ onSuccess, onGoLogin }: Props) {
  const [companyName, setCompanyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== password2) { setError("A két jelszó nem egyezik"); return; }
    if (password.length < 6) { setError("A jelszó legalább 6 karakter legyen"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Hiba tortent"); return; }
      saveAuth(data.token, data.user, data.company);
      onSuccess();
    } catch {
      setError("Szerver nem elerheto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[hsl(206,70%,40%)] flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-slate-800">ProdAI</span>
          </div>
          <p className="text-slate-500 text-sm">AI vezérelt termelés tervező</p>
        </div>

        {/* Kártya */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-xl font-semibold text-slate-800 mb-1">Fiók létrehozása</h1>
          <p className="text-slate-500 text-sm mb-6">Regisztrálj és kezdd el a tervezést!</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cégnév</label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="pl. Kovács Műanyag Kft."
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teljes neved</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="pl. Kovács János"
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email cím</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="pelda@ceg.hu"
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Jelszó</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Legalább 6 karakter"
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Jelszó megerősítése</label>
              <input
                type="password"
                value={password2}
                onChange={e => setPassword2(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[hsl(206,70%,40%)] hover:bg-[hsl(206,70%,35%)] text-white font-medium py-2.5 rounded-xl transition disabled:opacity-60"
            >
              {loading ? "Regisztráció..." : "Regisztráció"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            Már van fiókod?{" "}
            <button onClick={onGoLogin} className="text-[hsl(206,70%,40%)] font-medium hover:underline">
              Bejelentkezés
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          by <span className="font-medium">ProdAI</span> · Polyák Dominik · SZE 2026
        </p>
      </div>
    </div>
  );
}
