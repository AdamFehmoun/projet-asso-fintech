import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

// Petit utilitaire pour afficher des Euros proprement
const formatCurrency = (amountInCents: number) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amountInCents / 100); // On divise par 100 car on stocke des centimes
};

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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {org.name}
          </h1>
          <p className="text-slate-500">Gestion financière & Trésorerie</p>
        </div>
        <button className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition shadow-sm">
          + Nouvelle Transaction
        </button>
      </div>

      {/* Les KPIs (Cartes) */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
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
          <tbody>
            {allTransactions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  Aucune transaction pour le moment.
                </td>
              </tr>
            ) : (
              allTransactions.map((t, index) => (
                <tr key={index} className="border-b last:border-0 hover:bg-slate-50 transition">
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
