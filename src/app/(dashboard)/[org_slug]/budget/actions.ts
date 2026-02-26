'use server';

import { redirect } from "next/navigation";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase-server";
import { env } from "@/lib/env";

const HIERARCHY: Record<string, number> = {
  owner: 4, admin: 3, tresorier: 2, membre: 1,
};

export async function createCheckoutSession(
  org_slug: string,
  amount: number, // En EUR (float)
  title: string
) {
  const supabase = await createClient();

  // M5 fix : vérifier l'authentification et le membership avant de créer une session Stripe
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

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

  // Minimum requis : être membre actif (tresorier pour créer un paiement officiel)
  if (
    !membership ||
    membership.status !== "active" ||
    (HIERARCHY[membership.role] ?? 0) < HIERARCHY.tresorier
  ) {
    throw new Error("Permissions insuffisantes : rôle trésorier requis");
  }

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
