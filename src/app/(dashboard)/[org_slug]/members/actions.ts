"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function updateMemberStatus(
  memberId: string,
  newStatus: 'active' | 'rejected',
  orgSlug: string
) {
  const supabase = await createClient();

  // 1. Authentification
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non connecté");

  // M4 fix : extraire l'org dans une requête séparée pour éviter undefined dans .eq()
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .single();

  if (!org) throw new Error("Organisation introuvable");

  // 2. Vérifier le rôle et le statut du demandeur dans cette org
  const { data: currentUserMember } = await supabase
    .from("members")
    .select("role, status")
    .eq("user_id", user.id)
    .eq("organization_id", org.id)
    .single();

  // M3 fix : admin ET owner peuvent approuver/refuser (aligné avec RLS members__update)
  // M6 fix : vérifier que le demandeur est bien actif (pas un admin révoqué)
  const allowedRoles = ['admin', 'owner'];
  if (
    !currentUserMember ||
    currentUserMember.status !== 'active' ||          // M6 : status actif requis
    !allowedRoles.includes(currentUserMember.role)    // M3 : admin OU owner
  ) {
    throw new Error("Accès refusé : rôle admin ou owner requis");
  }

  // 3. Vérifier que le membre cible appartient à la même org (anti-IDOR)
  const { data: targetMember } = await supabase
    .from("members")
    .select("id, status")
    .eq("id", memberId)
    .eq("organization_id", org.id)
    .single();

  if (!targetMember) throw new Error("Membre introuvable dans cette organisation");

  // 4. Mise à jour
  const { error } = await supabase
    .from("members")
    .update({ status: newStatus })
    .eq("id", memberId)
    .eq("organization_id", org.id); // garde anti-IDOR sur la requête finale

  if (error) throw new Error("Erreur lors de la mise à jour");

  revalidatePath(`/${orgSlug}/members`);
}
