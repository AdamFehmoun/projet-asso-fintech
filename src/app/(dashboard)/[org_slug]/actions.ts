'use server';

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// --- Schéma de Validation (Zod) ---
const transactionSchema = z.object({
  description: z.string().min(2, "Description trop courte"),
  amount: z.coerce.number().positive("Le montant doit être positif"),
  type: z.enum(["income", "expense"]),
  category: z.string().optional(), // Peut être vide si l'IA n'a rien trouvé
  date: z.string(),
});

// --- Lecture des Transactions ---
export async function getTransactions(slug: string) {
  const supabase = await createClient();
  
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!org) return [];

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('organization_id', org.id)
    .order('date', { ascending: false });

  if (error) {
    console.error('Erreur fetch transactions:', error);
    return [];
  }

  return data;
}

// --- Création d'une Transaction (Action Serveur) ---
export async function createTransaction(formData: FormData) {
  const supabase = await createClient();

  // 1. Récupération du slug depuis le champ caché du formulaire
  const org_slug = formData.get("org_slug") as string;
  if (!org_slug) throw new Error("Slug manquant");

  // 2. Extraction des données brutes
  const rawData = {
    description: formData.get("description"),
    amount: formData.get("amount"),
    type: formData.get("type"),
    category: formData.get("category"),
    date: formData.get("date"),
    organization_id: formData.get("org_id"),
    receipt_path: formData.get("receipt_path"),
  };

  // 3. Validation Zod
  const validatedFields = transactionSchema.safeParse(rawData);

  if (!validatedFields.success) {
    console.error("Validation échouée:", validatedFields.error.flatten());
    throw new Error("Données invalides. Vérifiez les champs.");
  }

  const { description, amount, type, category, date } = validatedFields.data;

  // 4. Récupérer l'ID de l'organisation
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', org_slug)
    .single();

  if (!org) throw new Error("Organisation introuvable");

  // 5. Insertion dans la Base de Données
  // Conversion en centimes (10.50€ -> 1050)
  const amountInCents = Math.round(amount * 100);

  const { error } = await supabase.from('transactions').insert({
    organization_id: org.id,
    description,
    amount: amountInCents,
    type,
    category: category || "Autre",
    date: new Date(date).toISOString(),
    status: "pending", // On met "pending" par défaut pour validation manuelle si besoin
    receipt_url: rawData.receipt_path ? rawData.receipt_path : null, // 👈 Sauvegarde
  });

  if (error) {
    console.error("Erreur insertion:", error);
    throw new Error("Erreur technique lors de l'enregistrement.");
  }

  // 6. Rafraîchir et Rediriger
  revalidatePath(`/${org_slug}/budget`);
  redirect(`/${org_slug}/budget`);
}