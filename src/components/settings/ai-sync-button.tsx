'use client';

import { useState } from "react";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { triggerAiSync } from "@/app/(dashboard)/[org_slug]/settings/actions";
import { useParams } from "next/navigation";
import { toast } from "sonner";

export function AiSyncButton() {
  const [loading, setLoading] = useState(false);
  const { org_slug } = useParams();

  const handleSync = async () => {
    setLoading(true);
    try {
      const result = await triggerAiSync(org_slug as string);
      if (result.success) {
        toast.success(`${result.count} catégories vectorisées avec succès !`);
      } else {
        toast.error("Échec de la synchronisation vectorielle");
      }
    } catch (error) {
      toast.error("Une erreur technique est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-indigo-600 text-white rounded-lg shadow-sm">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-indigo-900">Moteur de Recherche Vectoriel</h4>
          <p className="text-xs text-indigo-700 max-w-sm">
            Transforme ton plan comptable en vecteurs mathématiques pour permettre le classement automatique des transactions.
          </p>
        </div>
      </div>
      
      <button
        onClick={handleSync}
        disabled={loading}
        className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-white border border-indigo-200 text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-50 transition-all shadow-sm disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Calcul des Embeddings...
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4" />
            Synchroniser
          </>
        )}
      </button>
    </div>
  );
}