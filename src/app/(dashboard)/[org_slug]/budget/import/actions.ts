"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RawRow = {
  date: string;
  amount: number;
  type: string;
  description?: string;
};

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

// ─── Zod schema ───────────────────────────────────────────────────────────────

const RowSchema = z.object({
  date: z.coerce.date(),
  description: z.string().max(500).optional(),
  amount: z.number().positive("Le montant doit être positif"),
  type: z.enum(["income", "expense"]),
});

// ─── Action ───────────────────────────────────────────────────────────────────

export async function importTransactions(
  org_slug: string,
  rows: RawRow[]
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
    const parsed = RowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      errors.push({ row: i + 1, message: parsed.error.issues[0].message });
      continue;
    }
    const { date, description, amount, type } = parsed.data;
    toInsert.push({
      organization_id: org.id,
      amount: Math.round(amount * 100),
      type,
      description: description ?? null,
      date: date.toISOString(),
      classification_status: "pending",
      metadata: { import_source: "csv" },
    });
  }

  if (toInsert.length === 0) {
    return { imported: 0, errors };
  }

  const { error: insertError } = await supabase
    .from("transactions")
    .insert(toInsert);

  if (insertError) {
    return { imported: 0, errors: [{ row: 0, message: insertError.message }] };
  }

  revalidatePath(`/${org_slug}/budget`);
  return { imported: toInsert.length, errors };
}
