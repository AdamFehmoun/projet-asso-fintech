// ============================================================================
// src/app/(dashboard)/[org_slug]/closures/pdf-download-button.tsx
// Bouton client — déclenche le téléchargement via fetch sur la route /pdf
// ============================================================================
"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function PdfDownloadButton({
  orgSlug,
  disabled,
}: {
  orgSlug: string;
  disabled?: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/${orgSlug}/closures/pdf`);

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Erreur serveur" }));
        throw new Error(error);
      }

      // Déclencher le téléchargement sans ouvrir un nouvel onglet
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bilan-${orgSlug}-${new Date().toISOString().slice(0, 7)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Bilan généré", {
        description: "Le PDF a été téléchargé.",
      });
    } catch (err) {
      toast.error("Échec de la génération", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isLoading || disabled}
      title={disabled ? "Ajoutez au moins une clôture pour générer le bilan" : "Générer le bilan PDF"}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all"
    >
      {isLoading ? (
        <><Loader2 className="w-4 h-4 animate-spin" /> Génération...</>
      ) : (
        <><FileDown className="w-4 h-4" /> Générer le bilan PDF</>
      )}
    </button>
  );
}