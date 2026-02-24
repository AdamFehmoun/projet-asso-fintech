'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { BudgetNode } from "@/app/(dashboard)/[org_slug]/budget/analytics-actions";

const formatEur = (val: number) => 
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val);

export function ExpenseDonutChart({ data }: { data: BudgetNode[] }) {
  // On filtre pour ne garder que les catégories qui ont des dépenses > 0
  const chartData = data
    .filter(node => node.recursive_total > 0)
    .map(node => ({
      name: node.name,
      value: node.recursive_total / 100, // Conversion centimes -> euros
      color: node.color
    }));

  if (chartData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-slate-400 italic text-sm">
        Aucune donnée de dépense à analyser
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || '#64748b'} stroke="none" />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => formatEur(value)}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          />
          <Legend 
            verticalAlign="bottom" 
            align="center"
            iconType="circle"
            wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}