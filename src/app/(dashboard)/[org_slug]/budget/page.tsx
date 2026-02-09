export default async function BudgetPage({
  params,
}: {
  params: Promise<{ org_slug: string }>;
}) {
  const { org_slug } = await params;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Budget : {org_slug}</h1>
        <button className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium">
          + Nouvelle Dépense
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Carte 1 : Solde */}
        <div className="p-6 bg-white rounded-xl shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500">Solde Actuel</h3>
          <p className="text-2xl font-bold mt-2">12 450,00 €</p>
        </div>
        
        {/* Carte 2 : Entrées */}
        <div className="p-6 bg-white rounded-xl shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500">Entrées (Ce mois)</h3>
          <p className="text-2xl font-bold mt-2 text-green-600">+ 1 200,00 €</p>
        </div>

        {/* Carte 3 : Sorties */}
        <div className="p-6 bg-white rounded-xl shadow-sm border">
          <h3 className="text-sm font-medium text-gray-500">Dépenses (Ce mois)</h3>
          <p className="text-2xl font-bold mt-2 text-red-600">- 450,00 €</p>
        </div>
      </div>
    </div>
  );
}
