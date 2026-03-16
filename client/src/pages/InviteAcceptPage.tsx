import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, User, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { setAuthData } from "@/lib/auth";

interface Props {
  token: string;
  onSuccess: () => void;
}

export default function InviteAcceptPage({ token, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/invite/accept", { token, name, password });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hiba tortent");
      return data;
    },
    onSuccess: (data) => {
      if (data.token) {
        setAuthData(data.token, data.user, data.company);
      }
      setDone(true);
      setTimeout(() => onSuccess(), 2000);
    },
    onError: (e: any) => {
      setError(e.message || "Nem sikerult elfogadni a meghivot");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Nev megadasa kotelezo");
    if (password.length < 6) return setError("A jelszo legalabb 6 karakter legyen");
    if (password !== password2) return setError("A ket jelszo nem egyezik");
    mutation.mutate();
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-white border border-border rounded-2xl shadow-sm p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-green-600" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">Sikeres csatlakozas!</h2>
          <p className="text-sm text-muted-foreground">Atiranyitunk a fooldara...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-white border border-border rounded-2xl shadow-sm p-8 max-w-sm w-full">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <svg aria-label="ProdAI logo" width="36" height="36" viewBox="0 0 32 32" fill="none">
            <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" stroke="hsl(206 70% 40%)" strokeWidth="2" fill="hsl(206 70% 40% / 0.10)" />
            <line x1="10" y1="16" x2="22" y2="16" stroke="hsl(206 70% 40%)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="16" y1="10" x2="16" y2="22" stroke="hsl(206 70% 40%)" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="16" cy="16" r="2.5" fill="hsl(206 70% 40%)" />
          </svg>
          <div>
            <p className="font-bold text-foreground text-base leading-none">ProdAI</p>
            <p className="text-xs text-muted-foreground">Meghivo elfogadasa</p>
          </div>
        </div>

        <h1 className="text-lg font-bold text-foreground mb-1">Csatlakozas a csapathoz</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Adj meg egy nevet es jelszoat a fiokhoz
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm font-medium">Teljes nev</Label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="name"
                data-testid="input-invite-name"
                className="pl-9"
                placeholder="Pl. Kovács János"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium">Jelszo</Label>
            <div className="relative">
              <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                data-testid="input-invite-password"
                type="password"
                className="pl-9"
                placeholder="Min. 6 karakter"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password2" className="text-sm font-medium">Jelszo megerositese</Label>
            <div className="relative">
              <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password2"
                data-testid="input-invite-password2"
                type="password"
                className="pl-9"
                placeholder="Jelszo megint"
                value={password2}
                onChange={e => setPassword2(e.target.value)}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending}
            data-testid="button-accept-invite"
          >
            {mutation.isPending ? (
              <><Loader2 size={15} className="animate-spin mr-2" /> Csatlakozas...</>
            ) : "Csatlakozas"}
          </Button>
        </form>
      </div>
    </div>
  );
}
