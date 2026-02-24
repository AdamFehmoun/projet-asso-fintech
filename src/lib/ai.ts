import OpenAI from "openai";
import { createClient } from "@/lib/supabase-server"; // 👈 Ajouté pour le Vector Search

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * OPTION QUANT A : Génération d'Embeddings (Vecteurs)
 * Transforme un texte en coordonnées mathématiques (1536 dimensions).
 */
export async function generateEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * RECHERCHE VECTORIELLE : Trouve la catégorie la plus proche mathématiquement.
 * Plus performant et 100x moins cher qu'un LLM pour du gros volume.
 */
export async function findCategoryVectorial(description: string, orgId: string) {
  const supabase = await createClient();
  
  // 1. On génère la signature mathématique de la transaction
  const queryVector = await generateEmbedding(description);

  // 2. On interroge PostgreSQL via pgvector
  const { data: matches, error } = await supabase.rpc('match_categories', {
    query_embedding: queryVector,
    match_threshold: 0.5, // Seuil de confiance à 50%
    match_count: 1,       // On veut le meilleur résultat
    org_id: orgId
  });

  if (error || !matches || matches.length === 0) {
    if (error) console.error("❌ Erreur Vector Search:", error);
    return null;
  }

  return matches[0]; // Retourne { id, name, similarity }
}

/**
 * OPTION QUANT B : Classification Dynamique (LLM GPT-4o)
 * On injecte les catégories réelles pour une précision chirurgicale sur les cas complexes.
 */
export async function categorizeTransaction(
  description: string, 
  amount: number, 
  availableCategories: string[]
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return "Non Catégorisé";

  const categoriesList = availableCategories.join(", ");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Tu es un expert-comptable pour une association. 
          Liste des catégories autorisées : [${categoriesList}].
          
          Mission : Analyse la transaction et réponds UNIQUEMENT par le nom de la catégorie la plus proche.
          Si aucune ne correspond vraiment, réponds "Autre".`
        },
        {
          role: "user",
          content: `Transaction : "${description}" (${(amount / 100).toFixed(2)} EUR)`
        }
      ],
      temperature: 0, 
      max_tokens: 20,
    });

    return response.choices[0].message.content?.trim() || "Autre";
  } catch (error) {
    console.error("Erreur OpenAI:", error);
    return "À vérifier";
  }
}