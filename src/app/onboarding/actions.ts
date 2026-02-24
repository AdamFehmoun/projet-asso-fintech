"use server";

import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createOrganization(formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgName = formData.get("orgName") as string;
  if (!orgName) return;

  const slug = orgName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // ✅ RPC atomique : crée l'org + membership OWNER en une seule transaction
  // Remplace les 2 INSERTs séparés qui pouvaient laisser une org orpheline
  const { data: org, error } = await supabase
    .rpc('create_organization_with_owner', {
      p_name: orgName,
      p_slug: slug,
    });

  if (error) {
    console.error("Erreur création Asso:", error);
    throw new Error("Impossible de créer l'association (nom peut-être déjà pris ?)");
  }

  revalidatePath("/");
  redirect(`/${org.slug}/budget`);
}

export async function joinOrganization(formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const slug = formData.get("slug") as string;

  const { data: org, error: orgFetchError } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();

  if (orgFetchError || !org) {
    throw new Error("Association introuvable");
  }

  console.log(`Tentative d'adhésion : User ${user.id} -> Org ${org.id}`);

  // status='pending' + role='membre' → satisfait la policy members__insert__self_join
  const { error } = await supabase
    .from("members")
    .insert({
      user_id: user.id,
      organization_id: org.id,
      role: 'membre',
      status: 'pending'
    });

  if (error) {
    console.error("Erreur SQL détaillée :", error);
    if (error.code === '23505') {
      throw new Error("Tu es déjà enregistré dans cette association.");
    }
    throw new Error(`Erreur Supabase : ${error.message}`);
  }

  return { success: true };
}