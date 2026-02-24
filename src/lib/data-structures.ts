import { CategoryNode } from "@/types/budget";

/**
 * Transforme une liste plate SQL en structure d'arbre récursive.
 * Complexité : O(n) - Très performant.
 */
export function buildCategoryTree(categories: any[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];

  // 1. Initialisation de la Map pour accès O(1)
  categories.forEach((cat) => {
    map.set(cat.id, { ...cat, children: [], depth: 0 });
  });

  // 2. Construction des liens Parent-Enfant
  categories.forEach((cat) => {
    const node = map.get(cat.id);
    if (!node) return;

    if (cat.parent_id && map.has(cat.parent_id)) {
      const parent = map.get(cat.parent_id);
      // On calcule la profondeur pour l'indentation visuelle
      node.depth = (parent?.depth || 0) + 1;
      parent?.children?.push(node);
    } else {
      // Si pas de parent, c'est une racine (Niveau 0)
      roots.push(node);
    }
  });

  return roots;
}