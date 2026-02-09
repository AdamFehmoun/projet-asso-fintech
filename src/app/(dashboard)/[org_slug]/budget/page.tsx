import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CashflowChart } from "@/components/charts/cashflow-chart"; 

// Petit utilitaire pour afficher des Euros proprement
const formatCurrency = (amountInCents: number) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amountInCents / 100);
};


function aggregateTransactionsByMonth(transactions: any[]) {
  const months: Record<string, { month: string; income: number; expense: number }> = {};

  // Initialiser les 6 derniers mois à 0 pour avoir un axe continu
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    // Astuce : On force la locale fr-FR pour avoir "février", "mars"...
    const key = d.toLocaleString('fr-FR', { month: 'long' });
    months[key] = { month: key, income: 0, expense: 0 };
  }

  transactions.forEach((t) => {
    const date = new Date(t.date);
    const key = date.toLocaleString('fr-FR', { month: 'long' });
    if (months[key]) {
      // On divise par 100 pour remettre en euros pour le graphique
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

  // 1. Récupérer l'ID de l'organisation via le slug
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("slug", org_slug)
    .single();

  if (orgError || !org) {
    return <div className="p-8 text-red-500">Organisation introuvable : {org_slug}</div>;
  }

  // 2. Récupérer les transactions de cette asso
  const { data: transactions, error: txError } = await supabase
    .from("transactions")
    .select("amount, type, category, date")
    .eq("organization_id", org.id)
    .order("date", { ascending: false });

  if (txError) {
    console.error(txError);
  }

  // 3. Calculer les totaux (Maths financières)
  const allTransactions = transactions || [];
  
  const totalIncome = allTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = allTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  
  const currentBalance = totalIncome - totalExpense;

  // 4. Préparer les données pour le Graphique (Data Science légère)
  const chartData = aggregateTransactionsByMonth(allTransactions);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {org.name}
          </h1>
          <p className="text-slate-500">Gestion financière & Trésorerie</p>
        </div>
        <Link 
          href={`/${org_slug}/budget/new`}
          className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition shadow-sm"
        >
          + Nouvelle Transaction
        </Link>       
      </div>

      {/* Les KPIs (Cartes) */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Carte 1 : Solde */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Solde Actuel</h3>
          <p className={`text-3xl font-bold mt-2 ${currentBalance < 0 ? "text-red-600" : "text-slate-900"}`}>
            {formatCurrency(currentBalance)}
          </p>
        </div>
        
        {/* Carte 2 : Entrées */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Entrées Totales</h3>
          <p className="text-3xl font-bold mt-2 text-emerald-600">
            {formatCurrency(totalIncome)}
          </p>
        </div>

        {/* Carte 3 : Sorties */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Dépenses Totales</h3>
          <p className="text-3xl font-bold mt-2 text-red-600">
            {formatCurrency(totalExpense)}
          </p>
        </div>
      </div>

      {/* SECTION ANALYTICS (GRAPHIQUES) */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-900">Flux de Trésorerie</h3>
            <p className="text-sm text-slate-500">Recettes vs Dépenses (6 derniers mois)</p>
          </div>
          {/* Le composant graphique */}
          <CashflowChart data={chartData} />
        </div>
        
        {/* Placeholder pour la suite (Pie Chart) */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-slate-50 rounded-full mb-4">
                <span className="text-4xl">🥧</span>
            </div>
            <h3 className="text-lg font-medium text-slate-900">Répartition des Dépenses</h3>
            <p className="text-sm text-slate-500 mt-2">Bientôt disponible : Analyse par catégorie</p>
        </div>
      </div>

      {/* Tableau des dernières transactions */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-semibold text-slate-900">Historique des opérations</h3>
        </div>
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50">
            <tr>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Catégorie</th>
              <th className="px-6 py-3 text-right">Montant</th>
              <th className="px-6 py-3 text-center">Type</th>
            </tr>
          </thead>
          {/* On ajoute suppressHydrationWarning ici sur le tbody */}
          <tbody suppressHydrationWarning>
            {allTransactions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  Aucune transaction pour le moment.
                </td>
              </tr>
            ) : (
              allTransactions.map((t, index) => (
                <tr key={t.id || index} className="border-b last:border-0 hover:bg-slate-50 transition">
                  {/* Tu peux laisser les suppress sur les td ou les enlever, le tbody gère tout */}
                  <td className="px-6 py-4 text-slate-600">
                    {new Date(t.date).toLocaleDateString("fr-FR")}
                  </td>
                  
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {t.category}
                  </td>
                  
                  <td className={`px-6 py-4 text-right font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {t.type === 'expense' ? '-' : '+'}{formatCurrency(t.amount)}
                  </td>
                  
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      t.type === 'income' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {t.type === 'income' ? 'Recette' : 'Dépense'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}