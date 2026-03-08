import { TableSkeletonRows } from "@/components/ui/skeleton-rows";

export default function AuditLoading() {
  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 animate-pulse bg-zinc-800 rounded-xl" />
          <div className="space-y-2">
            <div className="h-7 w-48 animate-pulse bg-zinc-800 rounded-xl" />
            <div className="h-4 w-64 animate-pulse bg-zinc-800 rounded" />
          </div>
        </div>
        <div className="h-8 w-24 animate-pulse bg-zinc-800 rounded-lg" />
      </div>
      <div className="h-14 animate-pulse bg-amber-500/10 rounded-xl border border-amber-500/15" />
      <TableSkeletonRows rows={8} cols={6} dark />
    </div>
  );
}
