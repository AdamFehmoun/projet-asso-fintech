'use client';

import { Calendar, Tag } from "lucide-react";
import { createCheckoutSession } from "@/app/(dashboard)/[org_slug]/budget/actions"; 

interface EventProps {
  id: string;
  title: string;
  description: string;
  price: number; // en centimes
  date: string;
  org_slug: string;
}

export function EventCard({ event }: { event: EventProps }) {
  const priceInEur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(event.price / 100);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between h-full">
      <div>
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-slate-900">{event.title}</h3>
          <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full">
            {priceInEur}
          </span>
        </div>
        <p className="text-slate-500 text-sm mb-4 line-clamp-2">{event.description}</p>
        
        <div className="flex items-center gap-4 text-xs text-slate-400 mb-6">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {/* ✅ CORRECTION ICI : On force le format FR et on ignore l'erreur d'hydratation */}
            <span suppressHydrationWarning>
              {new Date(event.date).toLocaleDateString('fr-FR')}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Tag className="w-3 h-3" />
            Billetterie
          </div>
        </div>
      </div>

      <button 
        onClick={() => createCheckoutSession(event.org_slug, event.price / 100, event.title)}
        className="w-full bg-slate-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition active:scale-95"
      >
        Acheter le billet
      </button>
    </div>
  );
}