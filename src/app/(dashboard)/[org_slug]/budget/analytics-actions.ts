'use server';

import { createClient } from "@/lib/supabase-server";
import { unstable_cache } from "next/cache";
import { getTransactions } from "../actions";

export type BudgetNode = {
  id: string;
  name: string;
  color: string;
  parent_id: string | null;
  rank: number;
  direct_total: number;
  recursive_total: number;
  children: BudgetNode[]; 
};

/**
 * Récupère l'arbre analytique complet (sommes récursives) via RPC
 */
export async function getBudgetAnalytics(org_slug: string) {
  return unstable_cache(
    async () => {
      const supabase = await createClient();

      const { data, error } = await supabase.rpc('get_hierarchical_budget', {
        org_slug_param: org_slug,
      });

      if (error) {
        console.error("❌ Détails Erreur SQL Analytics:", {
          code: error.code,
          message: error.message,
          details: error.details,
        });
        return [];
      }

      if (!data || data.length === 0) return [];

      return buildAnalyticsTree(data);
    },
    [org_slug, "budget-analytics"],
    { revalidate: 30, tags: [`budget-${org_slug}`] }
  )();
}

/**
 * Calcule la santé financière (Runway, Burn Rate)
 */
export async function getFinancialHealth(org_slug: string) {
  return unstable_cache(
    async () => {
      const transactions = await getTransactions(org_slug);

      const now = new Date();
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(now.getMonth() - 3);

      const recentExpenses = transactions.filter((t: any) =>
        t.type === 'expense' && new Date(t.date) >= threeMonthsAgo
      );

      const totalRecentExpense = recentExpenses.reduce((sum: number, t: any) => sum + t.amount, 0);
      const monthlyBurnRate = totalRecentExpense / 3;

      const totalIncome = transactions.filter((t: any) => t.type === 'income').reduce((sum: number, t: any) => sum + t.amount, 0);
      const totalExpense = transactions.filter((t: any) => t.type === 'expense').reduce((sum: number, t: any) => sum + t.amount, 0);
      const currentBalance = totalIncome - totalExpense;

      const runwayMonths = monthlyBurnRate > 0
        ? (currentBalance / monthlyBurnRate)
        : Infinity;

      return {
        monthlyBurnRate: Math.round(monthlyBurnRate),
        runwayMonths: runwayMonths === Infinity ? Infinity : parseFloat(runwayMonths.toFixed(1)),
        currentBalance,
      };
    },
    [org_slug, "financial-health"],
    { revalidate: 30, tags: [`transactions-${org_slug}`] }
  )();
}

/**
 * Utilitaire pour transformer la liste plate en arbre
 */
function buildAnalyticsTree(nodes: any[]): BudgetNode[] {
  const map = new Map<string, BudgetNode>();
  const roots: BudgetNode[] = [];

  // 1. Init Map
  nodes.forEach(n => {
    map.set(n.id, { ...n, children: [] });
  });

  // 2. Build Tree
  nodes.forEach(n => {
    const node = map.get(n.id)!;
    if (n.parent_id && map.has(n.parent_id)) {
      map.get(n.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // 3. Sort by rank recursive
  const sortNodes = (list: BudgetNode[]) => {
    list.sort((a, b) => (a.rank || 0) - (b.rank || 0));
    list.forEach(node => {
      if (node.children.length > 0) sortNodes(node.children);
    });
  };
  
  sortNodes(roots);
  return roots;
}