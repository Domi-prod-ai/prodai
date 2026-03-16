import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Building2, Users, BarChart3, Trash2, KeyRound, ShieldCheck, RefreshCw, LogOut, Package, ClipboardList, Cpu, Wrench } from "lucide-react";

type Tab = "overview" | "companies" | "users";

export default function AdminPage({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [newPassword, setNewPassword] = useState<Record<number, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const qc = useQueryClient();

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
    queryFn: () => apiRequest("GET", "/api/admin/stats").then(r => r.json()),
    refetchInterval: 10000,
  });

  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/companies"],
    queryFn: () => apiRequest("GET", "/api/admin/companies").then(r => r.json()),
    enabled: tab === "companies" || tab === "overview",
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
    queryFn: () => apiRequest("GET", "/api/admin/users").then(r => r.json()),
    enabled: tab === "users" || tab === "overview",
  });

  const deleteCompany = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/companies/${id}`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/companies"] }); qc.invalidateQueries({ queryKey: ["/api/admin/users"] }); setConfirmDelete(null); },
  });

  const deleteUser = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/users/${id}`).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/users"] }),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) =>
      apiRequest("PATCH", `/api/admin/users/${id}/role`, { role }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/users"] }),
  });

  const resetPassword = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      apiRequest("PATCH", `/api/admin/users/${id}/password`, { password }).then(r => r.json()),
    onSuccess: (_, { id }) => { setNewPassword(p => ({ ...p, [id]: "" })); alert("Jelszó sikeresen visszaállítva!"); },
  });

  const statCards = [
    { label: "Cégek", value: stats?.companies ?? "-", icon: Building2, color: "blue" },
    { label: "Felhasználók", value: stats?.users ?? "-", icon: Users, color: "violet" },
    { label: "Rendelések", value: stats?.orders ?? "-", icon: ClipboardList, color: "amber" },
    { label: "Termékek", value: stats?.products ?? "-", icon: Package, color: "green" },
    { label: "Gépek", value: stats?.machines ?? "-", icon: Cpu, color: "red" },
    { label: "Szerszámok", value: stats?.molds ?? "-", icon: Wrench, color: "slate" },
  ];

  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    violet: "bg-violet-50 text-violet-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Topbar */}
      <header className="bg-[hsl(206,70%,40%)] text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <ShieldCheck size={22} />
          <div>
            <h1 className="font-bold text-lg leading-tight">ProdAI Admin Panel</h1>
            <p className="text-blue-200 text-xs">Superadmin vezérlőpult</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => qc.invalidateQueries()}
            className="flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition"
          >
            <RefreshCw size={14} /> Frissítés
          </button>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition"
          >
            <LogOut size={14} /> Vissza az appba
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-slate-200">
          {([
            { id: "overview", label: "Áttekintés", icon: BarChart3 },
            { id: "companies", label: "Cégek", icon: Building2 },
            { id: "users", label: "Felhasználók", icon: Users },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition ${
                tab === id
                  ? "border-[hsl(206,70%,40%)] text-[hsl(206,70%,40%)]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="space-y-8">
            {/* Stat kártyák */}
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Rendszer összesítő</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {statCards.map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 text-center">
                    <div className={`w-10 h-10 rounded-lg ${colorMap[color]} flex items-center justify-center mx-auto mb-2`}>
                      <Icon size={18} />
                    </div>
                    <div className="text-2xl font-bold text-slate-800">{value}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Legutóbbi cégek */}
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Legutóbb regisztrált cégek</h2>
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-3 text-slate-500 font-medium">Cégnév</th>
                      <th className="text-left px-5 py-3 text-slate-500 font-medium">Felhasználók</th>
                      <th className="text-left px-5 py-3 text-slate-500 font-medium">Regisztrálva</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.slice(0, 5).map((c: any) => (
                      <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                        <td className="px-5 py-3 font-medium text-slate-800">{c.name}</td>
                        <td className="px-5 py-3 text-slate-600">{c.userCount} fő</td>
                        <td className="px-5 py-3 text-slate-500 text-xs">{c.createdAt ? new Date(c.createdAt).toLocaleDateString("hu-HU") : "-"}</td>
                      </tr>
                    ))}
                    {companies.length === 0 && (
                      <tr><td colSpan={3} className="px-5 py-8 text-center text-slate-400">Még nincs regisztrált cég</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Legutóbbi felhasználók */}
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Legutóbb regisztrált felhasználók</h2>
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-5 py-3 text-slate-500 font-medium">Név</th>
                      <th className="text-left px-5 py-3 text-slate-500 font-medium">Email</th>
                      <th className="text-left px-5 py-3 text-slate-500 font-medium">Cég</th>
                      <th className="text-left px-5 py-3 text-slate-500 font-medium">Szerepkör</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.slice(0, 5).map((u: any) => (
                      <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                        <td className="px-5 py-3 font-medium text-slate-800">{u.name}</td>
                        <td className="px-5 py-3 text-slate-600">{u.email}</td>
                        <td className="px-5 py-3 text-slate-500">{u.companyName}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.role === "superadmin" ? "bg-purple-100 text-purple-700" : u.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                            {u.role}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">Még nincs regisztrált felhasználó</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* COMPANIES */}
        {tab === "companies" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Összes cég ({companies.length})</h2>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 text-slate-500 font-medium">ID</th>
                    <th className="text-left px-5 py-3 text-slate-500 font-medium">Cégnév</th>
                    <th className="text-left px-5 py-3 text-slate-500 font-medium">Slug</th>
                    <th className="text-left px-5 py-3 text-slate-500 font-medium">Felhasználók</th>
                    <th className="text-left px-5 py-3 text-slate-500 font-medium">Regisztrálva</th>
                    <th className="text-left px-5 py-3 text-slate-500 font-medium">Műveletek</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c: any) => (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                      <td className="px-5 py-3 text-slate-400 font-mono text-xs">#{c.id}</td>
                      <td className="px-5 py-3 font-semibold text-slate-800">{c.name}</td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-500">{c.slug}</td>
                      <td className="px-5 py-3">
                        <span className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full font-medium">{c.userCount} fő</span>
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{c.createdAt ? new Date(c.createdAt).toLocaleString("hu-HU") : "-"}</td>
                      <td className="px-5 py-3">
                        {confirmDelete === c.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-red-600 font-medium">Biztosan törlöd?</span>
                            <button onClick={() => deleteCompany.mutate(c.id)} className="text-xs bg-red-600 text-white px-2 py-1 rounded-lg hover:bg-red-700">Igen</button>
                            <button onClick={() => setConfirmDelete(null)} className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-300">Nem</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(c.id)}
                            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition"
                          >
                            <Trash2 size={12} /> Törlés
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {companies.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">Még nincs regisztrált cég</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* USERS */}
        {tab === "users" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Összes felhasználó ({users.length})</h2>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Felhasználó</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Cég</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Regisztrálva</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Utoljára aktív</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Szerepkör</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Jelszó visszaállítás</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Törlés</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => (
                    <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">{u.name?.[0]?.toUpperCase()}</span>
                          </div>
                          <div>
                            <div className="font-medium text-slate-800">{u.name}</div>
                            <div className="text-xs text-slate-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{u.companyName}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{u.createdAt ? new Date(u.createdAt).toLocaleString("hu-HU") : "-"}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {u.lastLogin ? (
                          <span className="text-green-700 font-medium">{new Date(u.lastLogin).toLocaleString("hu-HU")}</span>
                        ) : (
                          <span className="text-slate-400">Még nem lépett be</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={e => updateRole.mutate({ id: u.id, role: e.target.value })}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                        >
                          <option value="admin">admin</option>
                          <option value="user">user</option>
                          <option value="superadmin">superadmin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            placeholder="Új jelszó..."
                            value={newPassword[u.id] || ""}
                            onChange={e => setNewPassword(p => ({ ...p, [u.id]: e.target.value }))}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 w-28 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                          <button
                            onClick={() => newPassword[u.id] && resetPassword.mutate({ id: u.id, password: newPassword[u.id] })}
                            disabled={!newPassword[u.id]}
                            className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1.5 rounded-lg hover:bg-amber-100 disabled:opacity-40 transition"
                          >
                            <KeyRound size={11} /> Visszaáll.
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => { if (confirm(`Törlöd: ${u.name}?`)) deleteUser.mutate(u.id); }}
                          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition"
                        >
                          <Trash2 size={12} /> Törlés
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">Még nincs regisztrált felhasználó</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
