import { createTransaction } from "../actions";

export default async function NewTransactionPage({
  params,
}: {
  params: Promise<{ org_slug: string }>;
}) {
  const { org_slug } = await params;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Ajouter une transaction</h1>
      
      <form action={createTransaction} className="bg-white p-6 rounded-xl shadow-sm border space-y-6">
        {/* Champ caché pour passer le slug */}
        <input type="hidden" name="org_slug" value={org_slug} />

        <div className="grid grid-cols-2 gap-4">
          {/* Type */}
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select name="type" className="w-full p-2 border rounded-md bg-white">
              <option value="expense">🔴 Dépense</option>
              <option value="income">🟢 Recette</option>
            </select>
          </div>

          {/* Montant */}
          <div>
            <label className="block text-sm font-medium mb-1">Montant (€)</label>
            <input 
              name="amount" 
              type="number" 
              step="0.01" 
              placeholder="0.00" 
              required 
              className="w-full p-2 border rounded-md"
            />
          </div>
        </div>

        {/* Catégorie */}
        <div>
          <label className="block text-sm font-medium mb-1">Catégorie</label>
          <input 
            name="category" 
            type="text" 
            placeholder="Ex: Alimentation, Billeterie, Transport..." 
            required 
            className="w-full p-2 border rounded-md"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <input 
            name="date" 
            type="date" 
            defaultValue={new Date().toISOString().split('T')[0]}
            required 
            className="w-full p-2 border rounded-md"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1">Description (Optionnel)</label>
          <textarea 
            name="description" 
            rows={3} 
            placeholder="Détails de l'opération..." 
            className="w-full p-2 border rounded-md"
          ></textarea>
        </div>

        {/* Boutons */}
        <div className="flex justify-end gap-3 pt-4">
          <a 
            href={`/${org_slug}/budget`}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Annuler
          </a>
          <button 
            type="submit" 
            className="px-6 py-2 bg-black text-white rounded-md hover:bg-gray-800 font-medium"
          >
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}
