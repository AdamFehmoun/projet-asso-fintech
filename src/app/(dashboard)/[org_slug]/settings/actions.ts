'use server';

import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export async function createStripeConnectAccount(org_slug: string) {
  console.log("🚀 [Stripe] Démarrage onboarding pour :", org_slug);

  const supabase = await createClient();

  // 1. Vérifier que l'utilisateur est connecté
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  // 2. Récupérer l'asso
  const { data: org, error: fetchError } = await supabase
    .from('organizations')
    .select('id, stripe_account_id')
    .eq('slug', org_slug)
    .single();

  if (fetchError || !org) {
    console.error("❌ [Stripe] Erreur récupération org:", fetchError);
    throw new Error("Organisation introuvable");
  }

  let accountId = org.stripe_account_id;

  // 3. Si l'asso n'a pas de compte Stripe, on le crée
  if (!accountId) {
    console.log("⚠️ [Stripe] Pas de compte détecté, création en cours...");
    
    try {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'FR',
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'non_profit', // Important pour les Assos
      });

      accountId = account.id;
      console.log("✅ [Stripe] Compte créé. ID :", accountId);

      // --- ETAPE CRITIQUE : SAUVEGARDE EN BASE ---
      const { error: updateError } = await supabase
        .from('organizations')
        .update({ stripe_account_id: accountId })
        .eq('id', org.id);

      if (updateError) {
        // C'est souvent ICI que ça bloque à cause des permissions RLS
        console.error("❌ [Supabase] IMPOSSIBLE DE SAUVEGARDER L'ID !", updateError);
        throw new Error("Erreur permission base de données : " + updateError.message);
      } else {
        console.log("💾 [Supabase] ID Stripe sauvegardé avec succès !");
      }

    } catch (err) {
      console.error("❌ [Stripe] Erreur technique :", err);
      throw err;
    }
  } else {
    console.log("ℹ️ [Stripe] Compte déjà existant :", accountId);
  }

  // 4. Générer le lien d'onboarding
  console.log("🔄 [Stripe] Génération du lien Account Link...");
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/${org_slug}/settings`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/${org_slug}/settings?success=true`,
    type: 'account_onboarding',
  });

  console.log("🔗 [Stripe] Redirection vers :", accountLink.url);
  redirect(accountLink.url);
}