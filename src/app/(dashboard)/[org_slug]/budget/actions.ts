'use server';

import { redirect } from "next/navigation";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase-server";
import { env } from "@/lib/env";

export async function createCheckoutSession(
  org_slug: string,
  amount: number, // En EUR (float)
  title: string
) {
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", org_slug)
    .single();

  if (!org) throw new Error("Organisation introuvable");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: { name: title },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      },
    ],
    metadata: {
      org_id: org.id,
      description: title,
      category: "Billetterie",
    },
    success_url: `${env.NEXT_PUBLIC_APP_URL}/${org_slug}?payment=success`,
    cancel_url:  `${env.NEXT_PUBLIC_APP_URL}/${org_slug}?payment=cancel`,
  });

  if (!session.url) throw new Error("Impossible de créer la session Stripe");

  redirect(session.url);
}
