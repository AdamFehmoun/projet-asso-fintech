// src/app/(dashboard)/[org_slug]/page.tsx
import { getTransactions } from "./actions";
import { CashflowChart } from "@/components/charts/cashflow-chart";
import { CreditCard, TrendingUp, TrendingDown, Wallet } from "lucide-react";

export default async function DashboardPage({ 
  params 
}: { 
  params: Promise<{ org_slug: string }> 
}) {
  const { org_slug } = await params;
  const transactions = await getTransactions(org_slug);

  // --- Calculs Financiers ---
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);
    
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const balance = totalIncome - totalExpense;

  // Préparation des données pour le graphique (Simplifié : tout sur un mois fictif pour l'instant)
  // Idéalement, il faudra grouper par mois via SQL ou JS
  const chartData = [
    { month: "Actuel", income: totalIncome / 100, expense: totalExpense / 100 }
  ];

  const formatCurrency = (cents: number) => 
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Vue d'ensemble</h1>
        <div className="text-sm text-slate-500">
          Dernière mise à jour : {new Date().toLocaleDateString()}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Carte Solde */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Solde Total</p>
            <p className="text-3xl font-bold text-slate-900">{formatCurrency(balance)}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        {/* Carte Recettes */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Recettes</p>
            <p className="text-2xl font-bold text-emerald-600">+{formatCurrency(totalIncome)}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Carte Dépenses */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 mb-1">Dépenses</p>
            <p className="text-2xl font-bold text-red-600">-{formatCurrency(totalExpense)}</p>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-lg">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Graphique & Liste */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Colonne Gauche : Graphique (Prend 2/3 de la place) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-6">Flux de Trésorerie</h3>
            <CashflowChart data={chartData} />
          </div>
        </div>

        {/* Colonne Droite : Dernières transactions */}
        <div className="bg-white p-0 rounded-xl border border-slate-200 shadow-sm overflow-hidden h-fit">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-semibold text-slate-900">Récents</h3>
            <span className="text-xs text-slate-500">{transactions.length} opérations</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                Aucune transaction.
              </div>
            ) : (
              transactions.map((t) => (
                <div key={t.id} className="p-4 hover:bg-slate-50 transition flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      t.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {t.type === 'income' ? <TrendingUp className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm truncate max-w-[120px]">{t.description}</p>
                      <p className="text-xs text-slate-500" suppressHydrationWarning>
                        {new Date(t.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  <div className={`font-semibold text-sm ${
                    t.type === 'income' ? 'text-emerald-600' : 'text-slate-900'
                  }`}>
                    {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}