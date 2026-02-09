"use client"; // On passe en Client Component pour gérer les onglets

import { useState } from "react";
import { createOrganization, joinOrganization } from "./actions"; 
import { Building2, UserPlus } from "lucide-react"; 

export default function OnboardingPage() {
  const [mode, setMode] = useState<"create" | "join">("create");

  // --- Handlers pour éviter les erreurs de type TypeScript ---
  
  const handleCreate = async (formData: FormData) => {
    // Wrapper pour l'action serveur de création
    await createOrganization(formData);
  };

  const handleJoin = async (formData: FormData) => {
    // Wrapper pour l'action serveur de candidature
    await joinOrganization(formData);
  };

  // -----------------------------------------------------------

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        
        {/* Header Toggle */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setMode("create")}
            className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 ${
              mode === "create" ? "bg-white text-slate-900" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
            }`}
          >
            <Building2 className="w-4 h-4" /> Créer une asso
          </button>
          <button
            onClick={() => setMode("join")}
            className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 ${
              mode === "join" ? "bg-white text-slate-900" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
            }`}
          >
            <UserPlus className="w-4 h-4" /> Rejoindre
          </button>
        </div>

        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              {mode === "create" ? "Lance ton espace" : "Rejoins ton équipe"}
            </h1>
            <p className="text-slate-500 text-sm">
              {mode === "create" 
                ? "Deviens Admin et gère la trésorerie." 
                : "Entre le code (slug) de l'asso pour postuler."}
            </p>
          </div>

          {mode === "create" ? (
            /* FORMULAIRE CRÉATION */
            <form action={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom de l'asso</label>
                <input name="orgName" type="text" required placeholder="Ex: ESIEE Maroc" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black outline-none" />
              </div>
              <button type="submit" className="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-slate-800 transition">Créer et Accéder</button>
            </form>
          ) : (
            /* FORMULAIRE REJOINDRE */
            <form action={handleJoin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Identifiant Asso (Slug)</label>
                <input name="slug" type="text" required placeholder="Ex: esiee-maroc" className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-black outline-none" />
                <p className="text-xs text-slate-400 mt-1">Demande l'identifiant à ton président.</p>
              </div>
              <button type="submit" className="w-full bg-white border border-slate-300 text-slate-700 py-3 rounded-lg font-medium hover:bg-slate-50 transition">Envoyer ma candidature</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}