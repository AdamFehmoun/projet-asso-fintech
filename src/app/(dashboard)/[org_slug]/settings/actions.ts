'use server';

import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { buildCategoryTree } from "@/lib/data-structures";
import { syncCategoriesToVectors } from "@/lib/sync-vectors";
import { z } from "zod";
import { env } from "@/lib/env";

// ============================================================================
// HELPER RBAC — identique au pattern requireMembership de actions.ts
// ============================================================================

const HIERARCHY: Record<string, number> = {
  owner: 4, admin: 3, tresorier: 2, membre: 1,
};

async function requireOrgMembership(
  org_slug: string,
  minRole: 'membre' | 'tresorier' | 'admin' | 'owner' = 'membre'
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const { data: org } = await supabase
    .from('organizations')
    .select('id, stripe_account_id')
    .eq('slug', org_slug)
    .single();

  if (!org) throw new Error("Organisation introuvable");

  const { data: membership } = await supabase
    .from('members')
    .select('role, status')
    .eq('user_id', user.id)
    .eq('organization_id', org.id)
    .single();

  if (
    !membership ||
    membership.status !== 'active' ||
    (HIERARCHY[membership.role] ?? 0) < (HIERARCHY[minRole] ?? 0)
  ) {
    throw new Error("Permissions insuffisantes");
  }

  return { supabase, user, org, role: membership.role as string };
}

// ============================================================================
// 🏦 PARTIE 1 : STRIPE CONNECT (Trésorerie)
// ============================================================================

