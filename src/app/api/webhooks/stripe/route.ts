import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js"; // ⚠️ On utilise le client officiel directement
import Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("Stripe-Signature") as string;

  let event: Stripe.Event;

  try {
    // 1. Vérification de la signature (Sécurité absolue)
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error: any) {
    console.error(`❌ Erreur Signature Webhook: ${error.message}`);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  // 2. Traitement de l'événement
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // On récupère les métadonnées
    const orgId = session.metadata?.org_id;
    const category = session.metadata?.category || "Autre";
    const description = session.metadata?.description || "Paiement Stripe";

    if (orgId) {
      // ⚠️ CRÉATION DU CLIENT ADMIN (SERVICE ROLE)
      // Ce client contourne TOUTES les sécurités RLS. Il a tous les droits d'écriture.
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const amount = session.amount_total || 0; // En centimes

      // Insertion dans la compta
      const { error } = await supabaseAdmin.from("transactions").insert({
        organization_id: orgId,
        amount: amount,
        type: "income", // C'est une recette
        description: `${description} (${session.customer_details?.email})`,
        category: category,
        date: new Date().toISOString(),
        status: "verified", // Statut validé
      });
      
      if (error) {
        console.error("❌ ERREUR SUPABASE (Insert transaction) :", error);
        return new NextResponse("Database Error", { status: 500 });
      }

      console.log(`💰 Succès ! Transaction de ${amount/100}€ enregistrée pour l'asso ${orgId}`);
    }
  }

  return new NextResponse(null, { status: 200 });
}