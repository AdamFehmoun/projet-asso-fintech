import { createStripeConnectAccount } from "./actions";
import { createClient } from "@/lib/supabase-server";

export default async function SettingsPage({ params }: { params: { org_slug: string } }) {
  const { org_slug } = await params;
  const supabase = await createClient();

  // Récupérer l'état actuel
  const { data: org } = await supabase
    .from('organizations')
    .select('stripe_account_id')
    .eq('slug', org_slug)
    .single();
    
  const isConnected = !!org?.stripe_account_id;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Paramètres de l'association</h1>
      
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="font-semibold text-lg mb-2">Compte Bancaire</h2>
        <p className="text-slate-500 text-sm mb-6">
          Pour vendre des billets et encaisser des cotisations, vous devez connecter le compte bancaire de l'association via notre partenaire sécurisé Stripe.
        </p>

        {isConnected ? (
          <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-lg flex items-center gap-2">
            ✅ Compte Stripe connecté (ID: {org.stripe_account_id})
          </div>
        ) : (
          <form action={createStripeConnectAccount.bind(null, org_slug)}>
            <button 
              type="submit"
              className="bg-[#635BFF] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#5851E3] transition flex items-center gap-2"
            >
              Connecter avec Stripe
            </button>
          </form>
        )}
      </div>
    </div>
  );
}