import { getTransactions } from "./actions";
import { getBudgetAnalytics } from "./budget/analytics-actions"; // 👈 IMPORT
import { CashflowChart } from "@/components/charts/cashflow-chart";
import { BudgetTreeView } from "@/components/dashboard/budget-tree-view"; // 👈 IMPORT
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

export default async function DashboardPage({ 
  params 
}: { 
  params: Promise<{ org_slug: string }> 
}) {
  const { org_slug } = await params;
  
  // ⚡️ Appel Parallèle pour la performance (Quant Style)
  // On récupère les transactions (pour le graph et KPIs) ET l'arbre (pour la structure)
  const [transactions, budgetTree] = await Promise.all([
     getTransactions(org_slug),
     getBudgetAnalytics(org_slug) 
  ]);

  // --- Calculs Financiers Globaux (KPIs) ---
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);
    
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const balance = totalIncome - totalExpense;

  // --- Préparation Graphique (Time Series) ---
  const monthlyStats = transactions.reduce((acc, t) => {
    const date = new Date(t.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!acc[key]) acc[key] = { income: 0, expense: 0 };
    if (t.type === 'income') acc[key].income += t.amount;
    else acc[key].expense += t.amount;
    return acc;
  }, {} as Record<string, { income: number; expense: number }>);

  const chartData = (Object.entries(monthlyStats) as [string, { income: number; expense: number }][])
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([key, val]) => {
        const [year, month] = key.split('-');
        const dateObj = new Date(parseInt(year), parseInt(month) - 1);
        return {
            month: dateObj.toLocaleDateString('fr-FR', { month: 'short' }),
            income: val.income / 100,
            expense: val.expense / 100
        };
    });

  const formatCurrency = (cents: number) => 
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-slate-900">Vue d'ensemble</h1>
            <p className="text-slate-500 text-sm">Pilotage de la trésorerie</p>
        </div>
        <div className="text-xs font-mono text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
          Sync: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Solde Total</p>
            <p className={`text-3xl font-bold ${balance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                {formatCurrency(balance)}
            </p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Recettes (Total)</p>
            <p className="text-2xl font-bold text-emerald-600">+{formatCurrency(totalIncome)}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Dépenses (Total)</p>
            <p className="text-2xl font-bold text-red-600">-{formatCurrency(totalExpense)}</p>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-lg">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Grid Principal : Graphique + Arbre Analytique */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Colonne Gauche : Cashflow Chart (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-6">Flux de Trésorerie (6 mois)</h3>
            <CashflowChart data={chartData} />
          </div>
        </div>

        {/* Colonne Droite : Structure des Coûts (1/3) */}
        {/* ✅ REMPLACEMENT ICI : On utilise l'Arbre au lieu de la liste plate */}
        <div className="h-full min-h-[400px]">
           <BudgetTreeView data={budgetTree} />
        </div>

      </div>
    </div>
  );
}