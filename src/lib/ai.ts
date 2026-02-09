import OpenAI from "openai";

// On initialise le client OpenAI seulement si la clé existe
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function categorizeTransaction(description: string, amount: number): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ Erreur : Pas de clé API OpenAI trouvée.");
    return "Non Catégorisé (Erreur API)";
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Ou "gpt-3.5-turbo" si tu veux payer moins cher
      messages: [
        {
          role: "system",
          // LE PROMPT "QUANT" : On lui donne le contexte métier strict
          content: `Tu es un expert-comptable français pour une association étudiante.
          Ta mission : Analyser l'intitulé d'une transaction bancaire et lui assigner la catégorie la plus pertinente.
          
          Voici ta liste de catégories autorisées (Plan Comptable Simplifié) :
          - Transport (Uber, Train, Essence, Péage)
          - Alimentation (Courses, Resto, Boulangerie)
          - Événementiel (Location salle, Sonorisation, Décoration)
          - Logiciels & Tech (Abonnements, Hébergement web, Matériel info)
          - Frais Bancaires (Commissions, Agios)
          - Assurances
          - Honoraires
          - Autre

          Règle stricte : Réponds UNIQUEMENT par le nom de la catégorie. Pas de phrase, pas de ponctuation.`
        },
        {
          role: "user",
          content: `Intitulé transaction : "${description}". Montant : ${amount} EUR.`
        }
      ],
      temperature: 0.1, // Très faible pour éviter qu'il soit "créatif". On veut de la rigueur.
      max_tokens: 10,
    });

    const category = response.choices[0].message.content;
    return category || "Autre";

  } catch (error) {
    console.error("Erreur OpenAI:", error);
    return "À vérifier manuellement";
  }
}
