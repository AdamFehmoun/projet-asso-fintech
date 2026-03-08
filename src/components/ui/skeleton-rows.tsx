function SkeletonBox({
  className = "",
  dark = false,
}: {
  className?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`animate-pulse rounded ${dark ? "bg-zinc-800" : "bg-slate-100"} ${className}`}
    />
  );
}

type SkeletonProps = { dark?: boolean };

/** 4 KPI stat cards in a responsive grid */
export function StatsSkeletonCards({
  count = 4,
  dark = false,
}: SkeletonProps & { count?: number }) {
  const card = dark
    ? "bg-zinc-900 border-zinc-800"
    : "bg-white border-slate-200";
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`p-6 rounded-2xl shadow-sm border ${card} space-y-3`}>
          <SkeletonBox dark={dark} className="h-3 w-20" />
          <SkeletonBox dark={dark} className="h-8 w-32" />
        </div>
      ))}
    </div>
  );
}

/** Generic table skeleton */
export function TableSkeletonRows({
  rows = 8,
  cols = 5,
  dark = false,
}: SkeletonProps & { rows?: number; cols?: number }) {
  const wrap = dark ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200";
  const head = dark ? "bg-zinc-900/50 border-zinc-800" : "bg-slate-50/50 border-slate-100";
  const row  = dark ? "border-zinc-800" : "border-slate-100";

  return (
    <div className={`rounded-2xl shadow-sm border overflow-hidden ${wrap}`}>
      <div className={`px-6 py-5 border-b ${head}`}>
        <SkeletonBox dark={dark} className="h-5 w-36" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={`border-b ${head}`}>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-6 py-4">
                  <SkeletonBox dark={dark} className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className={`border-b last:border-0 ${row}`}>
                {Array.from({ length: cols }).map((_, j) => (
                  <td key={j} className="px-6 py-4">
                    <SkeletonBox
                      dark={dark}
                      className={`h-4 ${
                        j === 0 ? "w-20" :
                        j === 1 ? "w-40" :
                        j === cols - 1 ? "w-16" : "w-24"
                      }`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Grid of card skeletons (categories, members, etc.) */
export function CardsGridSkeleton({
  count = 6,
  dark = false,
}: SkeletonProps & { count?: number }) {
  const card = dark ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200";
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`p-6 rounded-2xl border shadow-sm space-y-3 ${card}`}>
          <div className="flex items-center justify-between">
            <SkeletonBox dark={dark} className="h-4 w-28" />
            <SkeletonBox dark={dark} className="h-6 w-16 rounded-full" />
          </div>
          <SkeletonBox dark={dark} className="h-3 w-full" />
          <SkeletonBox dark={dark} className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}

/** Two chart placeholder boxes side by side */
export function ChartsSkeletonGrid({ dark = false }: SkeletonProps) {
  const card = dark ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200";
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} className={`p-6 rounded-2xl border shadow-sm ${card}`}>
          <SkeletonBox dark={dark} className="h-5 w-32 mb-6" />
          <SkeletonBox dark={dark} className="h-52 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}
