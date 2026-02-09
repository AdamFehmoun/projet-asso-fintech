"use client";

import { Bar, BarChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export function CashflowChart({ data }: { data: any[] }) {
  // Configuration des couleurs Shadcn
  const chartConfig = {
    income: { label: "Entrées", color: "#10b981" }, // Emerald 500
    expense: { label: "Sorties", color: "#ef4444" }, // Red 500
  };

  return (
    <div className="h-[300px] w-full">
      <ChartContainer config={chartConfig} className="h-full w-full">
        <BarChart data={data}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="month" 
            tickLine={false} 
            axisLine={false} 
            tickMargin={10} 
            tickFormatter={(value) => value.slice(0, 3)} 
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} name="Recettes" />
          <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} name="Dépenses" />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
