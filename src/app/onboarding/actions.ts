"use server";

import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createOrganization(formData: FormData) {
  const supabase = await createClient();

  // 1. Vérifier qui est connecté
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 2. Récupérer le nom de l'asso depuis le formulaire
  const orgName = formData.get("orgName") as string;
  
  if (!orgName) {
    return; // On pourrait gérer une erreur ici
  }

  // 3. Générer un "slug" (URL friendly)
  // Ex: "BDE ESIEE 2026" devient "bde-esiee-2026"
  const slug = orgName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Enlever les caractères spéciaux
    .replace(/[\s_-]+/g, "-") // Remplacer les espaces par des tirets
    .replace(/^-+|-+$/g, ""); // Enlever les tirets au début/fin

  // 4. Créer l'Organisation
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: orgName,
      slug: slug,
    })
    .select()
    .single();

  if (orgError) {
    console.error("Erreur création Asso:", orgError);
    // Si le slug existe déjà (ex: esiee-maroc), on pourrait ajouter un random number
    // Mais pour l'instant on laisse planter (MVP)
    throw new Error("Impossible de créer l'association (Nom peut-être déjà pris ?)");
  }

  // 5. Ajouter l'utilisateur comme ADMIN de cette asso
  const { error: memberError } = await supabase
    .from("members")
    .insert({
      user_id: user.id,
      organization_id: org.id,
      role: "admin", // Le créateur est chef !
    });

  if (memberError) {
    console.error("Erreur ajout membre:", memberError);
    throw new Error("Erreur lors de l'ajout du membre");
  }

  // 6. Redirection vers le Dashboard de la nouvelle asso
  revalidatePath("/");
  redirect(`/${slug}/budget`);
}
export async function joinOrganization(formData: FormData) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const slug = formData.get("slug") as string;

  // 1. Trouver l'ID de l'asso
  const { data: org, error: orgFetchError } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();

  if (orgFetchError || !org) {
    throw new Error("Association introuvable");
  }

  // 2. LOG DE DÉBOGAGE (Regarde ton terminal VS Code)
  console.log(`Tentative d'adhésion : User ${user.id} -> Org ${org.id}`);

  // 3. Créer la demande
  const { error } = await supabase
    .from("members")
    .insert({
      user_id: user.id,
      organization_id: org.id,
      role: 'membre',
      status: 'pending' 
    });

  if (error) {
    console.error("Erreur SQL détaillée :", error); // <--- Très important pour voir le vrai coupable
    
    if (error.code === '23505') {
      throw new Error(`Erreur : Tu es déjà enregistré dans cette association (ID: ${user.id.slice(0,5)}...)`);
    }
    throw new Error(`Erreur Supabase : ${error.message}`);
  }

  return { success: true };
}