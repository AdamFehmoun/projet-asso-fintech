"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return redirect("/login?error=true");
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect("/login");

  console.log("👤 Utilisateur connecté :", user.email);

  // ✅ Requête corrigée : jointure directe sur organizations
  // On filtre status='active' pour ne rediriger que vers les orgs confirmées
  const { data: memberships, error: memberError } = await supabase
    .from("members")
    .select(`
      organization_id,
      role,
      status,
      organizations ( slug )
    `)
    .eq("user_id", user.id)
    .eq("status", "active")   // ← Seulement les memberships actifs
    .order("created_at", { ascending: true });

  console.log("🔍 Résultat memberships :", {
    found: memberships?.length || 0,
    error: memberError
  });

  const firstMembership = memberships?.[0];

  if (firstMembership?.organizations) {
    const orgData = firstMembership.organizations;
    // @ts-ignore
    const slug = Array.isArray(orgData) ? orgData[0]?.slug : orgData?.slug;

    if (slug) {
      console.log("✅ Redirection vers :", slug);
      revalidatePath(`/${slug}/budget`, "layout");
      redirect(`/${slug}/budget`);
    }
  }

  // Aucune asso active → onboarding
  console.log("⚠️ Aucune asso active -> Onboarding");
  revalidatePath("/onboarding", "layout");
  redirect("/onboarding");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    console.error("Erreur signup:", error);
    return redirect("/error");
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}