import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import OrgSwitcher from "@/components/dashboard/org-switcher";
import NavLinks from "@/components/dashboard/nav-links";
import AvatarMenu from "@/components/dashboard/avatar-menu";

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

  return (
    <div className="min-h-screen bg-[#0A0A0F]">

      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/60 bg-[#0A0A0F]/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-6 h-14 max-w-screen-xl mx-auto">

          {/* Left : Logo cliquable + Switcher */}
          <div className="flex items-center gap-3">
            <Link href={`/${org_slug}`} className="group flex items-center gap-2">
              <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center group-hover:bg-indigo-500 transition-colors">
                <span className="text-white font-bold text-xs">B</span>
              </div>
            </Link>
            <span className="text-zinc-700 text-sm hidden sm:block">/</span>
            <OrgSwitcher orgs={orgs} currentSlug={org_slug} />
          </div>

          {/* Right : Nav + Role badge + Avatar */}
          <div className="flex items-center gap-5">
            <NavLinks orgSlug={org_slug} />
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
            <AvatarMenu email={user.email ?? ""} />
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
