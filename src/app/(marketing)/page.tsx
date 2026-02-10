import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-slate-50">
      <div className="text-center">
        <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight">
          Projet B Fintech 🚀
        </h1>
        <p className="mt-4 text-xl text-slate-600">
          La plateforme de gestion financière pour l'ESIEE.
        </p>
        <div className="mt-8">
          <Link 
            href="/login" 
            className="rounded-md bg-blue-600 px-6 py-3 text-white font-semibold hover:bg-blue-700 transition"
          >
            Accéder à l'Espace Trésorier
          </Link>
        </div>
      </div>
    </main>
  );
}
