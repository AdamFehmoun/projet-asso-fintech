import { createStripeConnectAccount, getCategories } from "./actions";
import { createClient } from "@/lib/supabase-server";
import { FolderTree, CreditCard, CheckCircle, Sparkles, Gavel } from "lucide-react";
import { CategoryList } from "@/components/settings/category-list"; 
import { AiSyncButton } from "@/components/settings/ai-sync-button"; 
import { RuleManager } from "@/components/settings/rule-manager"; 
import { Separator } from "@/components/ui/separator";

export default async function SettingsPage({ 
  params 
}: { 
  params: Promise<{ org_slug: string }> 
}) {
  const { org_slug } = await params;
  const supabase = await createClient();

  // 1. Récupération des données Org et Stripe
  const { data: org } = await supabase
    .from('organizations')
    .select('id, stripe_account_id, name')
    .eq('slug', org_slug)
    .single();
    
  if (!org) return <div className="p-8 text-red-500">Organisation introuvable</div>;
  const isConnected = !!org?.stripe_account_id;

  // 2. Récupération des données pour l'automatisation
  // On récupère les catégories à plat pour le sélecteur de règles
  const { data: flatCategories } = await supabase
    .from('budget_categories')
    .select('id, name')
    .eq('organization_id', org.id)
    .order('name');

  // On récupère les règles existantes
  const { data: rules } = await supabase
    .from('budget_rules')
    .select(`
      id, 
      pattern, 
      category_id,
      budget_categories ( name )
    `)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false });

  // 3. Récupération de l'arbre complet pour l'affichage (Plan Comptable)
  const categoryTree = await getCategories(org_slug);

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-12 pb-20">
      
      {/* --- EN-TÊTE --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Paramètres</h1>
          <p className="text-slate-500">Configuration de l'espace {org?.name}</p>
        </div>
      </div>
      
      {/* --- SECTION 1 : TRÉSORERIE (STRIPE) --- */}
      <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-slate-800">Trésorerie & Connectivité</h2>
            <p className="text-xs text-slate-500">Gérez vos comptes Stripe pour les paiements en ligne.</p>
          </div>
        </div>
        
        {isConnected ? (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-bold text-sm">Compte Stripe Connecté</p>
                <p className="text-xs opacity-80 font-mono mt-0.5">ID: {org.stripe_account_id}</p>
              </div>
            </div>
            <span className="text-[10px] bg-emerald-200/50 px-3 py-1 rounded-full uppercase font-black tracking-widest">Actif</span>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-100 p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-800">Activez les paiements</p>
              <p className="text-xs text-slate-500 max-w-md">Connectez Stripe pour vendre des billets et encaisser des cotisations.</p>
            </div>
            <form action={createStripeConnectAccount.bind(null, org_slug)}>
              <button type="submit" className="bg-[#635BFF] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#5851E3] transition shadow-md text-sm whitespace-nowrap">
                Connecter Stripe
              </button>
            </form>
          </div>
        )}
      </section>

      {/* --- GRID PRINCIPALE (LAYOUT 1/3 - 2/3) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* --- COLONNE GAUCHE : AUTOMATISATION (4/12) --- */}
        <div className="lg:col-span-4 space-y-8">
            
            {/* Classification IA */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-slate-800">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <h2 className="font-bold text-sm uppercase tracking-wide">Classification IA</h2>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                    Synchronisez vos catégories avec le moteur vectoriel pour permettre à l'IA de reconnaître automatiquement vos tickets.
                </p>
                <AiSyncButton />
            </div>

            {/* Règles Métier */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-slate-800">
                    <Gavel className="w-4 h-4 text-emerald-500" />
                    <h2 className="font-bold text-sm uppercase tracking-wide">Règles Métier</h2>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                    Définissez des règles strictes (ex: "Uber" = Transport) pour contourner l'IA et garantir une précision de 100%.
                </p>
                <RuleManager 
                    categories={flatCategories || []} 
                    initialRules={rules || []} 
                    orgSlug={org_slug} 
                />
            </div>
        </div>

        {/* --- COLONNE DROITE : PLAN COMPTABLE (8/12) --- */}
        <div className="lg:col-span-8">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                            <FolderTree className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg text-slate-800">Plan Comptable</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Taxonomie Hiérarchique</p>
                        </div>
                    </div>
                    {/* Le bouton d'ajout est géré à l'intérieur du composant CategoryList */}
                </div>

                <div className="p-6 flex-1">
                    <CategoryList initialData={categoryTree} orgSlug={org_slug} />
                    
                    <div className="mt-8 pt-4 border-t flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-[9px] text-slate-400 font-mono font-bold uppercase tracking-widest">Live Sync Active</span>
                        </div>
                        <span className="text-[9px] text-slate-300 font-mono font-bold uppercase">{categoryTree.length} Nodes Loaded</span>
                    </div>
                </div>
            </section>
        </div>
      </div>
    </div>
  );
}