export async function createStripeConnectAccount(org_slug: string) {
  // C3 fix : owner requis pour connecter un compte Stripe
  const { supabase, user, org } = await requireOrgMembership(org_slug, 'owner');

  let accountId = org.stripe_account_id;

  if (!accountId) {
    try {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'FR',
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'non_profit',
      });

      accountId = account.id;
      await supabase
        .from('organizations')
        .update({ stripe_account_id: accountId })
        .eq('id', org.id);
    } catch (err) {
      console.error("❌ [Stripe] Erreur technique :", err);
      throw err;
    }
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL;
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/${org_slug}/settings`,
    return_url:  `${appUrl}/${org_slug}/settings?success=true`,
    type: 'account_onboarding',
  });

  redirect(accountLink.url);
}

// ============================================================================
// 🌳 PARTIE 2 : PLAN COMPTABLE (Hierarchical & Drag'n'Drop)
// ============================================================================

export async function getCategories(org_slug: string) {
  const supabase = await createClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', org_slug)
    .single();
  if (!org) return [];

  const { data: categories } = await supabase
    .from('budget_categories')
    .select('*')
    .eq('organization_id', org.id)
    .order('rank', { ascending: true });

  return buildCategoryTree(categories || []);
}

export async function createCategory(formData: FormData) {
  const org_slug = formData.get('org_slug') as string;

  // C3 fix : admin requis pour modifier le plan comptable
  const { supabase, org } = await requireOrgMembership(org_slug, 'admin');

  const name      = formData.get('name') as string;
  const color     = formData.get('color') as string;
  const parent_id = formData.get('parent_id') as string || null;

  const { count } = await supabase
    .from('budget_categories')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', org.id);

  await supabase.from('budget_categories').insert({
    organization_id: org.id,
    name,
    color,
    parent_id: parent_id === "root" ? null : parent_id,
    rank: count || 0,
  });

  revalidatePath(`/${org_slug}/settings`);
}

export async function updateCategoryOrder(
  items: { id: string; rank: number }[],
  org_slug: string
) {
  // C3 fix : admin requis pour réordonner les catégories
  const { supabase, org } = await requireOrgMembership(org_slug, 'admin');

  // Mise à jour uniquement des catégories appartenant à cette org (anti-IDOR)
  const promises = items.map((item) =>
    supabase
      .from('budget_categories')
      .update({ rank: item.rank })
      .eq('id', item.id)
      .eq('organization_id', org.id)
  );
  await Promise.all(promises);
  revalidatePath(`/${org_slug}/settings`);
}

export async function deleteCategory(id: string, org_slug: string) {
  // C3 fix : admin requis + vérification ownership anti-IDOR
  const { supabase, org } = await requireOrgMembership(org_slug, 'admin');

  // Vérifier que la catégorie appartient bien à cette org avant de supprimer
  const { data: category } = await supabase
    .from('budget_categories')
    .select('id')
    .eq('id', id)
    .eq('organization_id', org.id)
    .single();

  if (!category) throw new Error("Catégorie introuvable ou accès refusé");

  const { error } = await supabase
    .from('budget_categories')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id); // double garde anti-IDOR

  if (error) throw new Error("Erreur lors de la suppression");

  revalidatePath(`/${org_slug}/settings`);
}

// ============================================================================
// 🤖 PARTIE 3 : IA & VECTORS (Le "Cerveau")
// ============================================================================

export async function triggerAiSync(org_slug: string) {
  // C3 fix : admin requis pour déclencher la synchronisation (appels OpenAI coûteux)
  await requireOrgMembership(org_slug, 'admin');

  try {
    const count = await syncCategoriesToVectors(org_slug);
    revalidatePath(`/${org_slug}/settings`);
    return { success: true, count };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur inconnue" };
  }
}

// ============================================================================
// ⚙️ PARTIE 4 : MOTEUR DE RÈGLES (Hard Rules)
// ============================================================================

export async function createRule(formData: FormData) {
  const org_slug = formData.get("org_slug") as string;

  // C3 fix : admin requis pour créer des règles de catégorisation
  const { supabase, org } = await requireOrgMembership(org_slug, 'admin');

  const pattern     = formData.get("pattern") as string;
  const category_id = formData.get("category_id") as string;

  if (!pattern?.trim()) throw new Error("Le pattern ne peut pas être vide");

  const { error } = await supabase.from('budget_rules').insert({
    organization_id: org.id,
    pattern,
    category_id,
  });

  if (error) throw new Error("Erreur lors de la création de la règle");

  revalidatePath(`/${org_slug}/settings`);
}

export async function deleteRule(id: string, org_slug: string) {
  // C3 fix : admin requis + vérification ownership anti-IDOR
  const { supabase, org } = await requireOrgMembership(org_slug, 'admin');

  // Vérifier que la règle appartient bien à cette org avant de supprimer
  const { data: rule } = await supabase
    .from('budget_rules')
    .select('id')
    .eq('id', id)
    .eq('organization_id', org.id)
    .single();

  if (!rule) throw new Error("Règle introuvable ou accès refusé");

  const { error } = await supabase
    .from('budget_rules')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id); // double garde anti-IDOR

  if (error) throw new Error("Erreur lors de la suppression");

  revalidatePath(`/${org_slug}/settings`);
}

// ============================================================================
// ⚙️ PARTIE 5 : INFORMATIONS ORGANISATION (owner only)
// ============================================================================

const orgSettingsSchema = z.object({
  name: z.string().min(2, "Le nom doit comporter au moins 2 caractères"),
  rna_number: z
    .string()
    .regex(/^W\d{9}$/, "Format invalide (ex: W123456789)")
    .optional()
    .or(z.literal("")),
  fiscal_start: z
    .string()
    .refine((d) => d.length > 0 && !isNaN(new Date(d).getTime()), "Date invalide"),
});

export async function updateOrgSettings(
  org_slug: string,
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", org_slug)
    .single();

  if (!org) return { success: false, error: "Organisation introuvable" };

  const { data: membership } = await supabase
    .from("members")
    .select("role, status")
    .eq("user_id", user.id)
    .eq("organization_id", org.id)
    .single();

  if (!membership || membership.status !== "active" || membership.role !== "owner") {
    return { success: false, error: "Accès refusé : rôle owner requis" };
  }

  const raw = {
    name:         formData.get("name"),
    rna_number:   formData.get("rna_number") || undefined,
    fiscal_start: formData.get("fiscal_start"),
  };

  const validated = orgSettingsSchema.safeParse(raw);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0].message };
  }

  const { name, rna_number, fiscal_start } = validated.data;

  const { error: updateError } = await supabase
    .from("organizations")
    .update({ name, rna_number: rna_number || null, fiscal_start })
    .eq("id", org.id);

  if (updateError) return { success: false, error: updateError.message };

  revalidatePath(`/${org_slug}/settings`);
  return { success: true };
}
