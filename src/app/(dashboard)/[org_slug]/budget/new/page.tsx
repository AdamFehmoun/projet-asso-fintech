'use client'; 

import { useState, use } from "react";
import { createTransaction } from "../../actions";
import { ReceiptUploader } from "@/components/forms/receipt-uploader"; 
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function NewTransactionPage({
  params,
}: {
  params: Promise<{ org_slug: string }>;
}) {
  const { org_slug } = use(params);

  // State pour gérer les valeurs du formulaire
  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    category: "",
    date: new Date().toISOString().split('T')[0],
    type: "expense",
    receipt_path: "" // Initialisé à vide
  });

  // Fonction appelée quand l'IA a fini de lire le ticket
  const handleScanComplete = (data: any) => {
    setFormData((prev) => ({
      ...prev,
      amount: data.amount ? String(data.amount) : prev.amount,
      description: data.description || prev.description,
      category: data.category || prev.category,
      date: data.date || prev.date,
      // On sauvegarde le chemin du fichier reçu du serveur
      receipt_path: data.receipt_path || prev.receipt_path || "" 
    }));
  };

  // Met à jour le state quand l'utilisateur tape manuellement
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <Link 
        href={`/${org_slug}/budget`}
        className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-2 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Retour au budget
      </Link>

      <h1 className="text-2xl font-bold mb-6">Ajouter une transaction</h1>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border space-y-6">
        
        {/* 📸 ZONE D'UPLOAD INTELLIGENTE */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <ReceiptUploader onScanComplete={handleScanComplete} />
        </div>

        <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase">Détails de l'opération</span>
            <div className="flex-grow border-t border-slate-200"></div>
        </div>

        {/* Formulaire classique */}
        <form action={createTransaction} className="space-y-6">
          <input type="hidden" name="org_slug" value={org_slug} />
          
          {/* ✅ PROTECTION : Le fallback || "" empêche l'erreur React */}
          <input type="hidden" name="receipt_path" value={formData.receipt_path || ""} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select 
                name="type" 
                value={formData.type}
                onChange={handleChange}
                className="w-full p-2 border rounded-md bg-white outline-none focus:ring-2 focus:ring-black"
              >
                <option value="expense">🔴 Dépense</option>
                <option value="income">🟢 Recette</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Montant (€)</label>
              <input 
                name="amount" 
                type="number" 
                step="0.01" 
                placeholder="0.00" 
                required 
                value={formData.amount}
                onChange={handleChange}
                className="w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 flex items-center gap-2">
              Catégorie 
              {formData.category && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <Sparkles className="w-3 h-3" /> Auto-détectée
                </span>
              )}
            </label>
            <input 
              name="category" 
              type="text" 
              placeholder="Ex: Alimentation, Transport... (Laisser vide pour IA)" 
              value={formData.category}
              onChange={handleChange}
              className="w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input 
              name="date" 
              type="date" 
              required 
              value={formData.date}
              onChange={handleChange}
              className="w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description (Optionnel)</label>
            <textarea 
              name="description" 
              rows={3} 
              placeholder="Détails de l'opération..." 
              value={formData.description}
              onChange={handleChange}
              className="w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-black"
            ></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Link 
              href={`/${org_slug}/budget`}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition"
            >
              Annuler
            </Link>
            <button 
              type="submit" 
              className="px-6 py-2 bg-black text-white rounded-md hover:bg-gray-800 font-medium transition shadow-md"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}