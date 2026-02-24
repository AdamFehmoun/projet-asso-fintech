export type CategoryNode = {
  id: string;
  name: string;
  color: string;
  parent_id: string | null;
  children?: CategoryNode[]; // Pour l'affichage récursif (Arbre)
  depth?: number; // Pour l'indentation visuelle
};

export type TransactionWithCategory = {
  id: string;
  amount: number;
  date: string;
  description: string;
  type: 'income' | 'expense';
  receipt_url: string | null;
  // La jointure nous donnera ça :
  budget_categories: {
    name: string;
    color: string;
    parent_id: string | null;
  } | null;
};