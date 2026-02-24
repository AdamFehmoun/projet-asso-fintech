import { z } from "zod";

const envSchema = z.object({
  // Supabase — public (exposées au client)
  NEXT_PUBLIC_SUPABASE_URL:      z.string().url("NEXT_PUBLIC_SUPABASE_URL doit être une URL valide"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY est manquante"),

  // Supabase — serveur uniquement
  SUPABASE_SERVICE_ROLE_KEY:     z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY est manquante"),

  // OpenAI
  OPENAI_API_KEY:                z.string().startsWith("sk-", "OPENAI_API_KEY doit commencer par 'sk-'"),

  // Stripe
  STRIPE_SECRET_KEY:             z.string().startsWith("sk_", "STRIPE_SECRET_KEY doit commencer par 'sk_'"),
  STRIPE_WEBHOOK_SECRET:         z.string().startsWith("whsec_", "STRIPE_WEBHOOK_SECRET doit commencer par 'whsec_'"),

  // App
  NEXT_PUBLIC_APP_URL:           z.string().url("NEXT_PUBLIC_APP_URL doit être une URL valide"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.errors
    .map((e) => `  ❌ ${e.path[0]} : ${e.message}`)
    .join("\n");

  throw new Error(
    `\n\n🚨 Variables d'environnement manquantes ou invalides :\n${missing}\n\n` +
    `Vérifie ton fichier .env.local (copie .env.example et remplis les valeurs).\n`
  );
}

export const env = parsed.data;