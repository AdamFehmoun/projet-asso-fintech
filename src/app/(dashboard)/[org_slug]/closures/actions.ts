// ============================================================================
// src/app/(dashboard)/[org_slug]/closures/actions.ts
// ============================================================================
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase-server";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CreateInitialClosureSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}-01$/, "La date doit être le 1er du mois"),
  initial_balance_euros: z.number().min(0, "Le solde initial doit être positif"),
  notes: z.string().max(500).optional(),
});

const CreateClosureSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}-01$/, "La date doit être le 1er du mois"),
  bank_balance_euros: z.number(),
  notes: z.string().max(500).optional(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClosureWithComputed = {
  id: string;
  month: string;
  bank_balance: number;
  computed_balance: number;
  delta: number;
  is_initial: boolean;
  initial_balance: number | null;
  notes: string | null;
  closed_by: string | null;
  created_at: string;
};

// ─── Auth guard helper (inline, pattern du projet) ───────────────────────────

const ROLE_RANK: Record<string, number> = {
  owner: 4, admin: 3, tresorier: 2, membre: 1,
};

async function getOrgAndMember(org_slug: string, minRole: "membre" | "tresorier" | "admin" | "owner") {
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

// ─── computeBalanceForMonth ───────────────────────────────────────────────────

async function computeBalanceForMonth(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  month: string
): Promise<{ computed: number; previousClosure: ClosureWithComputed } | null> {
  const monthDate = new Date(month);
  const prevMonthDate = new Date(monthDate);
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: previousClosure } = await supabase
    .from("monthly_closures")
    .select("*")
    .eq("organization_id", orgId)
    .eq("month", prevMonth)
    .single();

  if (!previousClosure) return null;

  const nextMonthDate = new Date(monthDate);
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
  const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("amount, type")
    .eq("organization_id", orgId)
    .gte("date", month)
    .lt("date", nextMonth);

  const monthDelta = (transactions ?? []).reduce((acc, t) => {
    return t.type === "income" ? acc + t.amount : acc - t.amount;
  }, 0);

  return {
    computed: previousClosure.bank_balance + monthDelta,
    previousClosure: previousClosure as ClosureWithComputed,
  };
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createInitialClosure(
  org_slug: string,
  input: z.infer<typeof CreateInitialClosureSchema>
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = CreateInitialClosureSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const { supabase, user, org } = await getOrgAndMember(org_slug, "tresorier");

  const { data: existing } = await supabase
    .from("monthly_closures")
    .select("id")
    .eq("organization_id", org.id)
    .eq("is_initial", true)
    .single();

  if (existing) {
    return { success: false, error: "Un solde initial existe déjà pour cette organisation." };
  }

  const balanceCents = Math.round(parsed.data.initial_balance_euros * 100);

  const { error } = await supabase.from("monthly_closures").insert({
    organization_id: org.id,
    month: parsed.data.month,
    bank_balance: balanceCents,
    computed_balance: balanceCents,
    is_initial: true,
    initial_balance: balanceCents,
    notes: parsed.data.notes ?? null,
    closed_by: user.id,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath(`/${org_slug}/closures`);
  return { success: true };
}

export async function createClosure(
  org_slug: string,
  input: z.infer<typeof CreateClosureSchema>
): Promise<
  | { success: true; delta: number; computed_balance: number }
  | { success: false; error: string }
> {
  const parsed = CreateClosureSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const { supabase, user, org } = await getOrgAndMember(org_slug, "tresorier");

  const { data: existing } = await supabase
    .from("monthly_closures")
    .select("id")
    .eq("organization_id", org.id)
    .eq("month", parsed.data.month)
    .single();

  if (existing) {
    return { success: false, error: "Ce mois a déjà été clôturé." };
  }

  const result = await computeBalanceForMonth(supabase, org.id, parsed.data.month);
  if (!result) {
    return {
      success: false,
      error: "Aucun point de départ trouvé. Commencez par déclarer le solde initial de votre association.",
    };
  }

  const bankBalanceCents = Math.round(parsed.data.bank_balance_euros * 100);

  const { error } = await supabase.from("monthly_closures").insert({
    organization_id: org.id,
    month: parsed.data.month,
    bank_balance: bankBalanceCents,
    computed_balance: result.computed,
    is_initial: false,
    notes: parsed.data.notes ?? null,
    closed_by: user.id,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath(`/${org_slug}/closures`);
  return {
    success: true,
    delta: bankBalanceCents - result.computed,
    computed_balance: result.computed,
  };
}

export async function previewComputedBalance(
  org_slug: string,
  month: string
): Promise<
  | { success: true; computed_balance: number; previous_bank_balance: number; month_transactions_delta: number }
  | { success: false; error: string }
> {
  const { supabase, org } = await getOrgAndMember(org_slug, "tresorier");

  const result = await computeBalanceForMonth(supabase, org.id, month);
  if (!result) return { success: false, error: "no_initial_closure" };

  const monthDate = new Date(month);
  const nextMonthDate = new Date(monthDate);
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
  const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: transactions } = await supabase
    .from("transactions")
    .select("amount, type")
    .eq("organization_id", org.id)
    .gte("date", month)
    .lt("date", nextMonth);

  const delta = (transactions ?? []).reduce((acc, t) => {
    return t.type === "income" ? acc + t.amount : acc - t.amount;
  }, 0);

  return {
    success: true,
    computed_balance: result.computed,
    previous_bank_balance: result.previousClosure.bank_balance,
    month_transactions_delta: delta,
  };
}

export async function getClosures(org_slug: string): Promise<ClosureWithComputed[]> {
  const { supabase, org } = await getOrgAndMember(org_slug, "membre");

  const { data } = await supabase
    .from("monthly_closures")
    .select("*")
    .eq("organization_id", org.id)
    .order("month", { ascending: false });

  return (data ?? []) as ClosureWithComputed[];
}