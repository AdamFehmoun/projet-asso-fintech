import { createClient } from "@/lib/supabase-server";
import { generateEmbedding } from "@/lib/ai";

export async function syncCategoriesToVectors(org_slug: string) {
  const supabase = await createClient();

  // 1. Récupérer l'orga
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', org_slug)
    .single();

  if (!org) throw new Error("Organisation introuvable");

  // 2. Récupérer toutes les catégories
  const { data: categories } = await supabase
    .from('budget_categories')
    .select('id, name')
    .eq('organization_id', org.id);

  if (!categories || categories.length === 0) return 0;

  console.log(`📡 Synchronisation vectorielle : ${categories.length} catégories à traiter...`);

  // 3. Pipeline Quant : Parallélisation massive des appels OpenAI
  const updates = await Promise.all(
    categories.map(async (cat) => {
      try {
        const vector = await generateEmbedding(cat.name);
        return { id: cat.id, embedding: vector };
      } catch (err) {
        console.error(`❌ Échec embedding pour "${cat.name}":`, err);
        return null;
      }
    })
  );

  const validUpdates = updates.filter((u): u is { id: string; embedding: number[] } => u !== null);

  // 4. Update en batch (Séquentiel pour éviter de saturer les connexions DB)
  for (const update of validUpdates) {
    await supabase
      .from('budget_categories')
      .update({ embedding: update.embedding })
      .eq('id', update.id);
  }

  console.log(`✅ ${validUpdates.length} catégories vectorisées avec succès.`);
  return validUpdates.length;
}