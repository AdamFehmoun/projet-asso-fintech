// ============================================================================
// src/app/(dashboard)/[org_slug]/closures/pdf-data.ts
// Récupère toutes les données nécessaires au PDF — côté serveur uniquement
// ============================================================================

import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

const ROLE_RANK: Record<string, number> = {
  owner: 4, admin: 3, tresorier: 2, membre: 1,
};

export type PdfReportData = {
  org: {
    name: string;
    slug: string;
    fiscal_start: string;
  };
  generatedBy: string; // email du trésorier
  generatedAt: string;

  // Résumé financier
  summary: {
    opening_balance: number;   // solde initial (mois zéro)
    closing_balance: number;   // bank_balance de la clôture la plus récente
    total_income: number;
    total_expense: number;
    net: number;
    transaction_count: number;
    missing_receipts_count: number;
  };

  // Clôtures mensuelles
  closures: Array<{
    month: string;
    bank_balance: number;
    computed_balance: number;
    delta: number;
    is_initial: boolean;
    notes: string | null;
  }>;

  // Répartition par catégorie
  categories: Array<{
    name: string;
    color: string;
    total_expense: number;
    total_income: number;
    transaction_count: number;
  }>;

  // Transactions sans justificatif
  missing_receipts: Array<{
    date: string;
    description: string | null;
    amount: number;
    type: "income" | "expense";
    category_name: string | null;
  }>;
};

export async function fetchPdfData(org_slug: string): Promise<PdfReportData> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, fiscal_start")
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

  if (!membership || (ROLE_RANK[membership.role] ?? 0) < ROLE_RANK["tresorier"]) {
    throw new Error("Accès refusé");
  }

  // Fetch toutes les données en parallèle
  const [closuresRes, transactionsRes, categoriesRes, profileRes] = await Promise.all([
    supabase
      .from("monthly_closures")
      .select("month, bank_balance, computed_balance, delta, is_initial, notes")
      .eq("organization_id", org.id)
      .order("month", { ascending: true }),

    supabase
      .from("transactions")
      .select("amount, type, date, description, receipt_url, category_id")
      .eq("organization_id", org.id)
      .order("date", { ascending: true }),

    supabase
      .from("budget_categories")
      .select("id, name, color")
      .eq("organization_id", org.id),

    supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .single(),
  ]);

  const closures = closuresRes.data ?? [];
  const transactions = transactionsRes.data ?? [];
  const categories = categoriesRes.data ?? [];
  const profile = profileRes.data;

  // Calculs summary
  const initialClosure = closures.find((c) => c.is_initial);
  const lastClosure = [...closures].reverse().find((c) => !c.is_initial) ?? initialClosure;

  const total_income = transactions
    .filter((t) => t.type === "income")
    .reduce((acc, t) => acc + t.amount, 0);

  const total_expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc, t) => acc + t.amount, 0);

  const missing_receipts = transactions.filter((t) => !t.receipt_url);

  // Répartition par catégorie
  const catMap = new Map(categories.map((c) => [c.id, { ...c, total_expense: 0, total_income: 0, transaction_count: 0 }]));

  for (const t of transactions) {
    if (t.category_id && catMap.has(t.category_id)) {
      const cat = catMap.get(t.category_id)!;
      cat.transaction_count++;
      if (t.type === "expense") cat.total_expense += t.amount;
      else cat.total_income += t.amount;
    }
  }

  const categoriesData = Array.from(catMap.values())
    .filter((c) => c.transaction_count > 0)
    .sort((a, b) => b.total_expense - a.total_expense);

  // Transactions sans justificatif enrichies
  const catNameMap = new Map(categories.map((c) => [c.id, c.name]));
  const missingReceiptsData = missing_receipts
    .slice(0, 50) // max 50 pour ne pas exploser le PDF
    .map((t) => ({
      date: t.date,
      description: t.description,
      amount: t.amount,
      type: t.type as "income" | "expense",
      category_name: t.category_id ? (catNameMap.get(t.category_id) ?? null) : null,
    }));

  return {
    org: {
      name: org.name,
      slug: org.slug,
      fiscal_start: org.fiscal_start,
    },
    generatedBy: profile?.full_name ?? profile?.email ?? user.email ?? "Trésorier",
    generatedAt: new Date().toISOString(),

    summary: {
      opening_balance: initialClosure?.bank_balance ?? 0,
      closing_balance: lastClosure?.bank_balance ?? 0,
      total_income,
      total_expense,
      net: total_income - total_expense,
      transaction_count: transactions.length,
      missing_receipts_count: missing_receipts.length,
    },

    closures: closures.map((c) => ({
      month: c.month,
      bank_balance: c.bank_balance,
      computed_balance: c.computed_balance,
      delta: c.delta,
      is_initial: c.is_initial,
      notes: c.notes,
    })),

    categories: categoriesData,
    missing_receipts: missingReceiptsData,
  };
}