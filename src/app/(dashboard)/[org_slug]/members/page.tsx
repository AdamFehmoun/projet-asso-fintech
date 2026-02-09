import { createClient } from "@/lib/supabase-server";
import { updateMemberStatus } from "./actions";
import { Check, X, Shield, User } from "lucide-react";

// 1. On définit params comme une Promise (Obligatoire Next 15)
export default async function MembersPage({ 
  params 
}: { 
  params: Promise<{ org_slug: string }> 
}) {
  const supabase = await createClient();
  
  // 2. ON UTILISE AWAIT ICI (C'est ça qui manquait)
  const { org_slug } = await params;

  // 3. Récupérer l'ID de l'asso
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("slug", org_slug)
    .single();

  // Si org est null, c'est que le slug dans l'URL ne matche pas la BDD
  if (orgError || !org) {
    return (
      <div className="p-8 text-red-500 bg-red-50 rounded-lg border border-red-200">
        <h2 className="font-bold">Organisation introuvable</h2>
        <p className="text-sm">Le slug <strong>{org_slug}</strong> n'existe pas dans la base de données.</p>
      </div>
    );
  }

  // 4. Récupérer les membres
  const { data: members } = await supabase
    .from("members")
    .select(`
      id,
      role,
      status,
      created_at,
      profiles ( full_name, email )
    `)
    .eq("organization_id", org.id)
    .order('created_at', { ascending: false });

  const pendingMembers = members?.filter(m => m.status === 'pending') || [];
  const activeMembers = members?.filter(m => m.status === 'active') || [];

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6 text-slate-900">Équipe - {org.name}</h1>

      {/* SECTION 1 : DEMANDES EN ATTENTE */}
      {pendingMembers.length > 0 && (
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-amber-200 bg-amber-100/50 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <h2 className="font-semibold text-amber-900">Demandes en attente ({pendingMembers.length})</h2>
          </div>
          <div className="divide-y divide-amber-200/50">
            {pendingMembers.map((member) => (
              <div key={member.id} className="p-4 flex items-center justify-between">
                <div>
                  {/* @ts-ignore */}
                  <p className="font-medium text-slate-900">{member.profiles?.full_name || "Sans nom"}</p>
                  {/* @ts-ignore */}
                  <p className="text-sm text-slate-500">{member.profiles?.email}</p>
                </div>
                <div className="flex gap-2">
                  <form action={async () => {
                    "use server";
                    await updateMemberStatus(member.id, 'active', org_slug);
                  }}>
                    <button className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition">
                      <Check className="w-5 h-5" />
                    </button>
                  </form>
                  <form action={async () => {
                    "use server";
                    await updateMemberStatus(member.id, 'rejected', org_slug);
                  }}>
                    <button className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition">
                      <X className="w-5 h-5" />
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 2 : MEMBRES ACTIFS */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Membre</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Rôle</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Date d'arrivée</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeMembers.map((member) => (
              <tr key={member.id} className="hover:bg-slate-50 transition">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                       {/* @ts-ignore */}
                      <p className="font-medium text-slate-900">{member.profiles?.full_name}</p>
                       {/* @ts-ignore */}
                      <p className="text-xs text-slate-500">{member.profiles?.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    member.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {member.role === 'admin' && <Shield className="w-3 h-3" />}
                    {member.role === 'admin' ? 'Administrateur' : 'Membre'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500 text-right" suppressHydrationWarning>
                  {new Date(member.created_at).toLocaleDateString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}