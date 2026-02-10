"use server";

import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { categorizeTransaction } from "@/lib/ai"; // Le cerveau IA
import { stripe } from "@/lib/stripe"; // La banque

// ============================================================================
// ACTION 1 : CRÉATION INTERNE (IA & MANUEL)
// Utilisé par le trésorier pour ajouter une dépense ou une recette cash
// ============================================================================
export async function createTransaction(formData: FormData) {
  const supabase = await createClient();
  
  // 1. Vérif Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // 2. Récupération des données
  const org_slug = formData.get("org_slug") as string;
  const amountStr = formData.get("amount") as string;
  const amount = parseFloat(amountStr);
  const type = formData.get("type") as string;
  const description = formData.get("description") as string;
  const date = formData.get("date") as string;
  
  // Variable mutable pour la catégorie
  let category = formData.get("category") as string;

  // 3. LOGIQUE IA : Si la catégorie est vide, l'IA prend le relais
  if (!category || category.trim() === "") {
    console.log("🤖 Appel à OpenAI pour :", description);
    // On attend la réponse de GPT (ça peut prendre 1 à 2 secondes)
    category = await categorizeTransaction(description, amount);
    console.log("✅ Verdict OpenAI :", category);
  }

  // 4. Récupérer l'ID de l'asso
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", org_slug)
    .single();

  if (!org) throw new Error("Organisation introuvable");

  // 5. Sauvegarde en base
  const amountInCents = Math.round(amount * 100);

  const { error } = await supabase.from("transactions").insert({
    organization_id: org.id,
    profile_id: user.id, // On garde une trace de qui a ajouté la ligne
    amount: amountInCents,
    type,
    category, // Ici, c'est soit la saisie manuelle, soit l'IA
    description,
    date: new Date(date).toISOString(),
    status: "pending", // Par défaut, une saisie manuelle peut nécessiter validation
  });

  if (error) {
    console.error("Erreur Supabase:", error);
    return;
  }

  revalidatePath(`/${org_slug}/budget`);
  redirect(`/${org_slug}/budget`);
}

// ============================================================================
// ACTION 2 : GÉNÉRATION DE LIEN DE PAIEMENT (STRIPE)
// Utilisé pour vendre des places ou encaisser des cotisations
// ============================================================================
export async function createCheckoutSession(org_slug: string, amount: number, title: string) {
  const supabase = await createClient();

  // 1. Récupérer l'ID Stripe de l'asso
  const { data: org } = await supabase
    .from('organizations')
    .select('id, stripe_account_id')
    .eq('slug', org_slug)
    .single();

  if (!org || !org.stripe_account_id) {
    throw new Error("L'association n'a pas connecté son compte Stripe dans les Réglages.");
  }

  // 2. Créer la session Stripe
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: title, // Ex: "Place Gala 2026"
          },
          unit_amount: Math.round(amount * 100), // En centimes
        },
        quantity: 1,
      },
    ],
    metadata: {
      org_id: org.id,         // CRITIQUE : Pour que le webhook retrouve l'asso
      category: "Billetterie", // Par défaut pour les ventes en ligne
      description: title,
    },
    payment_intent_data: {
      application_fee_amount: 100, // Ta commission plateforme (1.00€)
      transfer_data: {
        destination: org.stripe_account_id, // L'argent part chez l'asso
      },
    },
    // Redirections après paiement
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/${org_slug}/budget?payment=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/${org_slug}/budget?payment=cancelled`,
  });

  // 3. Rediriger l'utilisateur vers la page de paiement Stripe
  if (session.url) {
    redirect(session.url);
  }
}