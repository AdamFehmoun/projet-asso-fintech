"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/(dashboard)/auth-actions";

type Props = {
  email: string;
};

export default function AvatarMenu({ email }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSignOut() {
    startTransition(async () => {
      await signOutAction();
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center hover:border-zinc-500 transition-colors"
        aria-label="Menu utilisateur"
      >
        <span className="text-xs font-medium text-zinc-300">
          {email.charAt(0).toUpperCase()}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-52 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1 z-50">
          <div className="px-3 py-2 border-b border-zinc-800">
            <p className="text-xs text-zinc-500 truncate">{email}</p>
          </div>
          <button
            onClick={handleSignOut}
            disabled={isPending}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-50 rounded-b-xl"
          >
            <LogOut className="w-4 h-4" />
            {isPending ? "Déconnexion…" : "Se déconnecter"}
          </button>
        </div>
      )}
    </div>
  );
}
