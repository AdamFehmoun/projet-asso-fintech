import { CardsGridSkeleton } from "@/components/ui/skeleton-rows";

export default function SettingsLoading() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <div className="h-8 w-40 animate-pulse bg-slate-100 rounded-xl" />
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse bg-slate-100 rounded-xl" />
        ))}
      </div>
      <CardsGridSkeleton count={4} />
    </div>
  );
}
