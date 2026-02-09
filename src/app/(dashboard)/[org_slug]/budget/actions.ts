"use server";

import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { categorizeTransaction } from "@/lib/ai"; // Import du cerveau

export async function createTransaction(formData: FormData) {
  const supabase = await createClient();
  
  // 1. Vérif Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // 2. Récupération des données
  const org_slug = formData.get("org_slug") as string;
  const amountStr = formData.get("amount") as string;
  const amount = parseFloat(amountStr);
  const type = formData.get("type") as string;
  const description = formData.get("description") as string;
  const date = formData.get("date") as string;
  
  // Variable mutable pour la catégorie
  let category = formData.get("category") as string;

  // 3. LOGIQUE IA : Si la catégorie est vide, l'IA prend le relais
  if (!category || category.trim() === "") {
    console.log("🤖 Appel à OpenAI pour :", description);
    // On attend la réponse de GPT (ça peut prendre 1 à 2 secondes)
    category = await categorizeTransaction(description, amount);
    console.log("✅ Verdict OpenAI :", category);
  }

  // 4. Récupérer l'ID de l'asso
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", org_slug)
    .single();

  if (!org) throw new Error("Organisation introuvable");

  // 5. Sauvegarde en base
  const amountInCents = Math.round(amount * 100);

  const { error } = await supabase.from("transactions").insert({
    organization_id: org.id,
    profile_id: user.id,
    amount: amountInCents,
    type,
    category, // Ici, c'est soit la saisie manuelle, soit l'IA
    description,
    date: new Date(date).toISOString(),
  });

  if (error) {
    console.error("Erreur Supabase:", error);
    return;
  }

  revalidatePath(`/${org_slug}/budget`);
  redirect(`/${org_slug}/budget`);
}
