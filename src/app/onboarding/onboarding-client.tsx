"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrganization, joinOrganization } from "./actions";
import { Building2, UserPlus, ArrowRight, Loader2, ChevronRight, Crown, Users } from "lucide-react";

type Membership = {
  role: string;
  organizations: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
};

type Props = {
  activeMemberships: Membership[];
};

function getOrg(m: Membership) {
  if (!m.organizations) return null;
  return Array.isArray(m.organizations) ? m.organizations[0] : m.organizations;
}

export default function OnboardingClient({ activeMemberships }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState(false);

  const firstOrg = activeMemberships.length > 0 ? getOrg(activeMemberships[0]) : null;

  const handleCreate = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        await createOrganization(formData);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Une erreur est survenue");
      }
    });
  };

  const handleJoin = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        await joinOrganization(formData);
        setJoinSuccess(true);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Une erreur est survenue");
      }
    });
  };

  if (joinSuccess) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-semibold text-white mb-3">Candidature envoyée</h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-8">
            Un admin de l'association doit valider ton accès.<br />
            Tu recevras une confirmation dès que c'est fait.
          </p>
          <button
            onClick={() => { setJoinSuccess(false); setMode("join"); }}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-4"
          >
            Rejoindre une autre asso
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center p-4">

      {/* Fond décoratif */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[5%] w-[400px] h-[400px] bg-violet-600/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-2xl">

        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="text-white font-semibold tracking-tight">Projet B</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
            Bienvenue sur votre espace
          </h1>
          <p className="text-zinc-500 text-sm">
            Gérez la trésorerie de votre association étudiante
          </p>
        </div>

        {/* Bandeau "Retour au dashboard" si memberships actifs */}
        {firstOrg && (
          <div className="mb-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-600/20 rounded-lg flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <p className="text-xs text-indigo-400 font-medium uppercase tracking-wider mb-0.5">
                  Déjà membre de
                </p>
                <p className="text-white font-medium text-sm">{firstOrg.name}</p>
              </div>
            </div>
            <button
              onClick={() => router.push(`/${firstOrg.slug}/budget`)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Retourner au dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Liste des autres assos si plusieurs */}
        {activeMemberships.length > 1 && (
          <div className="mb-6 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
                Vos associations ({activeMemberships.length})
              </p>
            </div>
            {activeMemberships.map((m, i) => {
              const org = getOrg(m);
              if (!org) return null;
              return (
                <button
                  key={i}
                  onClick={() => router.push(`/${org.slug}/budget`)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-900 transition-colors border-b border-zinc-800 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-zinc-800 rounded-md flex items-center justify-center">
                      {m.role === 'owner' ? (
                        <Crown className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <Users className="w-3.5 h-3.5 text-zinc-400" />
                      )}
                    </div>
                    <span className="text-sm text-zinc-300">{org.name}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                </button>
              );
            })}
          </div>
        )}

        {/* Séparateur */}
        {activeMemberships.length > 0 && (
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-xs text-zinc-600 font-medium">ou rejoignez une nouvelle asso</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>
        )}

        {/* Cards Créer / Rejoindre côte à côte */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Card Créer */}
          <div
            className={`relative rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer ${
              mode === "create"
                ? "border-indigo-500/50 bg-indigo-500/5"
                : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
            }`}
            onClick={() => setMode("create")}
          >
            {mode === "create" && (
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
            )}
            <div className="p-6">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                mode === "create" ? "bg-indigo-600/20" : "bg-zinc-800"
              }`}>
                <Building2 className={`w-5 h-5 ${mode === "create" ? "text-indigo-400" : "text-zinc-400"}`} />
              </div>
              <h2 className="text-white font-semibold mb-1.5">Créer une asso</h2>
              <p className="text-zinc-500 text-xs leading-relaxed mb-4">
                Lancez un nouvel espace de gestion financière. Vous devenez automatiquement Owner.
              </p>

              {mode === "create" && (
                <form action={handleCreate} className="space-y-3" onClick={e => e.stopPropagation()}>
                  <input
                    name="orgName"
                    type="text"
                    required
                    placeholder="Nom de l'association"
                    className="w-full bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-600 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>Créer et accéder <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Card Rejoindre */}
          <div
            className={`relative rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer ${
              mode === "join"
                ? "border-violet-500/50 bg-violet-500/5"
                : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
            }`}
            onClick={() => setMode("join")}
          >
            {mode === "join" && (
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent" />
            )}
            <div className="p-6">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                mode === "join" ? "bg-violet-600/20" : "bg-zinc-800"
              }`}>
                <UserPlus className={`w-5 h-5 ${mode === "join" ? "text-violet-400" : "text-zinc-400"}`} />
              </div>
              <h2 className="text-white font-semibold mb-1.5">Rejoindre une asso</h2>
              <p className="text-zinc-500 text-xs leading-relaxed mb-4">
                Entrez le slug de l'association. Votre demande sera soumise à validation par un admin.
              </p>

              {mode === "join" && (
                <form action={handleJoin} className="space-y-3" onClick={e => e.stopPropagation()}>
                  <input
                    name="slug"
                    type="text"
                    required
                    placeholder="ex: bde-esiee"
                    className="w-full bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-600 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:border-violet-500 transition-colors font-mono"
                  />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm transition-colors border border-zinc-700 flex items-center justify-center gap-2"
                  >
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>Envoyer ma candidature <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

      </div>
    </div>
  );
}