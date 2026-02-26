import { createClient } from "@/lib/supabase-server";
import { updateMemberStatus } from "./actions";
import { Check, X, Shield, User, Crown, Landmark } from "lucide-react";

// Types explicites pour les jointures Supabase
type Profile = {
  full_name: string | null;
  email: string | null;
};

type Member = {
  id: string;
  role: string;
  status: string;
  created_at: string;
  profiles: Profile | Profile[] | null;
};

// Helper : Supabase peut retourner un objet ou un tableau selon la relation
function getProfile(profiles: Profile | Profile[] | null): Profile | null {
  if (!profiles) return null;
  return Array.isArray(profiles) ? profiles[0] ?? null : profiles;
}

const ROLE_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  owner:     { label: "Owner",     className: "bg-amber-500/10 text-amber-400 border border-amber-500/20",     icon: <Crown    className="w-3 h-3" /> },
  admin:     { label: "Admin",     className: "bg-purple-500/10 text-purple-400 border border-purple-500/20", icon: <Shield   className="w-3 h-3" /> },
  tresorier: { label: "Trésorier", className: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20", icon: <Landmark className="w-3 h-3" /> },
  membre:    { label: "Membre",    className: "bg-zinc-800 text-zinc-400 border border-zinc-700",              icon: <User     className="w-3 h-3" /> },
};

export default async function MembersPage({
  params,
}: {
  params: Promise<{ org_slug: string }>;
}) {
  const supabase = await createClient();
  const { org_slug } = await params;

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("slug", org_slug)
    .single();

  if (orgError || !org) {
    return (
      <div className="p-8 text-red-400 bg-red-500/10 rounded-xl border border-red-500/20">
        <h2 className="font-bold">Organisation introuvable</h2>
        <p className="text-sm text-red-400/70">
          Le slug <strong>{org_slug}</strong> n&apos;existe pas dans la base de données.
        </p>
      </div>
    );
  }

  const { data: rawMembers } = await supabase
    .from("members")
    .select(`
      id,
      role,
      status,
      created_at,
      profiles ( full_name, email )
    `)
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  const members = (rawMembers ?? []) as Member[];
  const pendingMembers = members.filter((m) => m.status === "pending");
  const activeMembers  = members.filter((m) => m.status === "active");

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-zinc-100">Équipe — {org.name}</h1>

      {/* DEMANDES EN ATTENTE */}
      {pendingMembers.length > 0 && (
        <div className="mb-6 bg-amber-500/5 border border-amber-500/20 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-500/20 bg-amber-500/10 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="font-semibold text-amber-300 text-sm">
              Demandes en attente ({pendingMembers.length})
            </h2>
          </div>
          <div className="divide-y divide-amber-500/10">
            {pendingMembers.map((member) => {
              const profile = getProfile(member.profiles);
              return (
                <div key={member.id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-zinc-100 text-sm">
                      {profile?.full_name ?? "Sans nom"}
                    </p>
                    <p className="text-xs text-zinc-500">{profile?.email ?? "—"}</p>
                  </div>
                  <div className="flex gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await updateMemberStatus(member.id, "active", org_slug);
                      }}
                    >
                      <button
                        type="submit"
                        className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 border border-emerald-500/20 transition"
                        aria-label="Accepter"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await updateMemberStatus(member.id, "rejected", org_slug);
                      }}
                    >
                      <button
                        type="submit"
                        className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 border border-red-500/20 transition"
                        aria-label="Refuser"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MEMBRES ACTIFS */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-left">
          <thead className="border-b border-zinc-800">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Membre</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Rôle</th>
              <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">
                Date d&apos;arrivée
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {activeMembers.map((member) => {
              const profile = getProfile(member.profiles);
              const roleConfig = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.membre;
              return (
                <tr key={member.id} className="hover:bg-zinc-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium text-zinc-100 text-sm">
                          {profile?.full_name ?? "—"}
                        </p>
                        <p className="text-xs text-zinc-500">{profile?.email ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${roleConfig.className}`}
                    >
                      {roleConfig.icon}
                      {roleConfig.label}
                    </span>
                  </td>
                  <td
                    className="px-6 py-4 text-sm text-zinc-500 text-right"
                    suppressHydrationWarning
                  >
                    {new Date(member.created_at).toLocaleDateString("fr-FR")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
