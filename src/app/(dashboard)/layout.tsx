import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar Gauche */}
      <aside className="hidden w-64 flex-col border-r bg-white md:flex">
        <div className="flex h-16 items-center border-b px-6 font-bold text-xl">
          Fintech Asso 💸
        </div>
        <nav className="flex-1 space-y-1 p-4">
          <Link href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 hover:bg-slate-100 hover:text-gray-900">
            📊 Vue d'ensemble
          </Link>
          <Link href="#" className="flex items-center gap-3 rounded-lg bg-slate-100 px-3 py-2 text-gray-900 font-medium">
            💰 Budget & Tréso
          </Link>
          <Link href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 hover:bg-slate-100 hover:text-gray-900">
            👥 Membres
          </Link>
          <Link href="#" className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 hover:bg-slate-100 hover:text-gray-900">
            ⚙️ Paramètres
          </Link>
        </nav>
      </aside>

      {/* Contenu Principal */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
