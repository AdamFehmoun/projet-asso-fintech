"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

// --- FONCTION DE CONNEXION ---
export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  // 1. Connexion Supabase
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return redirect("/login?error=true");
  }

  // 2. Qui est connecté ?
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  console.log("👤 Utilisateur connecté :", user.email);

  // 3. REQUÊTE PLUS ROBUSTE (Sans .single())
  // On récupère toutes les adhésions possibles
  const { data: memberships, error: memberError } = await supabase
    .from("members")
    .select(`
      organization_id,
      organizations ( slug )
    `)
    .eq("user_id", user.id);

  // Mouchard pour voir ce que Supabase renvoie dans ton terminal
  console.log("🔍 Résultat recherche asso :", { 
    found: memberships?.length || 0, 
    firstResult: memberships?.[0],
    error: memberError 
  });

  // 4. ANALYSE DU RÉSULTAT
  // On prend la première asso trouvée (s'il y en a une)
  const firstMembership = memberships?.[0];

  if (firstMembership && firstMembership.organizations) {
    // Astuce : Parfois Supabase renvoie un tableau, parfois un objet selon la relation
    // On gère les deux cas pour éviter le crash
    const orgData = firstMembership.organizations;
    // @ts-ignore
    const slug = Array.isArray(orgData) ? orgData[0]?.slug : orgData?.slug;

    if (slug) {
      console.log("✅ Redirection vers :", slug);
      revalidatePath(`/${slug}/budget`, "layout");
      redirect(`/${slug}/budget`);
    }
  }

  // 5. Si on arrive ici, c'est qu'aucune asso valide n'a été trouvée
  console.log("⚠️ Aucune asso trouvée -> Direction Onboarding");
  revalidatePath("/onboarding", "layout");
  redirect("/onboarding");
}

// --- FONCTION D'INSCRIPTION ---
export async function signup(formData: FormData) {
  const supabase = await createClient();
  
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signUp(data);

  if (error) {
    console.error("Erreur signup:", error);
    return redirect("/error");
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}