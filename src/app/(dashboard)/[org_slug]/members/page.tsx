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
  owner:     { label: "Owner",       className: "bg-amber-100 text-amber-800",   icon: <Crown    className="w-3 h-3" /> },
  admin:     { label: "Admin",       className: "bg-purple-100 text-purple-800", icon: <Shield   className="w-3 h-3" /> },
  tresorier: { label: "Trésorier",   className: "bg-emerald-100 text-emerald-800", icon: <Landmark className="w-3 h-3" /> },
  membre:    { label: "Membre",      className: "bg-slate-100 text-slate-600",   icon: <User     className="w-3 h-3" /> },
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
      <div className="p-8 text-red-500 bg-red-50 rounded-lg border border-red-200">
        <h2 className="font-bold">Organisation introuvable</h2>
        <p className="text-sm">
          Le slug <strong>{org_slug}</strong> n'existe pas dans la base de données.
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
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6 text-slate-900">Équipe — {org.name}</h1>

      {/* DEMANDES EN ATTENTE */}
      {pendingMembers.length > 0 && (
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-amber-200 bg-amber-100/50 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <h2 className="font-semibold text-amber-900">
              Demandes en attente ({pendingMembers.length})
            </h2>
          </div>
          <div className="divide-y divide-amber-200/50">
            {pendingMembers.map((member) => {
              const profile = getProfile(member.profiles);
              return (
                <div key={member.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">
                      {profile?.full_name ?? "Sans nom"}
                    </p>
                    <p className="text-sm text-slate-500">{profile?.email ?? "—"}</p>
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
                        className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition"
                        aria-label="Accepter"
                      >
                        <Check className="w-5 h-5" />
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
                        className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                        aria-label="Refuser"
                      >
                        <X className="w-5 h-5" />
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
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Membre</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Rôle</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">
                Date d'arrivée
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeMembers.map((member) => {
              const profile = getProfile(member.profiles);
              const roleConfig = ROLE_CONFIG[member.role] ?? ROLE_CONFIG.membre;
              return (
                <tr key={member.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">
                          {profile?.full_name ?? "—"}
                        </p>
                        <p className="text-xs text-slate-500">{profile?.email ?? "—"}</p>
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
                    className="px-6 py-4 text-sm text-slate-500 text-right"
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