"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function updateMemberStatus(
  memberId: string, 
  newStatus: 'active' | 'rejected', 
  orgSlug: string
) {
  console.log(`🔄 Tentative mise à jour : Membre ${memberId} -> ${newStatus}`);
  
  const supabase = await createClient();

  // 1. Vérifier que TU es bien admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non connecté");

  // On vérifie ton rôle dans cette asso
  const { data: currentUserMember } = await supabase
    .from("members")
    .select("role, organization_id")
    .eq("user_id", user.id)
    .eq("organization_id", (
        await supabase.from("organizations").select("id").eq("slug", orgSlug).single()
      ).data?.id
    )
    .single();

  if (currentUserMember?.role !== 'admin') {
    console.error("⛔️ Refusé : Tu n'es pas admin");
    throw new Error("Accès refusé");
  }

  // 2. Exécuter la mise à jour
  const { error } = await supabase
    .from("members")
    .update({ status: newStatus })
    .eq("id", memberId);

  if (error) {
    console.error("❌ Erreur SQL Supabase :", error);
    throw new Error("Erreur lors de la mise à jour");
  }

  console.log("✅ Succès !");
  
  // 3. Rafraîchir la page pour voir le changement immédiat
  revalidatePath(`/${orgSlug}/members`);
}