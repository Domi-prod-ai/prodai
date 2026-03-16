import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, UserPlus, Mail, Shield, Clock, CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

const ROLE_HU: Record<string, string> = {
  admin: "Admin",
  user: "Felhasznalo",
  superadmin: "Superadmin",
};
const ROLE_COLOR: Record<string, string> = {
  admin: "bg-blue-100 text-blue-700",
  user: "bg-gray-100 text-gray-700",
  superadmin: "bg-purple-100 text-purple-700",
};

export default function TeamPage() {
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");

  const { data: teamRaw, isLoading, isError } = useQuery<TeamMember[] | null>({ queryKey: ["/api/team"] });
  const team: TeamMember[] = Array.isArray(teamRaw) ? teamRaw : [];

  const inviteMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/invite", { email });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Meghivo elkulvde", description: data.message || "Az email sikeresen elment." });
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/team"] });
    },
    onError: (e: any) => {
      toast({ title: "Hiba", description: e.message || "Nem sikerult elkulvdeni a meghivot.", variant: "destructive" });
    },
  });

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    inviteMutation.mutate(inviteEmail.trim());
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Users size={20} className="text-primary" /> Csapattagok
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Hivj meg kollégákat a céges fiókba, kezeld a csapatot
        </p>
      </div>

      {/* Meghívó küldése */}
      <div className="bg-white border border-border rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
          <UserPlus size={15} className="text-primary" /> Kolléga meghívása
        </h2>
        <form onSubmit={handleInvite} className="flex gap-2">
          <Input
            type="email"
            placeholder="kollegaja@ceg.hu"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            className="flex-1"
            data-testid="input-invite-email"
          />
          <Button
            type="submit"
            disabled={inviteMutation.isPending || !inviteEmail.trim()}
            className="gap-2"
            data-testid="button-send-invite"
          >
            {inviteMutation.isPending
              ? <Loader2 size={14} className="animate-spin" />
              : <Send size={14} />}
            Meghivo kuldese
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          A kolléga emailben kap egy meghívó linket (48 óráig érvényes).
        </p>
      </div>

      {/* Csapattagok listája */}
      <div className="bg-white border border-border rounded-xl shadow-sm p-5">
        <h2 className="font-semibold text-sm text-foreground flex items-center gap-2 mb-4">
          <Users size={15} className="text-primary" /> Csapattagok ({team.length})
        </h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className="animate-spin text-primary" />
          </div>
        ) : team.length === 0 ? (
          <div className="text-center py-10">
            <Users size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Még nincs csapattag</p>
            <p className="text-xs text-muted-foreground mt-1">Hivj meg kollégákat fentebb!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {team.map((member) => (
              <div
                key={member.id}
                data-testid={`row-team-${member.id}`}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">
                    {member.name ? member.name[0].toUpperCase() : "?"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{member.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                    <Mail size={10} /> {member.email}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLOR[member.role] ?? "bg-gray-100 text-gray-700"}`}>
                    <Shield size={9} className="inline mr-1" />
                    {ROLE_HU[member.role] ?? member.role}
                  </span>
                  {member.createdAt && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(member.createdAt).toLocaleDateString("hu-HU")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Infó */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <h3 className="font-semibold text-sm text-blue-800 flex items-center gap-2 mb-2">
          <CheckCircle2 size={14} /> Hogyan mukodik a meghivo?
        </h3>
        <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
          <li>Beird a kolléga email-jét és kattints a "Meghívó küldése" gombra</li>
          <li>A kolléga kap egy emailt meghívó linkkel (48 óra érvényesség)</li>
          <li>A linken keresztül regisztrál és automatikusan csatlakozik a cégedhez</li>
          <li>Megjelenik itt a csapattag listában</li>
        </ol>
      </div>
    </div>
  );
}
