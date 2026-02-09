import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  // 1. On vérifie que le user est connecté
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  // 2. Server Action pour créer l'asso
  async function createOrganization(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const name = formData.get("name") as string;
    // On crée un slug simple (ex: "ESIEE Maroc" -> "esiee-maroc")
    const slug = name.toLowerCase().replace(/ /g, "-").replace(/[^\w-]+/g, "");

    // A. Créer l'organisation
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert([{ name, slug }])
      .select()
      .single();

    if (orgError) {
      console.error(orgError);
      return; // Gérer l'erreur proprement plus tard
    }

    // B. Ajouter le créateur comme ADMIN
    const { error: memberError } = await supabase
      .from("members")
      .insert([{ user_id: user.id, organization_id: org.id, role: "admin" }]);

    if (memberError) console.error(memberError);

    // C. Redirection vers le dashboard
    redirect(`/${slug}/budget`);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-lg bg-white p-8 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold mb-2">Bienvenue, {user.email} 👋</h1>
        <p className="text-gray-600 mb-8">Pour commencer, créons ton espace association.</p>

        <form action={createOrganization} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nom de l'association</label>
            <input 
              name="name" 
              type="text" 
              placeholder="Ex: ESIEE Maroc, BDE 2026..." 
              required 
              className="w-full p-3 border rounded-lg"
            />
          </div>
          <button type="submit" className="w-full bg-black text-white p-3 rounded-lg font-bold hover:bg-gray-800 transition">
            Créer mon espace & Accéder au Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}
