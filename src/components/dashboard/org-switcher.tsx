"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ChevronsUpDown, Plus, Building2 } from "lucide-react";

type Org = {
  id: string;
  name: string;
  slug: string;
};

type Props = {
  orgs: Org[];
  currentSlug: string;
};

export default function OrgSwitcher({ orgs, currentSlug }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const current = orgs.find((o) => o.slug === currentSlug);

  const handleSelect = (slug: string) => {
    setOpen(false);
    if (slug !== currentSlug) router.push(`/${slug}/budget`);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors min-w-[180px] max-w-[240px]"
      >
        <div className="w-5 h-5 rounded-md bg-indigo-600 flex items-center justify-center shrink-0">
          <Building2 className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-medium text-white truncate flex-1 text-left">
          {current?.name ?? currentSlug}
        </span>
        <ChevronsUpDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1.5 left-0 z-50 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">

            <div className="p-1.5">
              <p className="px-2.5 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
                Vos associations
              </p>
              {orgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleSelect(org.slug)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-left group"
                >
                  <div className="w-6 h-6 rounded-md bg-zinc-800 group-hover:bg-zinc-700 flex items-center justify-center shrink-0 transition-colors">
                    <span className="text-[10px] font-bold text-zinc-400">
                      {org.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm text-zinc-300 group-hover:text-white transition-colors truncate flex-1">
                    {org.name}
                  </span>
                  {org.slug === currentSlug && (
                    <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  )}
                </button>
              ))}
            </div>

            <div className="h-px bg-zinc-800 mx-1.5" />

            <div className="p-1.5">
              <button
                onClick={() => { setOpen(false); router.push("/onboarding"); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-left"
              >
                <div className="w-6 h-6 rounded-md border border-dashed border-zinc-700 flex items-center justify-center shrink-0">
                  <Plus className="w-3.5 h-3.5 text-zinc-500" />
                </div>
                <span className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
                  Nouvelle association
                </span>
              </button>
            </div>

          </div>
        </>
      )}
    </div>
  );
}