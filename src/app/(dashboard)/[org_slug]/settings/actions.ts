'use server';

import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { buildCategoryTree } from "@/lib/data-structures";
import { syncCategoriesToVectors } from "@/lib/sync-vectors"; 

// ============================================================================
// 🏦 PARTIE 1 : STRIPE CONNECT (Trésorerie)
// ============================================================================

export async function createStripeConnectAccount(org_slug: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const { data: org, error: fetchError } = await supabase
    .from('organizations')
    .select('id, stripe_account_id')
    .eq('slug', org_slug)
    .single();

  if (fetchError || !org) throw new Error("Organisation introuvable");

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
      await supabase.from('organizations').update({ stripe_account_id: accountId }).eq('id', org.id);
    } catch (err) {
      console.error("❌ [Stripe] Erreur technique :", err);
      throw err;
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/${org_slug}/settings`,
    return_url: `${appUrl}/${org_slug}/settings?success=true`,
    type: 'account_onboarding',
  });

  redirect(accountLink.url);
}

// ============================================================================
// 🌳 PARTIE 2 : PLAN COMPTABLE (Hierarchical & Drag'n'Drop)
// ============================================================================

export async function getCategories(org_slug: string) {
  const supabase = await createClient();
  const { data: org } = await supabase.from('organizations').select('id').eq('slug', org_slug).single();
  if (!org) return [];

  const { data: categories } = await supabase
    .from('budget_categories')
    .select('*')
    .eq('organization_id', org.id)
    .order('rank', { ascending: true });

  return buildCategoryTree(categories || []);
}

export async function createCategory(formData: FormData) {
  const supabase = await createClient();
  const name = formData.get('name') as string;
  const color = formData.get('color') as string;
  const parent_id = formData.get('parent_id') as string || null;
  const org_slug = formData.get('org_slug') as string;

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', org_slug).single();
  if (!org) throw new Error("Organisation introuvable");

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

export async function updateCategoryOrder(items: { id: string; rank: number }[], org_slug: string) {
  const supabase = await createClient();
  const promises = items.map((item) => 
    supabase.from('budget_categories').update({ rank: item.rank }).eq('id', item.id)
  );
  await Promise.all(promises);
  revalidatePath(`/${org_slug}/settings`);
}

// ✅ AJOUT CRITIQUE : La fonction manquante pour la suppression
export async function deleteCategory(id: string, org_slug: string) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('budget_categories')
    .delete()
    .eq('id', id);

  if (error) throw new Error("Erreur lors de la suppression");

  revalidatePath(`/${org_slug}/settings`);
}

// ============================================================================
// 🤖 PARTIE 3 : IA & VECTORS (Le "Cerveau")
// ============================================================================

export async function triggerAiSync(org_slug: string) {
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
  const supabase = await createClient();
  const org_slug = formData.get("org_slug") as string;
  const pattern = formData.get("pattern") as string;
  const category_id = formData.get("category_id") as string;

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', org_slug)
    .single();

  if (!org) throw new Error("Organisation introuvable");

  const { error } = await supabase.from('budget_rules').insert({
    organization_id: org.id,
    pattern,
    category_id
  });

  if (error) throw new Error("Erreur lors de la création de la règle");

  revalidatePath(`/${org_slug}/settings`);
}

export async function deleteRule(id: string, org_slug: string) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('budget_rules')
    .delete()
    .eq('id', id);

  if (error) throw new Error("Erreur lors de la suppression");

  revalidatePath(`/${org_slug}/settings`);
}