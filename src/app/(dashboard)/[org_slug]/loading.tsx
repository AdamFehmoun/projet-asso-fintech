import { StatsSkeletonCards, ChartsSkeletonGrid } from "@/components/ui/skeleton-rows";

export default function DashboardLoading() {
  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse bg-slate-100 rounded-xl" />
          <div className="h-4 w-32 animate-pulse bg-slate-100 rounded" />
        </div>
        <div className="h-7 w-28 animate-pulse bg-slate-100 rounded-full" />
      </div>
      <StatsSkeletonCards count={3} />
      <ChartsSkeletonGrid />
    </div>
  );
}
