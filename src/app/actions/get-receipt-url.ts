'use server';

import { createClient } from "@/lib/supabase-server";

export async function getReceiptUrl(filePath: string) {
  const supabase = await createClient();

  // On demande une URL signée valide pour 60 minutes
  const { data, error } = await supabase
    .storage
    .from('receipts')
    .createSignedUrl(filePath, 3600);

  if (error || !data) {
    console.error("Erreur génération URL signée:", error);
    return null;
  }

  return data.signedUrl;
}