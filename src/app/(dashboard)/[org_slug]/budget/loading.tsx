import {
  StatsSkeletonCards,
  ChartsSkeletonGrid,
  TableSkeletonRows,
} from "@/components/ui/skeleton-rows";

export default function BudgetLoading() {
  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-10">
      <div className="flex justify-between items-center gap-4">
        <div className="space-y-2">
          <div className="h-9 w-56 animate-pulse bg-slate-100 rounded-xl" />
          <div className="h-4 w-40 animate-pulse bg-slate-100 rounded" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-28 animate-pulse bg-slate-100 rounded-xl" />
          <div className="h-10 w-44 animate-pulse bg-slate-100 rounded-xl" />
        </div>
      </div>
      <StatsSkeletonCards count={4} />
      <ChartsSkeletonGrid />
      <TableSkeletonRows rows={10} cols={5} />
    </div>
  );
}
