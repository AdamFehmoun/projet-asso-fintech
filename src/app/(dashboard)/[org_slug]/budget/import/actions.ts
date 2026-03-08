"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

// ─── Types publics ────────────────────────────────────────────────────────────

export type RawRow = {
  date: string;
  amount: number;    // signé — peut être négatif (mode "signed")
  type?: string;     // valeur brute CSV — undefined si pas de colonne type
  description?: string;
};

/**
 * Trois stratégies de détection du type income/expense :
 *  - "column"  : une colonne CSV contient la valeur, l'utilisateur précise
 *                quelle valeur = recette et quelle valeur = dépense
 *  - "all"     : toutes les lignes ont le même type (recette ou dépense)
 *  - "signed"  : montant positif = recette, montant négatif = dépense
 */
export type TypeConfig =
  | { mode: "column"; incomeValue: string; expenseValue: string }
  | { mode: "all";    fallbackType: "income" | "expense" }
  | { mode: "signed" };

export type ImportResult = {
  imported: number;
  errors: Array<{ row: number; message: string }>;
};

// ─── Auth guard ───────────────────────────────────────────────────────────────

const ROLE_RANK: Record<string, number> = {
  owner: 4, admin: 3, tresorier: 2, membre: 1,
};

async function getOrgAndMember(
  org_slug: string,
  minRole: "membre" | "tresorier" | "admin" | "owner"
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("slug", org_slug)
    .single();
  if (!org) throw new Error("Organisation introuvable");

  const { data: membership } = await supabase
    .from("members")
    .select("role")
    .eq("user_id", user.id)
    .eq("organization_id", org.id)
    .eq("status", "active")
    .single();

  if (!membership || (ROLE_RANK[membership.role] ?? 0) < ROLE_RANK[minRole]) {
    throw new Error("Accès refusé — rôle insuffisant");
  }
  return { supabase, user, org };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise accents + casse pour comparaison insensible */
function norm(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Résout le type income/expense selon la stratégie choisie */
function normalizeType(
  rawType: string | undefined,
  amount: number,
  config: TypeConfig
): "income" | "expense" | null {
  if (config.mode === "all") return config.fallbackType;
  if (config.mode === "signed") return amount >= 0 ? "income" : "expense";
  // mode "column"
  const v = norm(rawType ?? "");
  if (!v) return null;
  if (norm(config.incomeValue) && v === norm(config.incomeValue)) return "income";
  if (norm(config.expenseValue) && v === norm(config.expenseValue)) return "expense";
  return null;
}

/** Parse un montant depuis une chaîne : accepte virgule/point, € et espaces */
function parseAmountStr(val: string): number {
  return parseFloat(val.replace(",", ".").replace(/[^0-9.-]/g, ""));
}

// ─── Schéma de validation ligne ───────────────────────────────────────────────

const RowSchema = z.object({
  date: z.coerce.date(),
  amount: z.number(),
  description: z.string().max(500).optional(),
});

// ─── Action principale ────────────────────────────────────────────────────────

export async function importTransactions(
  org_slug: string,
  rows: RawRow[],
  typeConfig: TypeConfig
): Promise<ImportResult> {
  const { supabase, org } = await getOrgAndMember(org_slug, "tresorier");

  const errors: Array<{ row: number; message: string }> = [];
  const toInsert: {
    organization_id: string;
    amount: number;
    type: string;
    description: string | null;
    date: string;
    classification_status: string;
    metadata: { import_source: string };
  }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    // Validation date, amount (nombre), description
    const parsed = RowSchema.safeParse({
      date: row.date,
      amount: typeof row.amount === "string" ? parseAmountStr(row.amount) : row.amount,
      description: row.description,
    });
    if (!parsed.success) {
      errors.push({ row: rowNum, message: parsed.error.issues[0].message });
      continue;
    }

    // Résolution du type
    const type = normalizeType(row.type, parsed.data.amount, typeConfig);
    if (!type) {
      const hint =
        typeConfig.mode === "column"
          ? ` (attendu : "${typeConfig.incomeValue}" ou "${typeConfig.expenseValue}")`
          : "";
      errors.push({
        row: rowNum,
        message: `Type non reconnu : "${row.type ?? ""}"${hint}`,
      });
      continue;
    }

    // Montant nul ignoré
    if (Math.abs(parsed.data.amount) === 0) {
      errors.push({ row: rowNum, message: "Montant nul ignoré" });
      continue;
    }

    toInsert.push({
      organization_id: org.id,
      amount: Math.round(Math.abs(parsed.data.amount) * 100), // Math.abs + centimes
      type,
      description: parsed.data.description ?? null,
      date: parsed.data.date.toISOString(),
      classification_status: "pending",
      metadata: { import_source: "csv" },
    });
  }

  if (toInsert.length === 0) return { imported: 0, errors };

  const { error: insertError } = await supabase.from("transactions").insert(toInsert);
  if (insertError) {
    return { imported: 0, errors: [{ row: 0, message: insertError.message }] };
  }

  revalidateTag(`transactions-${org_slug}`);
  revalidateTag(`budget-${org_slug}`);
  revalidatePath(`/${org_slug}/budget`);
  return { imported: toInsert.length, errors };
}
