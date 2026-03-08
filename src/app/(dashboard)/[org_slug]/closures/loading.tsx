import { TableSkeletonRows } from "@/components/ui/skeleton-rows";

export default function ClosuresLoading() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse bg-slate-100 rounded-xl" />
        <div className="h-4 w-64 animate-pulse bg-slate-100 rounded" />
      </div>
      <div className="grid gap-4 grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse bg-white rounded-2xl border border-slate-200 shadow-sm"
          />
        ))}
      </div>
      <TableSkeletonRows rows={5} cols={5} />
    </div>
  );
}
