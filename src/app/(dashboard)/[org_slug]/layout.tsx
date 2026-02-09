import Link from "next/link";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org_slug: string }>;
}) {
  // 1. On attend les paramètres
  const resolvedParams = await params;
  const org_slug = resolvedParams?.org_slug;

  // 2. Sécurité : si org_slug est absent, on ne rend pas des liens cassés
  if (!org_slug) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-64 flex-col border-r bg-white md:flex">
        <div className="flex h-16 items-center border-b px-6 font-bold text-xl">
          Fintech Asso 💸
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <Link 
            href={`/${org_slug}`} 
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 hover:bg-slate-100 hover:text-gray-900"
          >
            📊 Vue d'ensemble
          </Link>
          
          <Link 
            href={`/${org_slug}/budget`} 
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 hover:bg-slate-100 hover:text-gray-900"
          >
            💰 Budget & Tréso
          </Link>
          
          <Link 
            href={`/${org_slug}/members`} 
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 hover:bg-slate-100 hover:text-gray-900"
          >
            👥 Membres
          </Link>
          
          <Link 
            href={`/${org_slug}/settings`} 
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 hover:bg-slate-100 hover:text-gray-900"
          >
            ⚙️ Paramètres
          </Link>
        </nav>
      </aside>

      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}