'use client';

import { useState } from "react";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { getReceiptUrl } from "@/app/actions/get-receipt-url";
import { FileText, Loader2, ExternalLink } from "lucide-react";
import Image from "next/image";

// Formatteur pour transformer les centimes en Euros propres
const formatCurrency = (amountInCents: number) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amountInCents / 100);
};

export function TransactionDetailSheet({ transaction }: { transaction: any }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReceipt = async () => {
    if (!transaction.receipt_url || imageUrl) return;
    setLoading(true);
    const url = await getReceiptUrl(transaction.receipt_url);
    setImageUrl(url);
    setLoading(false);
  };

  return (
    <Sheet onOpenChange={(open) => open && loadReceipt()}>
      <SheetTrigger asChild>
        <button className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500">
          <FileText className="w-4 h-4" />
        </button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">Détail de la transaction</SheetTitle>
        </SheetHeader>

        <div className="mt-8 space-y-6">
          {/* Info Transaction */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Montant</p>
              <p className={`text-lg font-bold ${transaction.type === 'expense' ? 'text-red-600' : 'text-emerald-600'}`}>
                {/* ✅ Correction : Division par 100 + formatage propre */}
                {transaction.type === 'expense' ? '-' : '+'}
                {formatCurrency(transaction.amount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase font-semibold">Date</p>
              <p className="font-medium">{new Date(transaction.date).toLocaleDateString('fr-FR')}</p>
            </div>
          </div>

          {/* Justificatif */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-800">Justificatif</h3>
              {imageUrl && (
                <a href={imageUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 flex items-center gap-1 hover:underline">
                  Ouvrir en grand <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="relative aspect-[3/4] w-full bg-slate-100 rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center">
              {loading ? (
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              ) : imageUrl ? (
                <Image 
                  src={imageUrl} 
                  alt="Ticket de caisse" 
                  fill 
                  className="object-contain p-2"
                />
              ) : (
                <p className="text-sm text-slate-400">Aucun justificatif lié</p>
              )}
            </div>
          </div>

          {/* Analyse IA Recap */}
          <div className="space-y-3">
             <h3 className="font-semibold text-slate-800">Informations comptables</h3>
             <div className="space-y-2">
                <div className="flex justify-between text-sm border-b pb-2">
                    <span className="text-slate-500">Description</span>
                    <span className="font-medium">{transaction.description || "Aucune description"}</span>
                </div>
                <div className="flex justify-between text-sm border-b pb-2">
                    <span className="text-slate-500">Catégorie</span>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                        {transaction.category || "Non classé"}
                    </span>
                </div>
             </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}