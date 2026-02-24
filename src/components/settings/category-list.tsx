'use client';

import { useState, useId } from "react";
import { useParams } from "next/navigation";
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragEndEvent 
} from "@dnd-kit/core";
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { 
  GripVertical, 
  Plus, 
  Trash2, 
  CornerDownRight, 
  CheckCircle 
} from "lucide-react";
import { createCategory, deleteCategory, updateCategoryOrder } from "@/app/(dashboard)/[org_slug]/settings/actions";
import { toast } from "sonner";

// --- TYPES & UTILS ---

type CategoryNode = {
  id: string;
  name: string;
  color: string;
  children?: CategoryNode[];
  parent_id: string | null;
  depth?: number;
};

// Aplatit l'arbre pour le rendre compatible avec une liste Sortable verticale
const flattenTree = (nodes: CategoryNode[], depth = 0): CategoryNode[] => {
  return nodes.reduce((acc, node) => {
    const flatNode = { ...node, depth };
    const children = node.children ? flattenTree(node.children, depth + 1) : [];
    return [...acc, flatNode, ...children];
  }, [] as CategoryNode[]);
};

// --- COMPOSANT PRINCIPAL ---

export function CategoryList({ initialData }: { initialData: CategoryNode[] }) {
  const [items, setItems] = useState(() => flattenTree(initialData));
  const [isAddingRoot, setIsAddingRoot] = useState(false);
  const params = useParams();
  const orgSlug = params.org_slug as string;
  
  const dndContextId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // Évite le drag accidentel au click
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      
      // Mise à jour Optimistic
      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);

      // Sauvegarde serveur
      try {
        const updates = newItems.map((item, index) => ({
          id: item.id,
          rank: index,
        }));
        await updateCategoryOrder(updates, orgSlug);
      } catch (error) {
        toast.error("Erreur lors de la réorganisation");
        console.error(error);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Bouton d'ajout racine */}
      <button 
        onClick={() => setIsAddingRoot(true)}
        className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-800 flex items-center gap-2 px-2"
      >
        <Plus className="w-4 h-4" /> Ajouter une catégorie principale
      </button>

      {isAddingRoot && (
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mb-4 animate-in fade-in slide-in-from-top-2">
           <AddCategoryForm 
             parentId={null} 
             orgSlug={orgSlug} 
             onClose={() => setIsAddingRoot(false)} 
           />
        </div>
      )}

      {/* Liste Drag & Drop */}
      <DndContext 
        id={dndContextId}
        sensors={sensors} 
        collisionDetection={closestCenter} 
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={items.map(i => i.id)} 
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-1">
            {items.map((cat) => (
              <SortableCategoryItem 
                key={cat.id} 
                category={cat} 
                orgSlug={orgSlug}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {items.length === 0 && !isAddingRoot && (
        <div className="text-center py-10 text-slate-400 text-xs border-2 border-dashed border-slate-100 rounded-xl">
            Aucune catégorie définie.
        </div>
      )}
    </div>
  );
}

// --- SOUS-COMPOSANT : L'ITEM DRAGGABLE ---

function SortableCategoryItem({ category, orgSlug }: { category: CategoryNode, orgSlug: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginLeft: `${(category.depth || 0) * 24}px`, // Indentation visuelle
    opacity: isDragging ? 0.5 : 1,
  };

  const [isAddingChild, setIsAddingChild] = useState(false);

  return (
    <div className="group">
        <div 
            ref={setNodeRef} 
            style={style} 
            className="flex items-center py-2 px-3 bg-white hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg mb-1 transition-colors relative"
        >
            {/* Poignée de Drag */}
            <div {...attributes} {...listeners} className="cursor-grab text-slate-300 hover:text-slate-600 mr-2">
                <GripVertical className="w-4 h-4" />
            </div>

            {/* Pastille Couleur */}
            <div 
                className="w-3 h-3 rounded-full mr-3 shrink-0 shadow-sm" 
                style={{ backgroundColor: category.color }} 
            />

            {/* Nom */}
            <span className="text-sm font-medium text-slate-700 flex-1">
                {category.name}
            </span>

            {/* Actions (CRUD) */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                    onClick={() => setIsAddingChild(true)}
                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition"
                    title="Ajouter une sous-catégorie"
                >
                    <Plus className="w-3.5 h-3.5" />
                </button>
                <button 
                    onClick={async () => {
                        if(confirm(`Supprimer "${category.name}" ?`)) {
                            await deleteCategory(category.id, orgSlug);
                            toast.success("Supprimé");
                        }
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                    title="Supprimer"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>

        {/* Formulaire d'ajout enfant (Hors du drag context visuel) */}
        {isAddingChild && (
            <div 
                style={{ marginLeft: `${((category.depth || 0) + 1) * 24}px` }} 
                className="mb-2 py-1 animate-in fade-in slide-in-from-left-2"
            >
                <AddCategoryForm 
                    parentId={category.id} 
                    orgSlug={orgSlug} 
                    onClose={() => setIsAddingChild(false)} 
                />
            </div>
        )}
    </div>
  );
}

// --- FORMULAIRE D'AJOUT ---

function AddCategoryForm({ parentId, orgSlug, onClose }: any) {
    return (
        <form action={async (formData) => {
            await createCategory(formData);
            toast.success("Catégorie créée !");
            onClose();
        }} className="flex items-center gap-2">
            <CornerDownRight className="w-4 h-4 text-slate-300" />
            <input type="hidden" name="org_slug" value={orgSlug} />
            <input type="hidden" name="parent_id" value={parentId || 'root'} />
            
            <input 
                name="name" 
                placeholder="Nom..." 
                className="px-2 py-1 text-sm border rounded bg-white focus:ring-2 focus:ring-indigo-500 outline-none w-48 shadow-sm"
                autoFocus 
                required
            />
            <input 
                name="color" 
                type="color" 
                className="w-8 h-8 p-0 border-none rounded cursor-pointer shadow-sm"
                defaultValue="#6366f1"
            />
            <button type="submit" className="p-1.5 bg-emerald-500 text-white rounded hover:bg-emerald-600 transition shadow-sm">
                <CheckCircle className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600">
                x
            </button>
        </form>
    );
}