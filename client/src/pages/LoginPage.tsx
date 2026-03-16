import { useState } from "react";
import { saveAuth } from "@/lib/auth";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

interface Props {
  onSuccess: () => void;
  onGoRegister: () => void;
}

export default function LoginPage({ onSuccess, onGoRegister }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Hib\u00e1s email vagy jelsz\u00f3"); setLoading(false); return; }
      saveAuth(data.token, data.user, data.company);
      onSuccess();
    } catch {
      setError("A szerver nem el\u00e9rhet\u0151. K\u00e9rjük, pr\u00f3b\u00e1ld \u00fajra.");
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
          <p className="text-slate-500 text-sm">AI vez\u00e9relt termel\u00e9s tervez\u0151</p>
        </div>

        {/* K\u00e1rtya */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-xl font-semibold text-slate-800 mb-1">Bejelentkezés</h1>
          <p className="text-slate-500 text-sm mb-6">\u00dcDv\u00f6zl\u00fcnk! K\u00e9rj\u00fck, l\u00e9pj be.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email c\u00edm</label>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Jelsz\u00f3</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
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
              {loading ? "Bejelentkezés..." : "Bejelentkezés"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            M\u00e9g nincs fi\u00f3kod?{" "}
            <button onClick={onGoRegister} className="text-[hsl(206,70%,40%)] font-medium hover:underline">
              Regisztr\u00e1ci\u00f3
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          by <span className="font-medium">ProdAI</span> \u00b7 Poly\u00e1k Dominik \u00b7 SZE 2026
        </p>
      </div>
    </div>
  );
}
