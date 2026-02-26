import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { env } from "@/lib/env"; // C5 fix : utiliser env.ts validé au lieu de process.env!

export async function POST(req: Request) {
  const body      = await req.text();
  const signature = (await headers()).get("Stripe-Signature") as string;

  let event: Stripe.Event;

  try {
    // 1. Vérification de la signature Stripe (protection contre les webhooks falsifiés)
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET // C5 fix : env.ts validé, pas de process.env!
    );
  } catch (error: any) {
    console.error(`❌ Erreur Signature Webhook: ${error.message}`);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  // 2. Traitement de l'événement
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const orgId      = session.metadata?.org_id;
    const category   = session.metadata?.category   || "Autre";
    const description = session.metadata?.description || "Paiement Stripe";
    const sessionId  = event.id; // m3 fix : identifiant unique de l'événement Stripe

    if (!orgId) {
      console.warn("⚠️ Webhook reçu sans org_id dans les métadonnées, ignoré.");
      return new NextResponse(null, { status: 200 });
    }

    // C5 fix : utiliser env.ts pour les credentials Supabase admin
    const supabaseAdmin = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY
    );

    // C4 fix : valider que l'org existe avant d'insérer
    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("id", orgId)
      .single();

    if (orgError || !org) {
      console.error(`❌ org_id invalide dans les métadonnées Stripe : ${orgId}`);
      // Retourner 200 pour éviter que Stripe ne relance indéfiniment un webhook invalide
      return new NextResponse(null, { status: 200 });
    }

    const amount = session.amount_total || 0;

    // m3 fix : idempotence — vérifier si cet événement Stripe a déjà été traité
    // La colonne stripe_event_id a une contrainte UNIQUE dans le schéma
    const { data: existing } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("stripe_event_id", sessionId)
      .maybeSingle();

    if (existing) {
      console.log(`ℹ️ Événement Stripe ${sessionId} déjà traité, ignoré (retry Stripe).`);
      return new NextResponse(null, { status: 200 });
    }

    // C4 fix : status "pending" au lieu de "verified" — la transaction passe en
    // validation manuelle par le trésorier plutôt qu'être directement comptabilisée.
    const { error } = await supabaseAdmin.from("transactions").insert({
      organization_id:       org.id,
      amount,
      type:                  "income",
      description:           `${description} (${session.customer_details?.email ?? "inconnu"})`,
      category,
      date:                  new Date().toISOString(),
      status:                "pending",               // C4 fix : plus de "verified" automatique
      classification_status: "pending",
      stripe_event_id:       sessionId,               // m3 fix : pour l'idempotence
    });

    if (error) {
      // Ignorer les violations de contrainte unique (double-traitement concurrent)
      if (error.code === "23505") {
        console.log(`ℹ️ Contrainte unique stripe_event_id : ${sessionId} déjà inséré.`);
        return new NextResponse(null, { status: 200 });
      }
      console.error("❌ ERREUR SUPABASE (Insert transaction) :", error);
      return new NextResponse("Database Error", { status: 500 });
    }

    console.log(`💰 Transaction Stripe de ${amount / 100}€ en attente de validation pour l'org ${org.id}`);
  }

  return new NextResponse(null, { status: 200 });
}
