'use server';

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { categorizeTransaction } from "@/lib/ai";

// ============================================================================
// HELPERS RBAC
// ============================================================================

async function requireMembership(org_slug: string, minRole: 'membre' | 'tresorier' | 'admin' | 'owner' = 'membre') {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", org_slug)
    .single();

  if (!org) throw new Error("Organisation introuvable");

  const { data: membership } = await supabase
    .from("members")
    .select("role, status")
    .eq("user_id", user.id)
    .eq("organization_id", org.id)
    .single();

  if (!membership || membership.status !== "active") {
    redirect("/onboarding");
  }

  const hierarchy: Record<string, number> = {
    owner: 4, admin: 3, tresorier: 2, membre: 1,
  };

  if ((hierarchy[membership.role] ?? 0) < (hierarchy[minRole] ?? 0)) {
    throw new Error("Permissions insuffisantes");
  }

  return { supabase, user, org, role: membership.role as string };
}

// ============================================================================
// SCHÉMAS ZOD
// ============================================================================

const transactionSchema = z.object({
  description: z.string().min(2, "Description trop courte"),
  amount:      z.coerce.number().positive("Le montant doit être positif"),
  type:        z.enum(["income", "expense"]),
  categoryName: z.string().optional(),
  date:        z.string().min(1, "Date requise"),
});

const ruleSchema = z.object({
  pattern:     z.string().min(1, "Le pattern ne peut pas être vide"),
  category_id: z.string().uuid("Catégorie invalide"),
});

// ============================================================================
// 1. TRANSACTIONS
// ============================================================================

export async function getTransactions(slug: string) {
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!org) return [];

  const { data } = await supabase
    .from("transactions")
    .select(`*, budget_categories ( name, color )`)
    .eq("organization_id", org.id)
    .order("date", { ascending: false });

  return data ?? [];
}

export async function createTransaction(formData: FormData) {
  const org_slug = formData.get("org_slug") as string;

  // Minimum : être trésorier pour créer une transaction
  const { supabase, user, org } = await requireMembership(org_slug, "tresorier");

  const validated = transactionSchema.safeParse({
    description:  formData.get("description"),
    amount:       formData.get("amount"),
    type:         formData.get("type"),
    categoryName: formData.get("category"),
    date:         formData.get("date"),
  });

  if (!validated.success) {
    throw new Error(validated.error.issues[0].message);
  }

  const { description, amount, type, categoryName, date } = validated.data;

  // --- Logique de catégorisation hiérarchique ---
  let categoryId: string | null = null;
  let method: "manual" | "ai_llm" | "ai_vector" | "hard_rule" = "manual";
  let status: "pending" | "ai_suggested" | "validated" = "pending";

  const { data: dbCategories } = await supabase
    .from("budget_categories")
    .select("id, name")
    .eq("organization_id", org.id);

  if (dbCategories && dbCategories.length > 0) {
    // ÉTAPE A : Match exact (manuel)
    const exactMatch = dbCategories.find(
      (c) => c.name.toLowerCase() === categoryName?.trim().toLowerCase()
    );

    if (exactMatch) {
      categoryId = exactMatch.id;
      method     = "manual";
      status     = "validated";
    } else {
      // ÉTAPE B : Règles déterministes
      const { data: rules } = await supabase
        .from("budget_rules")
        .select("category_id, pattern")
        .eq("organization_id", org.id);

      const matchingRule = rules?.find((rule) =>
        description.toLowerCase().includes(rule.pattern.toLowerCase())
      );

      if (matchingRule) {
        categoryId = matchingRule.category_id;
        method     = "hard_rule";
        status     = "validated";
      } else {
        // ÉTAPE C : Suggestion IA
        const availableNames = dbCategories.map((c) => c.name);
        const aiSuggestedName = await categorizeTransaction(description, amount, availableNames, org.id);
        const matchedCategory = dbCategories.find((c) => c.name === aiSuggestedName);

        if (matchedCategory) {
          categoryId = matchedCategory.id;
          method     = "ai_llm";
          status     = "ai_suggested";
        }
      }
    }
  }

  const { error } = await supabase.from("transactions").insert({
    organization_id:        org.id,
    profile_id:             user.id,
    description,
    amount:                 Math.round(amount * 100),
    type,
    category_id:            categoryId,
    date:                   new Date(date).toISOString(),
    receipt_url:            formData.get("receipt_path")?.toString() || null,
    classification_status:  status,
    classification_method:  method,
    metadata: {
      engine:     method === "ai_llm" ? "gpt-4o" : "rules_engine_v1",
      applied_at: new Date().toISOString(),
    },
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/${org_slug}`);
  revalidatePath(`/${org_slug}/budget`);
  redirect(`/${org_slug}/budget`);
}

// ============================================================================
// 2. RÈGLES BUDGÉTAIRES
// ============================================================================

export async function createRule(formData: FormData) {
  const org_slug = formData.get("org_slug") as string;

  // Minimum : être admin pour créer des règles
  const { supabase, org } = await requireMembership(org_slug, "admin");

  const validated = ruleSchema.safeParse({
    pattern:     formData.get("pattern"),
    category_id: formData.get("category_id"),
  });

  if (!validated.success) {
    throw new Error(validated.error.issues[0].message);
  }

  const { error } = await supabase.from("budget_rules").insert({
    organization_id: org.id,
    pattern:         validated.data.pattern,
    category_id:     validated.data.category_id,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/${org_slug}/settings`);
}

export async function deleteRule(id: string, org_slug: string) {
  const { supabase, org } = await requireMembership(org_slug, "admin");

  // Vérifier que la règle appartient bien à cette org avant de supprimer
  const { data: rule } = await supabase
    .from("budget_rules")
    .select("id")
    .eq("id", id)
    .eq("organization_id", org.id)
    .single();

  if (!rule) throw new Error("Règle introuvable ou accès refusé");

  await supabase.from("budget_rules").delete().eq("id", id);

  revalidatePath(`/${org_slug}/settings`);
}

// ============================================================================
// 3. VALIDATION DES TRANSACTIONS
// ============================================================================

export async function validateTransaction(transactionId: string, org_slug: string) {
  // Minimum : être trésorier pour valider
  const { supabase, user, org } = await requireMembership(org_slug, "tresorier");

  // Vérifier que la transaction appartient bien à cette org
  const { data: transaction } = await supabase
    .from("transactions")
    .select("id")
    .eq("id", transactionId)
    .eq("organization_id", org.id)
    .single();

  if (!transaction) throw new Error("Transaction introuvable ou accès refusé");

  const { error: updateError } = await supabase
    .from("transactions")
    .update({ classification_status: "validated" })
    .eq("id", transactionId);

  if (updateError) throw new Error(updateError.message);

  await supabase.from("transaction_audit_logs").insert({
    transaction_id: transactionId,
    changed_by:     user.id,
    new_status:     "validated",
    notes:          "Validation manuelle par l'auditeur",
  });

  revalidatePath(`/${org_slug}/budget`);
}