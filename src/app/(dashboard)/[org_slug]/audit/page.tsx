import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { AuditReviewTable } from "./audit-client";

export default async function AuditPage({
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
    .select("id, name")
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

  const ALLOWED_ROLES = ["tresorier", "admin", "owner"];
  if (!membership || !ALLOWED_ROLES.includes(membership.role)) {
    redirect(`/${org_slug}/budget`);
  }

  const { data: transactions } = await supabase
    .from("transactions")
    .select(`
      id,
      description,
      amount,
      type,
      date,
      classification_status,
      classification_method,
      confidence_score,
      receipt_url,
      budget_categories ( name, color )
    `)
    .eq("organization_id", org.id)
    .in("classification_status", ["ai_suggested", "validated"])
    .not("classification_method", "is", null)
    .order("date", { ascending: false });

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
            <ShieldCheck className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Journal d'Audit IA
            </h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              {org.name} — Révision des classifications et justificatifs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
            {membership.role}
          </span>
        </div>
      </div>

      <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-xl flex items-start gap-3">
        <div className="w-1 h-full min-h-[20px] bg-amber-500/50 rounded-full shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300/80 leading-relaxed">
          Les transactions <strong className="text-amber-300">IA · LLM</strong> et{" "}
          <strong className="text-amber-300">IA · Vector</strong> requièrent validation manuelle.
          Les badges <strong className="text-amber-300">Manquant</strong> signalent les transactions
          sans justificatif — cliquer pour uploader le document.
        </p>
      </div>

      <AuditReviewTable
        transactions={(transactions ?? []) as any}
        orgSlug={org_slug}
      />
    </div>
  );
}