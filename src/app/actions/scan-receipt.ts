'use server';

import { createClient } from "@/lib/supabase-server";
import OpenAI from "openai";

// On enlève les imports Zod spécifiques à la beta pour éviter les erreurs
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function scanReceipt(formData: FormData) {
  const file = formData.get('file') as File;
  if (!file) throw new Error("Aucun fichier trouvé");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  // 1. Upload de l'image
  const filePath = `${user.id}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(filePath, file);

  if (uploadError) throw new Error("Erreur upload: " + uploadError.message);

  // 2. URL temporaire
  const { data: signedUrlData } = await supabase.storage
    .from('receipts')
    .createSignedUrl(filePath, 60);

  if (!signedUrlData) throw new Error("Erreur génération URL");

  // 3. Appel GPT-4o (Mode JSON Standard - Compatible toutes versions)
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        {
          role: "system",
          content: `Tu es un expert-comptable. Analyse ce ticket.
          Réponds UNIQUEMENT avec un objet JSON valide (pas de markdown, pas de texte avant/après).
          
          Structure attendue :
          {
            "date": "YYYY-MM-DD",
            "amount": 0.00 (nombre),
            "description": "Nom du commerçant + objet",
            "category": "Une catégorie parmi: Alimentation, Transport, Matériel, Prestation, Cotisation, Autre"
          }
          
          Si une info est illisible, mets null ou 0.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extrais les données :" },
            { type: "image_url", image_url: { url: signedUrlData.signedUrl } },
          ],
        },
      ],
      // C'est ça l'astuce : on force le mode JSON natif sans passer par la beta
      response_format: { type: "json_object" }, 
      max_tokens: 300,
    });

    const content = response.choices[0].message.content;
    
    if (!content) throw new Error("Réponse vide de l'IA");

    const result = JSON.parse(content);

    // 4. On renvoie les données + le chemin
    return {
      success: true,
      amount: result.amount,
      date: result.date,
      description: result.description,
      category: result.category,
      receipt_path: filePath, 
    };

  } catch (error: any) {
    console.error("Erreur OpenAI:", error);
    return { error: "Lecture impossible: " + error.message };
  }
}