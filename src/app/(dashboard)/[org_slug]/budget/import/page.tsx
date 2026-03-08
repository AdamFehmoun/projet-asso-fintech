"use client";

import { useCallback, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Papa from "papaparse";
import { importTransactions } from "./actions";
import type { ImportResult, RawRow } from "./actions";

// ─── Auto-suggestion mapping ──────────────────────────────────────────────────

type MappedField = "date" | "amount" | "type" | "description";

const AUTO_MAP: Record<string, MappedField> = {
  date: "date",
  montant: "amount",
  amount: "amount",
  prix: "amount",
  type: "type",
  description: "description",
  libelle: "description",
  label: "description",
};

function autoSuggest(header: string): MappedField | "ignore" {
  return AUTO_MAP[header.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")] ?? "ignore";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyMapping(
  rows: Record<string, string>[],
  mapping: Record<MappedField, string>
): RawRow[] {
  return rows.map((row) => ({
    date: row[mapping.date] ?? "",
    amount: parseFloat((row[mapping.amount] ?? "0").replace(",", ".")),
    type: (row[mapping.type] ?? "").toLowerCase(),
    description: mapping.description ? row[mapping.description] : undefined,
  }));
}

function formatAmount(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

// ─── Stepper indicator ────────────────────────────────────────────────────────

function Stepper({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Fichier", "Colonnes", "Import"];
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  done
                    ? "bg-emerald-600 text-white"
                    : active
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {done ? "✓" : n}
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${active ? "text-slate-900" : "text-slate-400"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px w-16 mb-5 mx-2 ${n < current ? "bg-emerald-600" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const params = useParams();
  const org_slug = params.org_slug as string;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [dragging, setDragging] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<MappedField, string>>({
    date: "", amount: "", type: "", description: "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Parse file ──────────────────────────────────────────────────────────────

  const parseFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? "";
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
      });
      const cols = parsed.meta.fields ?? [];
      setHeaders(cols);
      setRawData(parsed.data);
      const suggested: Record<MappedField, string> = { date: "", amount: "", type: "", description: "" };
      for (const h of cols) {
        const field = autoSuggest(h);
        if (field !== "ignore" && !suggested[field]) suggested[field] = h;
      }
      setMapping(suggested);
      setStep(2);
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) parseFile(file);
    },
    [parseFile]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) parseFile(file);
    },
    [parseFile]
  );

  // ── Step 3 : import ─────────────────────────────────────────────────────────

  const handleImport = async () => {
    setLoading(true);
    setResult(null);
    const rows = applyMapping(rawData, mapping);
    const res = await importTransactions(org_slug, rows);
    setResult(res);
    setLoading(false);
  };

  const canProceedToStep3 =
    mapping.date !== "" && mapping.amount !== "" && mapping.type !== "";

  const mappedRows = applyMapping(rawData, mapping);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Import CSV</h1>
        <p className="text-slate-500 text-sm mt-1">Importez vos transactions depuis un fichier CSV.</p>
      </div>

      <Stepper current={step} />

      {/* ── STEP 1 : FILE ────────────────────────────────────────────────── */}
      {step === 1 && (
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
            dragging ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-400"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={onFileChange}
          />
          <p className="text-4xl mb-3">📂</p>
          <p className="font-semibold text-slate-700">Déposez votre fichier CSV ici</p>
          <p className="text-sm text-slate-400 mt-1">ou cliquez pour sélectionner</p>
          <p className="text-xs text-slate-300 mt-4">
            Colonnes attendues : date, montant, type (income/expense), description
          </p>
        </div>
      )}

      {/* ── STEP 2 : MAPPING ─────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="font-bold text-slate-900">Association des colonnes</h2>
            <p className="text-sm text-slate-500">{rawData.length} lignes détectées</p>

            {(["date", "amount", "type", "description"] as MappedField[]).map((field) => {
              const required = field !== "description";
              return (
                <div key={field} className="flex items-center gap-4">
                  <label className="w-32 text-sm font-semibold text-slate-700 capitalize flex-shrink-0">
                    {field === "amount" ? "Montant" : field === "date" ? "Date" : field === "type" ? "Type" : "Description"}
                    {required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  <select
                    value={mapping[field]}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [field]: e.target.value }))
                    }
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="">— non mappé —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          {/* Aperçu live 3 lignes */}
          {canProceedToStep3 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-semibold text-slate-700 text-sm">Aperçu (3 premières lignes)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase">Montant</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedRows.slice(0, 3).map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-4 py-2 font-mono text-xs text-slate-600">{row.date}</td>
                        <td className="px-4 py-2 font-mono text-xs text-slate-600">{row.amount}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            row.type === "income"
                              ? "bg-emerald-100 text-emerald-700"
                              : row.type === "expense"
                              ? "bg-red-100 text-red-700"
                              : "bg-slate-100 text-slate-500"
                          }`}>
                            {row.type || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-500 truncate max-w-[200px]">
                          {row.description || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition"
            >
              ← Retour
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!canProceedToStep3}
              className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Suivant →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3 : RECAP + IMPORT ──────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-900">Récapitulatif</h2>
              <span className="text-sm text-slate-500">{mappedRows.length} transactions</span>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase">Montant</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedRows.map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2 text-xs text-slate-400 font-mono">{i + 1}</td>
                      <td className="px-4 py-2 text-xs font-mono text-slate-600">{row.date}</td>
                      <td className="px-4 py-2 text-xs font-mono text-right text-slate-900">
                        {isNaN(row.amount) ? "—" : formatAmount(row.amount * 100)}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          row.type === "income"
                            ? "bg-emerald-100 text-emerald-700"
                            : row.type === "expense"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-500"
                        }`}>
                          {row.type || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500 truncate max-w-[180px]">
                        {row.description || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Résultat */}
          {result && (
            <div className={`rounded-xl border p-4 space-y-2 ${
              result.errors.length === 0
                ? "bg-emerald-50 border-emerald-200"
                : "bg-amber-50 border-amber-200"
            }`}>
              <p className="font-semibold text-slate-900">
                ✅ {result.imported} transaction{result.imported > 1 ? "s" : ""} importée{result.imported > 1 ? "s" : ""}
              </p>
              {result.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-700">
                    {result.errors.length} ligne{result.errors.length > 1 ? "s" : ""} ignorée{result.errors.length > 1 ? "s" : ""} :
                  </p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-amber-700 font-mono">
                      Ligne {e.row} : {e.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              disabled={loading}
              className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition disabled:opacity-40"
            >
              ← Retour
            </button>
            <button
              onClick={handleImport}
              disabled={loading || result !== null}
              className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Import en cours…" : result ? "Importé ✓" : `Importer ${mappedRows.length} lignes`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
