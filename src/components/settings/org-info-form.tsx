'use client';

import { useTransition } from "react";
import { toast } from "sonner";
import { updateOrgSettings } from "@/app/(dashboard)/[org_slug]/settings/actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Building2 } from "lucide-react";

interface Props {
  orgSlug: string;
  initialData: {
    name: string;
    rna_number: string | null;
    fiscal_start: string;
  };
}

export function OrgInfoForm({ orgSlug, initialData }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateOrgSettings(orgSlug, formData);
      if (result.success) {
        toast.success("Paramètres sauvegardés");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-slate-800">Informations de l'Organisation</h2>
            <p className="text-xs text-slate-500">Nom, numéro RNA et exercice fiscal.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
          <div className="space-y-1.5">
            <label htmlFor="org-name" className="block text-sm font-medium text-slate-700">
              Nom de l&apos;organisation
            </label>
            <input
              id="org-name"
              name="name"
              type="text"
              required
              minLength={2}
              defaultValue={initialData.name}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="org-rna" className="block text-sm font-medium text-slate-700">
              Numéro RNA{" "}
              <span className="text-slate-400 font-normal">(optionnel)</span>
            </label>
            <input
              id="org-rna"
              name="rna_number"
              type="text"
              defaultValue={initialData.rna_number ?? ""}
              placeholder="W123456789"
              pattern="^(W\d{9})?$"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
            />
            <p className="text-xs text-slate-400">Format : W suivi de 9 chiffres</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="org-fiscal" className="block text-sm font-medium text-slate-700">
              Début d&apos;exercice fiscal
            </label>
            <input
              id="org-fiscal"
              name="fiscal_start"
              type="date"
              required
              defaultValue={initialData.fiscal_start}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? "Enregistrement…" : "Sauvegarder"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
