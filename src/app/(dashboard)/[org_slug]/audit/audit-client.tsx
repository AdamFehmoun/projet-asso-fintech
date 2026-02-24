"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import {
  CheckCircle2,
  Clock,
  Sparkles,
  Gavel,
  UserCheck,
  ShieldAlert,
  CheckSquare,
  Square,
  Loader2,
  TrendingDown,
  TrendingUp,
  X,
  Paperclip,
  AlertCircle,
  Upload,
  ExternalLink,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";
import { validateTransactionsBatch, attachReceipt } from "../actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type BudgetCategory = {
  name: string;
  color: string;
} | null;

type Transaction = {
  id: string;
  description: string | null;
  amount: number;
  type: "income" | "expense";
  date: string;
  classification_status: string | null;
  classification_method: string | null;
  confidence_score: number | null;
  receipt_url: string | null;
  budget_categories: BudgetCategory;
};

type Props = {
  transactions: Transaction[];
  orgSlug: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    cents / 100
  );

const METHOD_BADGE: Record<
  string,
  { label: string; icon: React.ReactNode; className: string }
> = {
  ai_llm: {
    label: "IA · LLM",
    icon: <Sparkles className="w-2.5 h-2.5" />,
    className: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  },
  ai_vector: {
    label: "IA · Vector",
    icon: <Sparkles className="w-2.5 h-2.5" />,
    className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  },
  hard_rule: {
    label: "Règle Métier",
    icon: <Gavel className="w-2.5 h-2.5" />,
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  manual: {
    label: "Manuel",
    icon: <UserCheck className="w-2.5 h-2.5" />,
    className: "bg-zinc-800 text-zinc-400 border-zinc-700",
  },
};

// ─── Receipt Badge ─────────────────────────────────────────────────────────────

function ReceiptBadge({
  hasReceipt,
  transactionId,
  orgSlug,
  onUploaded,
}: {
  hasReceipt: boolean;
  transactionId: string;
  orgSlug: string;
  onUploaded: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      try {
        const result = await attachReceipt(transactionId, orgSlug, formData);
        if (result.success) {
          toast.success("Justificatif attaché", {
            description: "La transaction est maintenant complète.",
          });
          onUploaded(transactionId);
          setIsOpen(false);
        } else {
          toast.error("Échec de l'upload", { description: result.error });
        }
      } catch {
        toast.error("Erreur inattendue lors de l'upload");
      } finally {
        setIsUploading(false);
      }
    },
    [transactionId, orgSlug, onUploaded]
  );

  return (
    <div className="relative">
      {/* Badge */}
      <button
        onClick={() => setIsOpen(true)}
        title={hasReceipt ? "Justificatif attaché — cliquer pour remplacer" : "Justificatif manquant — cliquer pour uploader"}
        className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-tight transition-all hover:scale-105 ${
          hasReceipt
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
            : "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 animate-pulse"
        }`}
      >
        {hasReceipt ? (
          <><FileCheck className="w-3 h-3" /> OK</>
        ) : (
          <><AlertCircle className="w-3 h-3" /> Manquant</>
        )}
      </button>

      {/* Upload Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => !isUploading && setIsOpen(false)}
          />

          {/* Modal */}
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                    <Paperclip className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Attacher un justificatif</p>
                    <p className="text-[10px] text-zinc-500">JPG · PNG · WEBP · PDF — max 10MB</p>
                  </div>
                </div>
                <button
                  onClick={() => !isUploading && setIsOpen(false)}
                  className="text-zinc-500 hover:text-zinc-300 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drop Zone */}
              <div className="p-5">
                <div
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                    isDragging
                      ? "border-indigo-500 bg-indigo-500/5"
                      : "border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/50"
                  } ${isUploading ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleFile(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                  />

                  {isUploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                      <p className="text-sm text-zinc-300 font-medium">Upload en cours...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-3 bg-zinc-800 rounded-full">
                        <Upload className="w-6 h-6 text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-200">
                          Glissez ou cliquez pour sélectionner
                        </p>
                        <p className="text-xs text-zinc-600 mt-0.5">
                          Ticket de caisse, facture, bon de commande
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {hasReceipt && (
                  <p className="text-[10px] text-amber-500/80 text-center mt-3 flex items-center justify-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Un justificatif existe déjà — il sera remplacé
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AuditReviewTable({ transactions, orgSlug }: Props) {
  const pending = transactions.filter(
    (t) => t.classification_status === "ai_suggested"
  );
  const validated = transactions.filter(
    (t) => t.classification_status === "validated"
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [optimisticValidated, setOptimisticValidated] = useState<Set<string>>(new Set());
  // Track which transactions now have receipts (after upload in this session)
  const [receiptUploaded, setReceiptUploaded] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"pending" | "validated">("pending");

  const pendingFiltered = pending.filter((t) => !optimisticValidated.has(t.id));

  // Stats
  const allTransactions = [...pending, ...validated];
  const missingReceipts = allTransactions.filter(
    (t) => !t.receipt_url && !receiptUploaded.has(t.id)
  ).length;

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    const allIds = pendingFiltered.map((t) => t.id);
    setSelected((prev) =>
      prev.size === allIds.length ? new Set() : new Set(allIds)
    );
  }, [pendingFiltered]);

  const handleBatchValidate = useCallback(() => {
    if (!selected.size) return;
    const ids = Array.from(selected);

    setOptimisticValidated((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    setSelected(new Set());

    startTransition(async () => {
      try {
        const result = await validateTransactionsBatch(ids, orgSlug);
        toast.success(
          `${result.count} transaction${result.count > 1 ? "s" : ""} validée${result.count > 1 ? "s" : ""}`,
          { description: "Enregistrées dans le journal d'audit." }
        );
      } catch (err) {
        setOptimisticValidated((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        });
        setSelected(new Set(ids));
        toast.error("Échec de la validation", {
          description: err instanceof Error ? err.message : "Erreur inconnue",
        });
      }
    });
  }, [selected, orgSlug]);

  const handleReceiptUploaded = useCallback((id: string) => {
    setReceiptUploaded((prev) => new Set(prev).add(id));
  }, []);

  const allPendingSelected =
    pendingFiltered.length > 0 && selected.size === pendingFiltered.length;

  return (
    <div className="space-y-6">
      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="À valider" value={pendingFiltered.length} accent="amber" icon={<Clock className="w-4 h-4" />} />
        <StatCard label="Validées" value={validated.length + optimisticValidated.size} accent="emerald" icon={<CheckCircle2 className="w-4 h-4" />} />
        <StatCard label="Total" value={transactions.length} accent="zinc" icon={<ShieldAlert className="w-4 h-4" />} />
        <StatCard
          label="Justif. manquants"
          value={missingReceipts}
          accent={missingReceipts > 0 ? "red" : "emerald"}
          icon={<Paperclip className="w-4 h-4" />}
        />
      </div>

      {/* ── Missing receipts warning ── */}
      {missingReceipts > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-500/5 border border-red-500/15 rounded-xl">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-300/80">
            <strong className="text-red-300">{missingReceipts} transaction{missingReceipts > 1 ? "s" : ""}</strong>{" "}
            sans justificatif. Cliquez sur le badge{" "}
            <span className="font-mono bg-red-500/10 px-1 rounded text-red-400">Manquant</span>{" "}
            pour uploader le document correspondant.
          </p>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl w-fit">
        {(["pending", "validated"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
              activeTab === tab
                ? "bg-zinc-700 text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab === "pending"
              ? `À valider · ${pendingFiltered.length}`
              : `Validées · ${validated.length + optimisticValidated.size}`}
          </button>
        ))}
      </div>

      {/* ── Bulk Action Bar ── */}
      {activeTab === "pending" && selected.size > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-indigo-300">
              {selected.size} sélectionnée{selected.size > 1 ? "s" : ""}
            </span>
            <button onClick={() => setSelected(new Set())} className="text-indigo-400 hover:text-indigo-200 transition">
              <X className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleBatchValidate}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all"
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Valider la sélection
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        {activeTab === "pending" ? (
          pendingFiltered.length === 0 ? (
            <EmptyState
              title="Aucune transaction en attente"
              sub="Toutes les suggestions IA ont été traitées."
              icon={<CheckCircle2 className="w-8 h-8 text-emerald-500" />}
            />
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleAll} className="text-zinc-500 hover:text-white transition">
                      {allPendingSelected
                        ? <CheckSquare className="w-4 h-4 text-indigo-400" />
                        : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <TH>Date</TH>
                  <TH>Description</TH>
                  <TH>Catégorie · Méthode</TH>
                  <TH>Justificatif</TH>
                  <TH right>Montant</TH>
                </tr>
              </thead>
              <tbody>
                {pendingFiltered.map((t) => (
                  <PendingRow
                    key={t.id}
                    t={t}
                    selected={selected.has(t.id)}
                    onToggle={toggleSelect}
                    orgSlug={orgSlug}
                    hasReceiptOverride={receiptUploaded.has(t.id)}
                    onReceiptUploaded={handleReceiptUploaded}
                  />
                ))}
              </tbody>
            </table>
          )
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <TH>Date</TH>
                <TH>Description</TH>
                <TH>Catégorie · Méthode</TH>
                <TH>Justificatif</TH>
                <TH right>Montant</TH>
                <TH right>Status</TH>
              </tr>
            </thead>
            <tbody>
              {validated.map((t) => (
                <ValidatedRow
                  key={t.id}
                  t={t}
                  orgSlug={orgSlug}
                  hasReceiptOverride={receiptUploaded.has(t.id)}
                  onReceiptUploaded={handleReceiptUploaded}
                />
              ))}
              {pending
                .filter((t) => optimisticValidated.has(t.id))
                .map((t) => (
                  <ValidatedRow
                    key={`opt-${t.id}`}
                    t={t}
                    orgSlug={orgSlug}
                    optimistic
                    hasReceiptOverride={receiptUploaded.has(t.id)}
                    onReceiptUploaded={handleReceiptUploaded}
                  />
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, accent, icon,
}: {
  label: string;
  value: number;
  accent: "amber" | "emerald" | "zinc" | "red";
  icon: React.ReactNode;
}) {
  const colors = {
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    zinc: "text-zinc-400 bg-zinc-800 border-zinc-700",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
  };
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg border ${colors[accent]}`}>{icon}</div>
      <div>
        <p className="text-2xl font-black text-white font-mono">{value}</p>
        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">{label}</p>
      </div>
    </div>
  );
}

