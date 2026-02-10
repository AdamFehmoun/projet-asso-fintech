'use server';

import { createClient } from "@/lib/supabase-server"; // Vérifie que ce chemin est bon chez toi, sinon c'est souvent "@/utils/supabase/server"
import { revalidatePath } from "next/cache";
import { z } from "zod";

// --- Schéma de Validation (Sécurité) ---
const transactionSchema = z.object({
  description: z.string().min(2, "Description trop courte"),
  amount: z.coerce.number().positive("Le montant doit être positif"), // Convertit le texte en nombre
  type: z.enum(["income", "expense"]),
  category: z.string().min(1, "Catégorie requise"),
  date: z.string(),
});

// --- Lecture des Transactions (Existante) ---
export async function getTransactions(slug: string) {
  const supabase = await createClient();
  
  // 1. Récupérer l'ID de l'organisation via le slug
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!org) return [];

  // 2. Récupérer les transactions liées
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

// --- Création d'une Transaction (Nouvelle) ---
export async function createTransaction(slug: string, prevState: any, formData: FormData) {
  const supabase = await createClient();

  // 1. Extraction et Validation des données du formulaire
  const rawData = {
    description: formData.get("description"),
    amount: formData.get("amount"),
    type: formData.get("type"),
    category: formData.get("category"),
    date: formData.get("date"),
  };

  const validatedFields = transactionSchema.safeParse(rawData);

  if (!validatedFields.success) {
    // On retourne la première erreur trouvée
    return { error: "Données invalides. Vérifiez le montant et la description." };
  }

  const { description, amount, type, category, date } = validatedFields.data;

  // 2. Récupérer l'ID de l'organisation
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!org) return { error: "Organisation introuvable" };

  // 3. Insertion dans la Base de Données
  // On convertit les euros en centimes pour le stockage (ex: 10.50€ -> 1050)
  const amountInCents = Math.round(amount * 100);

  const { error } = await supabase.from('transactions').insert({
    organization_id: org.id,
    description,
    amount: amountInCents,
    type,
    category,
    date: new Date(date).toISOString(),
    organization_slug: slug // Optionnel : garde-le si ta colonne existe, sinon supprime cette ligne
  });

  if (error) {
    console.error("Erreur insertion:", error);
    return { error: "Erreur technique lors de l'enregistrement." };
  }

  // 4. Rafraîchir le Dashboard pour voir la nouvelle ligne
  revalidatePath(`/dashboard/${slug}`); // Si ton URL est différente, adapte ce chemin
  revalidatePath(`/${slug}`); // Au cas où tu utilises cette route aussi
  
  return { success: true };
}