// src/components/dashboard/runway-card.tsx
import { Timer, AlertTriangle, Zap } from "lucide-react";

export function RunwayCard({ health }: { health: any }) {
  const isCritical = health.runwayMonths <= 2;
  
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
      {isCritical && <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse" />}
      
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${isCritical ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
          <Timer className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Projection de survie</span>
      </div>

      <div className="space-y-1">
        <h3 className="text-3xl font-black text-slate-900">
          {health.runwayMonths === Infinity ? "∞" : health.runwayMonths} 
          <span className="text-sm font-bold text-slate-400 ml-1 whitespace-nowrap">mois restants</span>
        </h3>
        <p className="text-xs text-slate-500">
          Basé sur un burn rate de <span className="font-bold">{(health.monthlyBurnRate / 100).toLocaleString()}€/mois</span>
        </p>
      </div>

      {/* Jauge Visuelle */}
      <div className="mt-6 w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 ${isCritical ? 'bg-red-500' : 'bg-indigo-500'}`}
          style={{ width: `${Math.min((health.runwayMonths / 12) * 100, 100)}%` }}
        />
      </div>
      
      <div className="mt-4 flex items-center gap-2">
        {isCritical ? (
          <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 uppercase">
            <AlertTriangle className="w-3 h-3" /> Danger : Fond critique
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase">
            <Zap className="w-3 h-3" /> Trésorerie saine
          </div>
        )}
      </div>
    </div>
  );
}