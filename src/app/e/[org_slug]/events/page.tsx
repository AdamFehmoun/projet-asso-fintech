import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Event = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  date: string;
};

export default async function PublicEventsPage({
  params,
}: {
  params: Promise<{ org_slug: string }>;
}) {
  const { org_slug } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Récupère l'org par slug
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("slug", org_slug)
    .single();

  if (!org) notFound();

  // Événements des 30 prochains jours
  const now = new Date();
  const in30days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { data: events } = await supabase
    .from("events")
    .select("id, title, description, price, date")
    .eq("organization_id", org.id)
    .gte("date", now.toISOString())
    .lte("date", in30days.toISOString())
    .order("date", { ascending: true })
    .returns<Event[]>();

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-zinc-100 px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* En-tête */}
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            {org.name}
          </p>
          <h1 className="text-2xl font-bold text-white">Événements à venir</h1>
          <p className="text-sm text-zinc-500">30 prochains jours</p>
        </div>

        {/* Liste */}
        {!events || events.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-6 py-12 text-center">
            <p className="text-zinc-500 text-sm">Aucun événement prévu dans les 30 prochains jours.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {events.map((event) => {
              const dateObj = new Date(event.date);
              const dateStr = dateObj.toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              });
              const timeStr = dateObj.toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const priceStr =
                event.price === 0
                  ? "Gratuit"
                  : `${(event.price / 100).toLocaleString("fr-FR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} €`;

              return (
                <li
                  key={event.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-2"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="font-semibold text-white leading-snug">{event.title}</h2>
                    <span
                      className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${
                        event.price === 0
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                      }`}
                    >
                      {priceStr}
                    </span>
                  </div>

                  {event.description && (
                    <p className="text-sm text-zinc-400 leading-relaxed">{event.description}</p>
                  )}

                  <p className="text-xs text-zinc-500 capitalize">
                    {dateStr} · {timeStr}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
// force redeploy
