"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Plus, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown,
  Minus, Loader2, ChevronDown, Info, Lock, Sparkles, X
} from "lucide-react";
import { toast } from "sonner";
import {
  createInitialClosure, createClosure,
  previewComputedBalance, type ClosureWithComputed
} from "./actions";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatEuros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

const formatMonth = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

/** Retourne le 1er du mois courant en YYYY-MM-DD */
function firstOfCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Retourne le 1er du mois précédent en YYYY-MM-DD */
function firstOfPrevMonth(): string {
  const now = new Date();
  now.setMonth(now.getMonth() - 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

// ─── Delta Badge ──────────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
        <CheckCircle2 className="w-3 h-3" /> Équilibré
      </span>
    );
  }
  const isPositive = delta > 0;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black border ${
      isPositive
        ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
        : "bg-red-500/10 border-red-500/20 text-red-400"
    }`}>
      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isPositive ? "+" : ""}{formatEuros(delta)}
    </span>
  );
}

// ─── Initial Closure Form ─────────────────────────────────────────────────────

function InitialClosureForm({ orgSlug, onDone }: { orgSlug: string; onDone: () => void }) {
  const [month, setMonth] = useState(firstOfPrevMonth());
  const [balance, setBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    const balanceNum = parseFloat(balance.replace(",", "."));
    if (isNaN(balanceNum)) {
      toast.error("Montant invalide");
      return;
    }
    startTransition(async () => {
      const result = await createInitialClosure(orgSlug, {
        month,
        initial_balance_euros: balanceNum,
        notes: notes || undefined,
      });
      if (result.success) {
        toast.success("Solde initial enregistré", {
          description: "La chaîne de rapprochement peut commencer.",
        });
        onDone();
      } else {
        toast.error("Erreur", { description: result.error });
      }
    });
  };

  return (
    <div className="bg-zinc-950 border border-blue-500/20 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 bg-blue-500/5 border-b border-blue-500/15 flex items-center gap-3">
        <div className="p-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <Sparkles className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Initialisation — Solde de départ</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Déclarez le solde bancaire au début de l'utilisation de l'app.
            C'est le point zéro de la chaîne de rapprochement.
          </p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
              Mois de référence
            </label>
            <input
              type="month"
              value={month.slice(0, 7)}
              onChange={(e) => setMonth(e.target.value + "-01")}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
              Solde bancaire réel (€)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="ex: 3250.00"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            Notes (optionnel)
          </label>
          <input
            type="text"
            placeholder="ex: Passation BDE 2024 — solde transmis par l'ancien bureau"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={isPending || !balance}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-all"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Enregistrer le solde initial
        </button>
      </div>
    </div>
  );
}

// ─── New Closure Form ─────────────────────────────────────────────────────────

function NewClosureForm({
  orgSlug, existingMonths, onDone,
}: {
  orgSlug: string;
  existingMonths: Set<string>;
  onDone: () => void;
}) {
  const [month, setMonth] = useState(firstOfCurrentMonth());
  const [balance, setBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<{
    computed_balance: number;
    previous_bank_balance: number;
    month_transactions_delta: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Auto-preview quand le mois change
  useEffect(() => {
    if (!month) return;
    setPreviewLoading(true);
    setPreview(null);
    previewComputedBalance(orgSlug, month).then((result) => {
      if (result.success) setPreview(result);
      setPreviewLoading(false);
    });
  }, [month, orgSlug]);

  const handleSubmit = () => {
    const balanceNum = parseFloat(balance.replace(",", "."));
    if (isNaN(balanceNum)) {
      toast.error("Montant invalide");
      return;
    }
    startTransition(async () => {
      const result = await createClosure(orgSlug, {
        month,
        bank_balance_euros: balanceNum,
        notes: notes || undefined,
      });
      if (result.success) {
        const delta = result.delta;
        if (delta === 0) {
          toast.success("Clôture parfaite ✓", { description: "Aucun écart détecté." });
        } else {
          toast.warning("Clôture enregistrée avec écart", {
            description: `Écart de ${formatEuros(Math.abs(delta))} — à investiguer.`,
          });
        }
        onDone();
      } else {
        toast.error("Erreur", { description: result.error });
      }
    });
  };

  const isMonthTaken = existingMonths.has(month);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <p className="text-sm font-bold text-white">Nouvelle clôture mensuelle</p>
        <button onClick={onDone} className="text-zinc-500 hover:text-zinc-300 transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
              Mois à clôturer
            </label>
            <input
              type="month"
              value={month.slice(0, 7)}
              onChange={(e) => setMonth(e.target.value + "-01")}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
            />
            {isMonthTaken && (
              <p className="text-[10px] text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Ce mois est déjà clôturé
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
              Solde bancaire réel (€)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="Montant affiché sur votre banque"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition"
            />
          </div>
        </div>

        {/* Preview box */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
            <Info className="w-3 h-3" /> Solde système calculé
          </p>

          {previewLoading ? (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Calcul en cours...
            </div>
          ) : preview ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Clôture mois précédent</span>
                <span className="font-mono text-zinc-300">{formatEuros(preview.previous_bank_balance)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Transactions du mois</span>
                <span className={`font-mono ${preview.month_transactions_delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {preview.month_transactions_delta >= 0 ? "+" : ""}{formatEuros(preview.month_transactions_delta)}
                </span>
              </div>
              <div className="border-t border-zinc-800 pt-2 flex justify-between text-xs">
                <span className="font-bold text-zinc-300">Solde attendu</span>
                <span className="font-mono font-black text-white">{formatEuros(preview.computed_balance)}</span>
              </div>
              {balance && !isNaN(parseFloat(balance)) && (
                <div className="border-t border-zinc-800 pt-2 flex justify-between text-xs">
                  <span className="font-bold text-zinc-300">Écart prévu</span>
                  <span className={`font-mono font-black ${
                    Math.round(parseFloat(balance.replace(",", ".")) * 100) === preview.computed_balance
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }`}>
                    {(() => {
                      const delta = Math.round(parseFloat(balance.replace(",", ".")) * 100) - preview.computed_balance;
                      return delta === 0 ? "✓ Aucun écart" : `${delta > 0 ? "+" : ""}${formatEuros(delta)}`;
                    })()}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-600">
              Aucun mois précédent trouvé pour cette période.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            Notes (optionnel)
          </label>
          <input
            type="text"
            placeholder="ex: Virement reçu hors système le 15/03"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={isPending || !balance || isMonthTaken || !preview}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-all"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Enregistrer la clôture
        </button>
      </div>
    </div>
  );
}

// ─── Closure Row ──────────────────────────────────────────────────────────────

function ClosureRow({ closure }: { closure: ClosureWithComputed }) {
  const [expanded, setExpanded] = useState(false);
  const hasGap = closure.delta !== 0;

  return (
    <div className={`border rounded-xl transition-all overflow-hidden ${
      closure.is_initial
        ? "border-blue-500/20 bg-blue-500/3"
        : hasGap
        ? "border-amber-500/20 bg-amber-500/3"
        : "border-zinc-800 bg-zinc-950"
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-900/50 transition"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {closure.is_initial ? (
              <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded uppercase tracking-widest">
                Solde initial
              </span>
            ) : (
              <Lock className="w-3 h-3 text-zinc-600" />
            )}
            <span className="text-sm font-bold text-white capitalize">
              {formatMonth(closure.month)}
            </span>
          </div>
          <DeltaBadge delta={closure.delta} />
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[9px] text-zinc-600 uppercase font-black">Banque</p>
            <p className="text-sm font-mono font-bold text-white">{formatEuros(closure.bank_balance)}</p>
          </div>
          {!closure.is_initial && (
            <div className="text-right">
              <p className="text-[9px] text-zinc-600 uppercase font-black">Système</p>
              <p className="text-sm font-mono font-bold text-zinc-400">{formatEuros(closure.computed_balance)}</p>
            </div>
          )}
          <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 pt-0 border-t border-zinc-800 space-y-3 animate-in fade-in duration-200">
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div>
              <p className="text-[9px] text-zinc-600 uppercase font-black mb-1">Solde bancaire saisi</p>
              <p className="text-sm font-mono text-white">{formatEuros(closure.bank_balance)}</p>
            </div>
            {!closure.is_initial && (
              <>
                <div>
                  <p className="text-[9px] text-zinc-600 uppercase font-black mb-1">Solde calculé système</p>
                  <p className="text-sm font-mono text-zinc-400">{formatEuros(closure.computed_balance)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-zinc-600 uppercase font-black mb-1">Écart</p>
                  <p className={`text-sm font-mono font-black ${
                    closure.delta === 0 ? "text-emerald-400" : "text-amber-400"
                  }`}>
                    {closure.delta === 0 ? "✓ Aucun" : `${closure.delta > 0 ? "+" : ""}${formatEuros(closure.delta)}`}
                  </p>
                </div>
              </>
            )}
          </div>

          {closure.notes && (
            <div className="p-3 bg-zinc-900 rounded-lg">
              <p className="text-[9px] text-zinc-500 uppercase font-black mb-1">Notes</p>
              <p className="text-xs text-zinc-300">{closure.notes}</p>
            </div>
          )}

          <p className="text-[10px] text-zinc-600">
            Clôturé le {new Date(closure.created_at).toLocaleDateString("fr-FR", {
              day: "2-digit", month: "long", year: "numeric"
            })}
            {" · "}
            <Lock className="w-2.5 h-2.5 inline" /> Immuable
          </p>

          {hasGap && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/15 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/80">
                Un écart de <strong>{formatEuros(Math.abs(closure.delta))}</strong> a été détecté.
                Vérifiez les transactions du mois, les frais bancaires non saisis, ou les virements hors système.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ClosuresClient({
  closures: initialClosures,
  hasInitialClosure,
  canWrite,
  orgSlug,
}: {
  closures: ClosureWithComputed[];
  hasInitialClosure: boolean;
  canWrite: boolean;
  orgSlug: string;
}) {
  const [closures, setClosures] = useState(initialClosures);
  const [showForm, setShowForm] = useState(false);
  const [localHasInitial, setLocalHasInitial] = useState(hasInitialClosure);

  const existingMonths = new Set(closures.map((c) => c.month));
  const totalGaps = closures.filter((c) => c.delta !== 0 && !c.is_initial).length;
  const lastClosure = closures.find((c) => !c.is_initial);

  const handleDone = () => {
    setShowForm(false);
    // Reload via router — en production on peut aussi refresher les données
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
          <p className="text-2xl font-black text-white font-mono">{closures.length}</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-0.5">Clôtures totales</p>
        </div>
        <div className={`bg-zinc-950 border rounded-xl p-4 ${totalGaps > 0 ? "border-amber-500/20" : "border-zinc-800"}`}>
          <p className={`text-2xl font-black font-mono ${totalGaps > 0 ? "text-amber-400" : "text-emerald-400"}`}>
            {totalGaps}
          </p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-0.5">Écarts détectés</p>
        </div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
          <p className="text-sm font-black text-white capitalize">
            {lastClosure ? formatMonth(lastClosure.month) : "—"}
          </p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-0.5">Dernière clôture</p>
        </div>
      </div>

      {/* Onboarding — solde initial manquant */}
      {!localHasInitial && canWrite && (
        <InitialClosureForm
          orgSlug={orgSlug}
          onDone={() => { setLocalHasInitial(true); handleDone(); }}
        />
      )}

      {/* Bouton nouvelle clôture */}
      {localHasInitial && canWrite && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-white text-sm font-bold rounded-xl transition-all"
        >
          <Plus className="w-4 h-4" />
          Nouvelle clôture mensuelle
        </button>
      )}

      {/* Formulaire nouvelle clôture */}
      {showForm && (
        <NewClosureForm
          orgSlug={orgSlug}
          existingMonths={existingMonths}
          onDone={() => { setShowForm(false); handleDone(); }}
        />
      )}

      {/* Liste des clôtures */}
      {closures.length > 0 ? (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
            Historique des clôtures
          </p>
          {closures.map((closure) => (
            <ClosureRow key={closure.id} closure={closure} />
          ))}
        </div>
      ) : !localHasInitial ? null : (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-zinc-950 border border-zinc-800 rounded-xl">
          <Minus className="w-8 h-8 text-zinc-700" />
          <p className="text-sm font-bold text-zinc-400">Aucune clôture enregistrée</p>
          <p className="text-xs text-zinc-600">Créez votre première clôture mensuelle ci-dessus.</p>
        </div>
      )}
    </div>
  );
}