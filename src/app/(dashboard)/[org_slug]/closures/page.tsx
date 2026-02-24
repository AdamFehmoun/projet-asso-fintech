// src/app/(dashboard)/[org_slug]/closures/page.tsx

import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Scale } from "lucide-react";
import { ClosuresClient } from "./closures-client";
import { getClosures } from "./actions";

export default async function ClosuresPage({
  params,
}: {
  params: Promise<{ org_slug: string }>;
}) {
  const { org_slug } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, fiscal_start")
    .eq("slug", org_slug)
    .single();

  if (!org) return <div className="p-8 text-red-500">Organisation introuvable</div>;

  const { data: membership } = await supabase
    .from("members")
    .select("role")
    .eq("user_id", user.id)
    .eq("organization_id", org.id)
    .eq("status", "active")
    .single();

  if (!membership) redirect(`/${org_slug}/budget`);

  const WRITE_ROLES = ["tresorier", "admin", "owner"];
  const canWrite = WRITE_ROLES.includes(membership.role);

  const closures = await getClosures(org_slug);
  const hasInitialClosure = closures.some((c) => c.is_initial);

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <Scale className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Rapprochement Bancaire
            </h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              {org.name} — Clôtures mensuelles
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
            {membership.role}
          </span>
        </div>
      </div>

      {/* Explainer */}
      <div className="p-4 bg-blue-500/5 border border-blue-500/15 rounded-xl flex items-start gap-3">
        <div className="w-1 min-h-[20px] bg-blue-500/50 rounded-full shrink-0 mt-0.5" />
        <p className="text-xs text-blue-300/80 leading-relaxed">
          Chaque mois, comparez le solde affiché sur le site de votre banque avec le solde
          calculé par le système. Un{" "}
          <strong className="text-blue-300">écart nul</strong> confirme l'intégrité
          des données. Un écart signale une transaction manquante, une erreur de saisie,
          ou une anomalie à investiguer.
        </p>
      </div>

      <ClosuresClient
        closures={closures}
        hasInitialClosure={hasInitialClosure}
        canWrite={canWrite}
        orgSlug={org_slug}
      />
    </div>
  );
}