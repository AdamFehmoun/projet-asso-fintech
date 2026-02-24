'use client';

import { useState } from "react";
import { ChevronRight, ChevronDown, FolderOpen } from "lucide-react"; // ✅ Ajout FolderOpen
import { BudgetNode } from "@/app/(dashboard)/[org_slug]/budget/analytics-actions";

const formatEur = (cents: number) => 
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

// On passe maxTotal pour calculer le % relatif au parent (Drill-down)
function TreeNode({ node, maxTotal }: { node: BudgetNode, maxTotal: number }) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  
  // % relatif : Si je suis une sous-catégorie, combien je pèse dans mon parent ?
  const percentage = maxTotal > 0 ? (node.recursive_total / maxTotal) * 100 : 0;
  const isZero = node.recursive_total === 0;

  return (
    <div className="flex flex-col">
      {/* Ligne Principale */}
      <div className="flex items-center gap-2 py-2 group hover:bg-slate-50 rounded-lg pr-2 transition-colors">
        <div className="w-6 flex justify-center shrink-0">
          {hasChildren ? (
            <button onClick={() => setIsOpen(!isOpen)} className="p-1 hover:bg-slate-200 rounded text-slate-400">
              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <div className="w-3.5" /> 
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-1.5">
            <div className="flex items-center gap-2 overflow-hidden">
               <div 
                 className={`w-2 h-2 rounded-full shrink-0 ${isZero ? 'opacity-30' : ''}`} 
                 style={{ backgroundColor: node.color || '#cbd5e1' }} 
               />
               <span className={`text-sm font-medium truncate ${isZero ? 'text-slate-400' : 'text-slate-700'}`}>
                 {node.name}
               </span>
            </div>
            <div className="text-right shrink-0 ml-4">
              <span className={`text-sm font-bold ${isZero ? 'text-slate-300' : 'text-slate-900'}`}>
                {formatEur(node.recursive_total)}
              </span>
            </div>
          </div>
          
          {/* Barre de Progression */}
          <div className="relative h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
             <div 
               className="absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out"
               style={{ 
                 width: `${percentage}%`, 
                 backgroundColor: isZero ? '#e2e8f0' : (node.color || '#64748b'),
                 opacity: 0.8
               }}
             />
          </div>
          
          {/* Info "Direct" si différent du total */}
          {node.direct_total > 0 && node.direct_total !== node.recursive_total && isOpen && (
             <p className="text-[10px] text-slate-400 mt-1 pl-4">
                Dont {formatEur(node.direct_total)} directs
             </p>
          )}
        </div>
      </div>

      {/* Récursion : Les enfants sont relatifs à MOI (node.recursive_total) */}
      {isOpen && hasChildren && (
        <div className="ml-4 pl-4 border-l border-slate-100 flex flex-col">
          {node.children.map(child => (
            <TreeNode key={child.id} node={child} maxTotal={node.recursive_total || 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function BudgetTreeView({ data }: { data: BudgetNode[] }) {
  // Pour le niveau racine, on compare au total global
  const totalRoot = data.reduce((acc, n) => acc + n.recursive_total, 0);

  if (data.length === 0) {
    return (
        <div className="p-8 text-center border border-dashed rounded-xl border-slate-200 bg-slate-50 h-full flex items-center justify-center">
            <p className="text-slate-400 text-sm">Aucune donnée budgétaire.</p>
        </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
           <FolderOpen className="w-5 h-5" />
        </div>
        <div>
            <h3 className="font-bold text-slate-900">Analyse Structurelle</h3>
            <p className="text-xs text-slate-500">Roll-up des dépenses</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 space-y-1 custom-scrollbar">
        {data.map(node => (
          <TreeNode key={node.id} node={node} maxTotal={totalRoot} />
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400 flex justify-between">
         <span>Total Analysé</span>
         <span className="font-mono font-medium">{formatEur(totalRoot)}</span>
      </div>
    </div>
  );
}