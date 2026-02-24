import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CashflowChart } from "@/components/charts/cashflow-chart"; 
import { ExpenseDonutChart } from "@/components/charts/expense-donut-chart"; 
import { EventCard } from "@/components/dashboard/event-card"; 
import { TransactionDetailSheet } from "@/components/dashboard/transaction-detail-sheet";
import { getTransactions, validateTransaction } from "../actions"; 
import { getBudgetAnalytics, getFinancialHealth } from "./analytics-actions"; // ✅ Import groupé
import { RunwayCard } from "@/components/dashboard/runway-card"; // ✅ Le composant prédictif
import { Sparkles, CheckCircle2, Clock, Gavel, UserCheck, ShieldAlert } from "lucide-react"; 

const formatCurrency = (amountInCents: number) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amountInCents / 100);
};

function aggregateTransactionsByMonth(transactions: any[]) {
  const months: Record<string, { month: string; income: number; expense: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
    const label = d.toLocaleString('fr-FR', { month: 'short' }); 
    months[key] = { month: label, income: 0, expense: 0 };
  }
  transactions.forEach((t) => {
    const date = new Date(t.date);
    const key = date.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
    if (months[key]) {
      if (t.type === 'income') months[key].income += t.amount / 100;
      else months[key].expense += t.amount / 100;
    }
  });
  return Object.values(months);
}

export default async function BudgetPage({
  params,
}: {
  params: Promise<{ org_slug: string }>;
}) {
  const { org_slug } = await params;
  const supabase = await createClient();

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("slug", org_slug)
    .single();

  if (orgError || !org) return <div className="p-8 text-red-500">Organisation introuvable</div>;

  // ⚡️ PERFORMANCE QUANT : Chargement parallèle incluant la santé financière
  const [allTransactions, budgetTree, financialHealth, { data: events }] = await Promise.all([
    getTransactions(org_slug),
    getBudgetAnalytics(org_slug),
    getFinancialHealth(org_slug), // 🔮 Prédiction Runway
    supabase.from('events').select('*').eq('organization_id', org.id).order('date', { ascending: true })
  ]);

  const totalIncome = allTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = allTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
  const currentBalance = totalIncome - totalExpense;
  const chartData = aggregateTransactionsByMonth(allTransactions);

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-10">
      
      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{org.name}</h1>
          <p className="text-slate-500 font-medium tracking-tight italic">Financial Suite — Master Option B</p>
        </div>
        <Link 
          href={`/${org_slug}/budget/new`}
          className="w-full md:w-auto px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition shadow-md active:scale-95 text-center"
        >
          + Nouvelle Opération
        </Link>      
      </div>

      {/* --- KPI CARDS (GRID 4 COLONNES) --- */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        
        {/* 1. Solde */}
        <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Balance Trésorerie</h3>
          <p className={`text-3xl font-black mt-2 ${currentBalance < 0 ? "text-red-600" : "text-slate-900"}`}>
            {formatCurrency(currentBalance)}
          </p>
        </div>

        {/* 2. Recettes */}
        <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Total Recettes</h3>
          <p className="text-3xl font-black mt-2 text-emerald-600">+{formatCurrency(totalIncome)}</p>
        </div>

        {/* 3. Dépenses */}
        <div className="p-6 bg-white rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest">Total Dépenses</h3>
          <p className="text-3xl font-black mt-2 text-red-600">-{formatCurrency(totalExpense)}</p>
        </div>

        {/* 4. 🔮 RUNWAY (Prédiction) */}
        <RunwayCard health={financialHealth} />
      </div>

      {/* --- CHARTS --- */}
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold mb-6">Cashflow (6m)</h3>
          <CashflowChart data={chartData} />
        </div>
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold mb-6">Allocation des fonds</h3>
          <div className="flex-1 flex items-center justify-center">
            <ExpenseDonutChart data={budgetTree} />
          </div>
        </div>
      </div>

      {/* --- JOURNAL D'AUDIT HYBRIDE (IA + RÈGLES) --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            Journal d'Audit
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] rounded-full uppercase tracking-tighter font-black">
              Hybrid Classifier
            </span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Désignation & Méthode</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status Audit</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Montant</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {allTransactions.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 text-xs font-mono text-slate-500">
                    {new Date(t.date).toLocaleDateString("fr-FR", { day: '2-digit', month: '2-digit' })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors tracking-tight">
                          {t.description || "Sans libellé"}
                        </span>
                        
                        {/* 🛡️ BADGES DE TRAÇABILITÉ (Audit Trail) */}
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.budget_categories?.color || '#cbd5e1' }} />
                            <span className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">
                              {t.budget_categories?.name || "Non classé"}
                            </span>
                          </div>

                          {t.classification_method === 'hard_rule' && (
                            <span className="flex items-center gap-1 text-[8px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100 uppercase tracking-tighter">
                              <Gavel className="w-2.5 h-2.5" /> Règle Métier
                            </span>
                          )}
                          {t.classification_method === 'ai_llm' && (
                            <span className="flex items-center gap-1 text-[8px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-tighter">
                              <Sparkles className="w-2.5 h-2.5" /> IA Suggéré
                            </span>
                          )}
                          {t.classification_method === 'manual' && (
                            <span className="flex items-center gap-1 text-[8px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 uppercase tracking-tighter">
                              <UserCheck className="w-2.5 h-2.5" /> Manuel
                            </span>
                          )}
                        </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      {t.classification_status === 'validated' ? (
                        <div className="flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                          <CheckCircle2 className="w-3 h-3" /> VÉRIFIÉ
                        </div>
                      ) : t.classification_status === 'ai_suggested' ? (
                        <div className="flex items-center gap-1 text-[9px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                          <Clock className="w-3 h-3" /> À VALIDER
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                          <ShieldAlert className="w-3 h-3" /> PENDING
                        </div>
                      )}
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-right font-mono font-bold text-sm ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {t.type === 'expense' ? '-' : '+'}{formatCurrency(t.amount)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {t.classification_status === 'ai_suggested' ? (
                      <form action={async () => {
                        'use server';
                        await validateTransaction(t.id, org_slug);
                      }}>
                        <button 
                          type="submit"
                          className="p-2 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all border border-indigo-100 shadow-sm active:scale-90"
                          title="Valider la suggestion IA"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      </form>
                    ) : (
                      <div className="text-slate-200 font-mono text-[10px]">FIXED</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}