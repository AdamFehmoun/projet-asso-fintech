// src/components/settings/rule-manager.tsx
'use client';

import { useState } from "react";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import { createRule, deleteRule } from "@/app/(dashboard)/[org_slug]/settings/actions";
import { toast } from "sonner";

export function RuleManager({ categories, initialRules, orgSlug }: any) {
  const [loading, setLoading] = useState(false);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.append('org_slug', orgSlug);
    
    await createRule(formData);
    setLoading(false);
    (e.target as HTMLFormElement).reset();
    toast.success("Règle ajoutée avec succès");
  }

  return (
    <div className="space-y-6">
      {/* Formulaire d'ajout rapide */}
      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex-1">
          <input 
            name="pattern"
            placeholder="Si la description contient..." 
            className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            required
          />
        </div>
        <div className="flex-1">
          <select 
            name="category_id" 
            className="w-full p-2 text-sm border rounded-lg bg-white outline-none"
            required
          >
            <option value="">Alors classer dans...</option>
            {categories.map((cat: any) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <button 
          type="submit" 
          disabled={loading}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2"
        >
          {loading ? "..." : <Plus className="w-4 h-4" />}
          Ajouter
        </button>
      </form>

      {/* Liste des règles actives */}
      <div className="border rounded-xl overflow-hidden bg-white">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Mot-clé</th>
              <th className="px-4 py-3 font-bold text-slate-500 uppercase text-[10px]">Action</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {initialRules.map((rule: any) => (
              <tr key={rule.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono text-indigo-600 font-semibold italic">"{rule.pattern}"</td>
                <td className="px-4 py-3 flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  <span>{rule.budget_categories?.name}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button 
                    onClick={() => deleteRule(rule.id, orgSlug)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}