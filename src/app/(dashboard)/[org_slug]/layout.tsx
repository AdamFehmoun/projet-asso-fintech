import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import OrgSwitcher from "@/components/dashboard/org-switcher";

type Props = {
  children: React.ReactNode;
  params: Promise<{ org_slug: string }>;
};

export default async function DashboardLayout({ children, params }: Props) {
  const { org_slug } = await params;
  const supabase = await createClient();

  // 1. Vérifier l'authentification
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 2. Vérifier le membership pour cet org_slug spécifique
  const { data: membership } = await supabase
    .from("members")
    .select("status, role, organizations!inner(id, name, slug)")
    .eq("user_id", user.id)
    .eq("organizations.slug", org_slug)
    .single();

  // Pas membre → onboarding
  if (!membership) redirect("/onboarding");

  // Membre pending → page d'attente
  if (membership.status === "pending") redirect("/onboarding/pending");

  // 3. Récupérer toutes les orgs actives pour le switcher
  const { data: memberships } = await supabase
    .from("members")
    .select("organizations(id, name, slug)")
    .eq("user_id", user.id)
    .eq("status", "active");

  const orgs = (memberships ?? [])
    .map((m) => {
      const org = Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
      return org as { id: string; name: string; slug: string } | null;
    })
    .filter(Boolean) as { id: string; name: string; slug: string }[];

  // 4. Données de l'org courante
  const currentOrg = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;

  return (
    <div className="min-h-screen bg-[#0A0A0F]">

      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/60 bg-[#0A0A0F]/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-6 h-14 max-w-screen-xl mx-auto">

          {/* Left : Brand + Switcher */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 mr-2">
              <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-xs">B</span>
              </div>
              <span className="text-zinc-600 text-sm hidden sm:block">/</span>
            </div>
            <OrgSwitcher orgs={orgs} currentSlug={org_slug} />
          </div>

          {/* Right : Nav + Role badge + user */}
          <div className="flex items-center gap-4">
            <Link
              href={`/${org_slug}/audit`}
              className="text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Audit
            </Link>
            <span className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${
              membership.role === "owner"
                ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                : membership.role === "admin"
                ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                : membership.role === "tresorier"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-zinc-800 border-zinc-700 text-zinc-400"
            }`}>
              {membership.role}
            </span>
            <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <span className="text-xs font-medium text-zinc-400">
                {user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>

        </div>
      </header>

      {/* Contenu */}
      <main className="max-w-screen-xl mx-auto px-6 py-6">
        {children}
      </main>

    </div>
  );
}