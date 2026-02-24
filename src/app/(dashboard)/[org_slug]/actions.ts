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

export async function validateTransactionsBatch(
  transactionIds: string[],
  org_slug: string
) {
  if (!transactionIds.length) return { count: 0 };

  const { supabase, user, org } = await requireMembership(org_slug, "tresorier");

  // Vérification ownership en une seule requête — pas de N+1
  const { data: ownedTransactions, error: checkError } = await supabase
    .from("transactions")
    .select("id")
    .in("id", transactionIds)
    .eq("organization_id", org.id)
    .eq("classification_status", "ai_suggested");

  if (checkError) throw new Error(checkError.message);

  const validIds = (ownedTransactions ?? []).map((t) => t.id);
  if (!validIds.length) return { count: 0 };

  // Bulk update en une seule requête
  const { error: updateError } = await supabase
    .from("transactions")
    .update({ classification_status: "validated" })
    .in("id", validIds);

  if (updateError) throw new Error(updateError.message);

  // Bulk insert audit trail
  const auditEntries = validIds.map((id) => ({
    transaction_id: id,
    changed_by: user.id,
    new_status: "validated",
    notes: "Validation en masse par le trésorier",
  }));

  await supabase.from("transaction_audit_logs").insert(auditEntries);

  revalidatePath(`/${org_slug}/audit`);
  revalidatePath(`/${org_slug}/budget`);

  return { count: validIds.length };
}

export async function attachReceipt(
  transactionId: string,
  org_slug: string,
  formData: FormData
): Promise<{ success: true; receipt_url: string } | { success: false; error: string }> {
  const { supabase, user, org } = await requireMembership(org_slug, "tresorier");

  // Vérification ownership
  const { data: transaction } = await supabase
    .from("transactions")
    .select("id, receipt_url")
    .eq("id", transactionId)
    .eq("organization_id", org.id)
    .single();

  if (!transaction) {
    return { success: false, error: "Transaction introuvable ou accès refusé" };
  }

  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "Aucun fichier fourni" };

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
    return { success: false, error: "Format non supporté (JPG, PNG, WEBP, PDF)" };
  }

  const maxSize = 10 * 1024 * 1024; // 10MB — on est plus généreux sur l'upload manuel
  if (file.size > maxSize) {
    return { success: false, error: "Fichier trop volumineux (max 10MB)" };
  }

  // Supprimer l'ancien fichier si présent
  if (transaction.receipt_url) {
    await supabase.storage.from("receipts").remove([transaction.receipt_url]);
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const filePath = `${org.id}/${transactionId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    return { success: false, error: "Erreur upload : " + uploadError.message };
  }

  // Update transaction
  const { error: updateError } = await supabase
    .from("transactions")
    .update({ receipt_url: filePath })
    .eq("id", transactionId);

  if (updateError) {
    return { success: false, error: "Erreur mise à jour : " + updateError.message };
  }

  // Audit trail
  await supabase.from("transaction_audit_logs").insert({
    transaction_id: transactionId,
    changed_by: user.id,
    notes: `Justificatif attaché manuellement : ${filePath}`,
  });

  revalidatePath(`/${org_slug}/audit`);
  revalidatePath(`/${org_slug}/budget`);

  return { success: true, receipt_url: filePath };
}