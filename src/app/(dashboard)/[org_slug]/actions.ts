'use server';

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { categorizeTransaction } from "@/lib/ai";

// --- Schémas de Validation ---
const transactionSchema = z.object({
  description: z.string().min(2, "Description trop courte"),
  amount: z.coerce.number().positive("Le montant doit être positif"),
  type: z.enum(["income", "expense"]),
  categoryName: z.string().optional(), 
  date: z.string(),
});

// --- 1. GESTION DES TRANSACTIONS ---

export async function getTransactions(slug: string) {
  const supabase = await createClient();
  const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single();
  if (!org) return [];

  const { data, error } = await supabase
    .from('transactions')
    .select(`*, budget_categories ( name, color )`)
    .eq('organization_id', org.id)
    .order('date', { ascending: false });

  return data || [];
}

export async function createTransaction(formData: FormData) {
  const supabase = await createClient();
  const org_slug = formData.get("org_slug") as string;
  
  const rawData = {
    description: formData.get("description") as string,
    amount: formData.get("amount"),
    type: formData.get("type"),
    categoryName: formData.get("category") as string, 
    date: formData.get("date"),
    receipt_path: formData.get("receipt_path"),
  };

  const validatedFields = transactionSchema.safeParse(rawData);
  if (!validatedFields.success) throw new Error("Données invalides.");
  const { description, amount, type, categoryName, date } = validatedFields.data;

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', org_slug).single();
  if (!org) throw new Error("Organisation introuvable");

  // --- 🧠 LOGIQUE DE DÉCISION HIÉRARCHIQUE ---
  let categoryId = null;
  let method: 'manual' | 'ai_llm' | 'ai_vector' | 'hard_rule' = 'manual';
  let status: 'pending' | 'ai_suggested' | 'validated' = 'pending';

  const { data: dbCategories } = await supabase
    .from('budget_categories')
    .select('id, name')
    .eq('organization_id', org.id);

  if (dbCategories && dbCategories.length > 0) {
    // ÉTAPE A : Match Exact (Manuel)
    const exactMatch = dbCategories.find(c => c.name.toLowerCase() === categoryName?.trim().toLowerCase());
    
    if (exactMatch) {
      categoryId = exactMatch.id;
      method = 'manual';
      status = 'validated';
    } 
    else {
      // ÉTAPE B : Moteur de Règles Déterministes (Hard Rules) ⚙️
      const { data: rules } = await supabase
        .from('budget_rules')
        .select('category_id, pattern')
        .eq('organization_id', org.id);

      const matchingRule = rules?.find(rule => 
        description.toLowerCase().includes(rule.pattern.toLowerCase())
      );

      if (matchingRule) {
        categoryId = matchingRule.category_id;
        method = 'hard_rule';
        status = 'validated'; // Règle métier = Auto-validé
      } 
      else {
        // ÉTAPE C : Suggestion IA (Probabiliste) 🤖
        const availableNames = dbCategories.map(c => c.name);
        const aiSuggestedName = await categorizeTransaction(description, amount, availableNames);
        const matchedCategory = dbCategories.find(c => c.name === aiSuggestedName);
        
        if (matchedCategory) {
          categoryId = matchedCategory.id;
          method = 'ai_llm';
          status = 'ai_suggested';
        }
      }
    }
  }

  // Insertion avec logs d'audit
  const { error } = await supabase.from('transactions').insert({
    organization_id: org.id,
    description,
    amount: Math.round(amount * 100),
    type,
    category_id: categoryId,
    date: new Date(date).toISOString(),
    receipt_url: rawData.receipt_path?.toString() || null,
    classification_status: status,
    classification_method: method,
    metadata: { 
        engine: method === 'ai_llm' ? 'gpt-4o' : 'rules_engine_v1',
        applied_at: new Date().toISOString() 
    }
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/${org_slug}`);
  revalidatePath(`/${org_slug}/budget`);
  redirect(`/${org_slug}`);
}

// --- ⚙️ 2. GESTION DES RÈGLES (SETTINGS) ---

export async function createRule(formData: FormData) {
  const supabase = await createClient();
  const org_slug = formData.get("org_slug") as string;
  const pattern = formData.get("pattern") as string;
  const category_id = formData.get("category_id") as string;

  const { data: org } = await supabase.from('organizations').select('id').eq('slug', org_slug).single();
  if (!org) throw new Error("Org introuvable");

  const { error } = await supabase.from('budget_rules').insert({
    organization_id: org.id,
    pattern,
    category_id
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/${org_slug}/settings`);
}

export async function deleteRule(id: string, org_slug: string) {
  const supabase = await createClient();
  await supabase.from('budget_rules').delete().eq('id', id);
  revalidatePath(`/${org_slug}/settings`);
}

// --- ⚖️ 3. AUDIT & VALIDATION ---

export async function validateTransaction(transactionId: string, org_slug: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  await supabase.from('transactions').update({ classification_status: 'validated' }).eq('id', transactionId);

  await supabase.from('transaction_audit_logs').insert({
    transaction_id: transactionId,
    changed_by: user?.id,
    new_status: 'validated',
    notes: "Validation manuelle par l'auditeur"
  });

  revalidatePath(`/${org_slug}/budget`);
}