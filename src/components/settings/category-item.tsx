'use client';

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Folder, Trash2, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils"; // Assure-toi d'avoir cette fonction utilitaire, sinon utilise clsx

interface CategoryItemProps {
  category: any;
  depth: number;
}

export function CategoryItem({ category, depth }: CategoryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginLeft: `${depth * 24}px`, // 👈 L'indentation visuelle de l'arbre
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg mb-2 transition-all",
        isDragging && "opacity-50 border-dashed border-slate-400 bg-slate-50 z-50 relative"
      )}
    >
      {/* Poignée de Drag & Drop */}
      <div {...attributes} {...listeners} className="cursor-grab text-slate-400 hover:text-slate-600">
        <GripVertical className="w-5 h-5" />
      </div>

      {/* Icône et Couleur */}
      <div 
        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm"
        style={{ backgroundColor: category.color }}
      >
        {category.name.charAt(0).toUpperCase()}
      </div>

      {/* Nom */}
      <div className="flex-grow">
        <p className="font-medium text-slate-900">{category.name}</p>
        <p className="text-xs text-slate-400">ID: {category.id.slice(0, 8)}...</p>
      </div>

      {/* Actions (Edit / Delete) */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="p-2 hover:bg-slate-100 rounded-md text-slate-500">
          <Edit2 className="w-4 h-4" />
        </button>
        <button className="p-2 hover:bg-red-50 rounded-md text-red-500">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}