function TH({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-4 py-3 text-[9px] font-black text-zinc-500 uppercase tracking-widest ${right ? "text-right" : ""}`}>
      {children}
    </th>
  );
}

function PendingRow({
  t, selected, onToggle, orgSlug, hasReceiptOverride, onReceiptUploaded,
}: {
  t: Transaction;
  selected: boolean;
  onToggle: (id: string) => void;
  orgSlug: string;
  hasReceiptOverride: boolean;
  onReceiptUploaded: (id: string) => void;
}) {
  const method = t.classification_method ?? "manual";
  const badge = METHOD_BADGE[method] ?? METHOD_BADGE.manual;
  const hasReceipt = hasReceiptOverride || !!t.receipt_url;

  return (
    <tr
      className={`border-b border-zinc-800/50 transition-colors ${
        selected ? "bg-indigo-500/5 border-l-2 border-l-indigo-500" : "hover:bg-zinc-900"
      }`}
    >
      <td className="px-4 py-3" onClick={() => onToggle(t.id)}>
        <div className="cursor-pointer text-zinc-500">
          {selected
            ? <CheckSquare className="w-4 h-4 text-indigo-400" />
            : <Square className="w-4 h-4" />}
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">
        {new Date(t.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
      </td>
      <td className="px-4 py-3 cursor-pointer" onClick={() => onToggle(t.id)}>
        <span className="text-sm text-zinc-200 font-medium">{t.description || "Sans libellé"}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {t.budget_categories && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.budget_categories.color }} />
              <span className="text-[11px] text-zinc-400 font-medium">{t.budget_categories.name}</span>
            </div>
          )}
          <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-tighter ${badge.className}`}>
            {badge.icon}{badge.label}
          </span>
          {t.confidence_score !== null && t.confidence_score !== undefined && (
            <span className="text-[9px] text-zinc-600 font-mono">{Math.round(t.confidence_score * 100)}%</span>
          )}
        </div>
      </td>
      {/* Receipt badge — stops row click propagation */}
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <ReceiptBadge
          hasReceipt={hasReceipt}
          transactionId={t.id}
          orgSlug={orgSlug}
          onUploaded={onReceiptUploaded}
        />
      </td>
      <td className={`px-4 py-3 text-right font-mono text-sm font-bold ${t.type === "income" ? "text-emerald-400" : "text-zinc-200"}`}>
        <div className="flex items-center justify-end gap-1">
          {t.type === "income"
            ? <TrendingUp className="w-3 h-3 text-emerald-500" />
            : <TrendingDown className="w-3 h-3 text-zinc-500" />}
          {t.type === "expense" ? "-" : "+"}
          {formatCurrency(t.amount)}
        </div>
      </td>
    </tr>
  );
}

