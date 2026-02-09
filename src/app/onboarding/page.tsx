import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { createOrganization } from "./actions"; 

export default async function OnboardingPage() {
  const supabase = await createClient();

  // 1. Qui est connecté ?
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 2. LE VIGILE 👮‍♂️ : Est-ce qu'il a déjà une asso ?
  const { data: member } = await supabase
    .from("members")
    .select("organizations(slug)") // On va chercher le slug de son asso
    .eq("user_id", user.id)
    .single();

  // 3. SI OUI -> Oust ! Direction le dashboard.
  if (member && member.organizations) {
    // @ts-ignore (TypeScript peut être capricieux sur les jointures)
    const slug = member.organizations.slug;
    redirect(`/${slug}/budget`);
  }

  // 4. SI NON -> On affiche le formulaire de création (Ton code actuel)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm p-8 border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Bienvenue ! 👋
          </h1>
          <p className="text-gray-500">
            Pour commencer, créons ton espace association.
          </p>
        </div>

        <form action={createOrganization} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom de l'association
            </label>
            <input
              name="orgName"
              type="text"
              required
              placeholder="Ex: ESIEE Maroc, BDE 2026..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition transform active:scale-95"
          >
            Créer mon espace & Accéder au Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}