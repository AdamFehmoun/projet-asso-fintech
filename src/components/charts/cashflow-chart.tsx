"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent,
  type ChartConfig 
} from "@/components/ui/chart";

export function CashflowChart({ data }: { data: any[] }) {
  // Configuration des couleurs (Shadcn UI Chart)
  const chartConfig = {
    income: {
      label: "Entrées",
      color: "#10b981", // Emerald 500
    },
    expense: {
      label: "Sorties",
      color: "#ef4444", // Red 500
    },
  } satisfies ChartConfig;

  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center border border-dashed rounded-xl bg-slate-50">
        <p className="text-slate-400 text-sm">Pas assez de données</p>
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ChartContainer config={chartConfig} className="h-full w-full">
        <BarChart accessibilityLayer data={data}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="month"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tickFormatter={(value) => value.slice(0, 3)} // Jan, Fev...
          />
          <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
          <Bar 
            dataKey="income" 
            fill="var(--color-income)" 
            radius={[4, 4, 0, 0]} 
            name="Recettes" 
          />
          <Bar 
            dataKey="expense" 
            fill="var(--color-expense)" 
            radius={[4, 4, 0, 0]} 
            name="Dépenses" 
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}