function ValidatedRow({
  t, orgSlug, optimistic, hasReceiptOverride, onReceiptUploaded,
}: {
  t: Transaction;
  orgSlug: string;
  optimistic?: boolean;
  hasReceiptOverride: boolean;
  onReceiptUploaded: (id: string) => void;
}) {
  const method = t.classification_method ?? "manual";
  const badge = METHOD_BADGE[method] ?? METHOD_BADGE.manual;
  const hasReceipt = hasReceiptOverride || !!t.receipt_url;

  return (
    <tr className={`border-b border-zinc-800/50 transition-colors ${optimistic ? "animate-in fade-in duration-500 bg-emerald-500/5" : "hover:bg-zinc-900"}`}>
      <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">
        {new Date(t.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-zinc-400">{t.description || "Sans libellé"}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {t.budget_categories && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.budget_categories.color }} />
              <span className="text-[11px] text-zinc-500">{t.budget_categories.name}</span>
            </div>
          )}
          <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-tighter opacity-60 ${badge.className}`}>
            {badge.icon}{badge.label}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <ReceiptBadge
          hasReceipt={hasReceipt}
          transactionId={t.id}
          orgSlug={orgSlug}
          onUploaded={onReceiptUploaded}
        />
      </td>
      <td className={`px-4 py-3 text-right font-mono text-sm ${t.type === "income" ? "text-emerald-600" : "text-zinc-500"}`}>
        {t.type === "expense" ? "-" : "+"}
        {formatCurrency(t.amount)}
      </td>
      <td className="px-4 py-3 text-right">
        <span className="flex items-center justify-end gap-1 text-[9px] font-black text-emerald-500 uppercase tracking-widest">
          <CheckCircle2 className="w-3 h-3" />
          {optimistic ? "En cours..." : "Vérifié"}
        </span>
      </td>
    </tr>
  );
}

function EmptyState({ title, sub, icon }: { title: string; sub: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      {icon}
      <p className="text-sm font-bold text-zinc-300">{title}</p>
      <p className="text-xs text-zinc-600">{sub}</p>
    </div>
  );
}