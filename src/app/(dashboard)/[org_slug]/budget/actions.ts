"use server";

import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createTransaction(formData: FormData) {
  const supabase = await createClient();
  
  // 1. Récupérer l'utilisateur courant
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // 2. Récupérer les données du formulaire
  const org_slug = formData.get("org_slug") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const type = formData.get("type") as string;
  const category = formData.get("category") as string;
  const description = formData.get("description") as string;
  const date = formData.get("date") as string;

  // 3. Trouver l'ID de l'organisation
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", org_slug)
    .single();

  if (!org) throw new Error("Organisation introuvable");

  // 4. Insérer la transaction (Conversion Euros -> Centimes)
  const amountInCents = Math.round(amount * 100);

  const { error } = await supabase.from("transactions").insert({
    organization_id: org.id,
    profile_id: user.id, // L'ID du profil public (Trigger auto) est le même que auth.users
    amount: amountInCents,
    type,
    category,
    description,
    date: new Date(date).toISOString(),
  });

  if (error) {
    console.error("Erreur insertion:", error);
    return; // Gérer l'erreur UI plus tard
  }

  // 5. Rafraîchir le cache et rediriger
  revalidatePath(`/${org_slug}/budget`);
  redirect(`/${org_slug}/budget`);
}
