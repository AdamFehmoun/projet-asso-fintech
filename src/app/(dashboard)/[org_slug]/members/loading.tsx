import { TableSkeletonRows } from "@/components/ui/skeleton-rows";

export default function MembersLoading() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="h-8 w-64 animate-pulse bg-zinc-800 rounded-xl mb-6" />
      <TableSkeletonRows rows={6} cols={3} dark />
    </div>
  );
}
