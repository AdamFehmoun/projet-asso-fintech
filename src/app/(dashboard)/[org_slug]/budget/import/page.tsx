"use client";

import { useCallback, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Papa from "papaparse";
import { importTransactions } from "./actions";
import type { ImportResult, RawRow, TypeConfig } from "./actions";

// ─── Auto-suggestion colonnes ─────────────────────────────────────────────────

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

/** Normalise accents + casse (miroir du server) */
function norm(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Parse montant côté client : virgule/point + symboles monétaires */
function parseAmount(val: string): number {
  return parseFloat(val.replace(",", ".").replace(/[^0-9.-]/g, ""));
}

function applyMapping(
  rows: Record<string, string>[],
  mapping: Record<MappedField, string>
): RawRow[] {
  return rows.map((row) => ({
    date: row[mapping.date] ?? "",
    amount: parseAmount(row[mapping.amount] ?? "0"),
    type: mapping.type ? row[mapping.type] : undefined, // valeur brute CSV
    description: mapping.description ? row[mapping.description] : undefined,
  }));
}

function formatAmount(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    Math.abs(n)
  );
}

/** Valeurs uniques d'une colonne (pour les hints) */
function uniqueVals(rows: Record<string, string>[], col: string): string[] {
  return Array.from(new Set(rows.map((r) => r[col]).filter(Boolean))).slice(0, 12);
}

/** Tente de détecter income/expense parmi les valeurs trouvées */
const KNOWN_INCOME = ["income", "recette", "revenu", "credit", "avoir", "entree", "+", "c", "r", "in", "virement recu"];
const KNOWN_EXPENSE = ["expense", "depense", "debit", "sortie", "out", "-", "d", "charges", "virement emis"];
function detectIncExp(vals: string[]): { inc: string; exp: string } {
  let inc = "", exp = "";
  for (const v of vals) {
    const n = norm(v);
    if (!inc && KNOWN_INCOME.includes(n)) inc = v;
    if (!exp && KNOWN_EXPENSE.includes(n)) exp = v;
  }
  if (!inc && vals[0]) inc = vals[0];
  if (!exp && vals[1] && vals[1] !== vals[0]) exp = vals[1];
  return { inc, exp };
}

/** Résolution type côté client pour le preview */
function resolveTypePreview(
  rawType: string | undefined,
  amount: number,
  typeMode: "column" | "all" | "signed",
  incomeValue: string,
  expenseValue: string,
  fallbackType: "income" | "expense"
): "income" | "expense" | "unknown" {
  if (typeMode === "all") return fallbackType;
  if (typeMode === "signed") return amount >= 0 ? "income" : "expense";
  const v = norm(rawType ?? "");
  if (!v) return "unknown";
  if (norm(incomeValue) && v === norm(incomeValue)) return "income";
  if (norm(expenseValue) && v === norm(expenseValue)) return "expense";
  return "unknown";
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

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
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                done ? "bg-emerald-600 text-white" : active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-400"
              }`}>
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

// ─── Composant TypeBadge ──────────────────────────────────────────────────────

function TypeBadge({ type }: { type: "income" | "expense" | "unknown" | string }) {
  if (type === "income") return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Recette</span>;
  if (type === "expense") return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Dépense</span>;
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">?</span>;
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ImportPage() {
  const params = useParams();
  const router = useRouter();
  const org_slug = params.org_slug as string;

  // Stepper
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Fichier
  const [dragging, setDragging] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Mapping colonnes
  const [mapping, setMapping] = useState<Record<MappedField, string>>({
    date: "", amount: "", type: "", description: "",
  });

  // Config type (mode + valeurs)
  const [typeMode, setTypeMode] = useState<"column" | "all" | "signed">("signed");
  const [incomeValue, setIncomeValue] = useState("");
  const [expenseValue, setExpenseValue] = useState("");
  const [fallbackType, setFallbackType] = useState<"income" | "expense">("expense");

  // Résultat
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  // ── Parsing du fichier ─────────────────────────────────────────────────────

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
      setResult(null);

      // Auto-suggest colonnes
      const suggested: Record<MappedField, string> = { date: "", amount: "", type: "", description: "" };
      for (const h of cols) {
        const field = autoSuggest(h);
        if (field !== "ignore" && !suggested[field]) suggested[field] = h;
      }
      setMapping(suggested);

      // Si colonne type auto-détectée : mode "column" + auto-détecter valeurs
      if (suggested.type) {
        setTypeMode("column");
        const vals = uniqueVals(parsed.data, suggested.type);
        const { inc, exp } = detectIncExp(vals);
        setIncomeValue(inc);
        setExpenseValue(exp);
      } else {
        setTypeMode("signed");
        setIncomeValue("");
        setExpenseValue("");
      }

      setStep(2);
    };
    reader.readAsText(file);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }, [parseFile]);

  /** Quand l'utilisateur change la colonne type → recalcule le mode et les valeurs */
  const handleTypeMappingChange = (col: string) => {
    setMapping((m) => ({ ...m, type: col }));
    if (col) {
      setTypeMode("column");
      const vals = uniqueVals(rawData, col);
      const { inc, exp } = detectIncExp(vals);
      setIncomeValue(inc);
      setExpenseValue(exp);
    } else {
      setTypeMode("signed");
      setIncomeValue("");
      setExpenseValue("");
    }
  };

  // ── Import ─────────────────────────────────────────────────────────────────

  const buildTypeConfig = (): TypeConfig => {
    if (typeMode === "column") return { mode: "column", incomeValue, expenseValue };
    if (typeMode === "signed") return { mode: "signed" };
    return { mode: "all", fallbackType };
  };

  const handleImport = async () => {
    setLoading(true);
    setResult(null);
    const rows = applyMapping(rawData, mapping);
    const res = await importTransactions(org_slug, rows, buildTypeConfig());
    setResult(res);
    setLoading(false);
  };

  // ── Dérivé ─────────────────────────────────────────────────────────────────

  const canProceedToStep3 =
    mapping.date !== "" &&
    mapping.amount !== "" &&
    (typeMode === "signed" ||
      typeMode === "all" ||
      (typeMode === "column" && incomeValue.trim() !== "" && expenseValue.trim() !== ""));

  const mappedRows = applyMapping(rawData, mapping);
  const typeVals = mapping.type ? uniqueVals(rawData, mapping.type) : [];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Import CSV</h1>
        <p className="text-slate-500 text-sm mt-1">
          Fonctionne avec n'importe quel export bancaire ou tableur.
        </p>
      </div>

      <Stepper current={step} />

      {/* ── STEP 1 : FICHIER ─────────────────────────────────────────────── */}
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
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
          <p className="text-4xl mb-3">📂</p>
          <p className="font-semibold text-slate-700">Déposez votre fichier CSV ici</p>
          <p className="text-sm text-slate-400 mt-1">ou cliquez pour sélectionner</p>
          <div className="mt-5 text-left inline-block text-xs text-slate-400 space-y-1">
            <p>✓ Exports bancaires (CIC, BNP, Société Générale…)</p>
            <p>✓ Excel exporté en CSV (séparateur virgule ou point-virgule)</p>
            <p>✓ Colonnes dans n'importe quel ordre et langue</p>
          </div>
        </div>
      )}

      {/* ── STEP 2 : MAPPING + CONFIG TYPE ───────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">

          {/* Mapping colonnes */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-baseline">
              <h2 className="font-bold text-slate-900">Association des colonnes</h2>
              <span className="text-xs text-slate-400">{rawData.length} lignes · {headers.length} colonnes</span>
            </div>

            {(["date", "amount", "type", "description"] as MappedField[]).map((field) => (
              <div key={field} className="flex items-center gap-4">
                <label className="w-32 text-sm font-medium text-slate-700 flex-shrink-0">
                  {field === "amount" ? "Montant" : field === "date" ? "Date" : field === "type" ? "Type" : "Description"}
                  {(field === "date" || field === "amount") && <span className="text-red-400 ml-0.5">*</span>}
                  {field === "type" && <span className="text-slate-400 text-xs ml-1">(optionnel)</span>}
                </label>
                <select
                  value={mapping[field]}
                  onChange={(e) =>
                    field === "type"
                      ? handleTypeMappingChange(e.target.value)
                      : setMapping((m) => ({ ...m, [field]: e.target.value }))
                  }
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="">— non mappé —</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Configuration du type */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="font-bold text-slate-900">Comment déterminer le type de chaque transaction ?</h2>

            {/* Sélection du mode */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { mode: "signed" as const, label: "Montant signé", desc: "négatif = dépense\npositif = recette", tag: "Recommandé" },
                { mode: "all" as const, label: "Tout identique", desc: "toutes des recettes\nou toutes des dépenses", tag: null },
                { mode: "column" as const, label: "Colonne CSV", desc: "une colonne contient\nla valeur type", tag: null },
              ].map(({ mode, label, desc, tag }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTypeMode(mode)}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${
                    typeMode === mode
                      ? "border-slate-900 bg-slate-50"
                      : "border-slate-100 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                      typeMode === mode ? "border-slate-900 bg-slate-900" : "border-slate-300"
                    }`} />
                    <span className="text-sm font-semibold text-slate-800">{label}</span>
                    {tag && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold uppercase">{tag}</span>}
                  </div>
                  <p className="text-xs text-slate-400 whitespace-pre-line pl-5">{desc}</p>
                </button>
              ))}
            </div>

            {/* Sous-options selon le mode */}
            {typeMode === "all" && (
              <div className="flex gap-3 pt-1">
                {(["income", "expense"] as const).map((t) => (
                  <label key={t} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer transition ${
                    fallbackType === t ? "border-slate-900 bg-slate-50" : "border-slate-100 hover:border-slate-300"
                  }`}>
                    <input
                      type="radio"
                      className="sr-only"
                      checked={fallbackType === t}
                      onChange={() => setFallbackType(t)}
                    />
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                      fallbackType === t ? "border-slate-900 bg-slate-900" : "border-slate-300"
                    }`} />
                    <span className="text-sm font-semibold">{t === "income" ? "Toutes des recettes" : "Toutes des dépenses"}</span>
                  </label>
                ))}
              </div>
            )}

            {typeMode === "column" && (
              <div className="space-y-3 pt-1">
                {mapping.type ? (
                  <p className="text-xs text-slate-500">
                    Colonne utilisée : <span className="font-mono font-bold text-slate-700">{mapping.type}</span>
                  </p>
                ) : (
                  <p className="text-xs text-amber-600">
                    ⚠ Mappez d'abord une colonne "Type" ci-dessus
                  </p>
                )}

                {/* Hints : valeurs trouvées dans le CSV */}
                {typeVals.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400 font-medium">Valeurs trouvées dans votre fichier :</p>
                    <div className="flex flex-wrap gap-1.5">
                      {typeVals.map((v) => (
                        <span key={v} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      Valeur = Recette
                    </label>
                    <input
                      value={incomeValue}
                      onChange={(e) => setIncomeValue(e.target.value)}
                      placeholder="ex: income, revenu, +, C…"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      Valeur = Dépense
                    </label>
                    <input
                      value={expenseValue}
                      onChange={(e) => setExpenseValue(e.target.value)}
                      placeholder="ex: expense, débit, -, D…"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  La comparaison ignore les majuscules et les accents.
                </p>
              </div>
            )}
          </div>

          {/* Aperçu live — toujours visible si date + montant mappés */}
          {mapping.date && mapping.amount && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <h3 className="font-semibold text-slate-700 text-sm">Aperçu (3 premières lignes)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase">Date</th>
                      <th className="px-4 py-2 text-right text-xs font-bold text-slate-400 uppercase">Montant</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase">Type résolu</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedRows.slice(0, 3).map((row, i) => {
                      const rt = resolveTypePreview(row.type, row.amount, typeMode, incomeValue, expenseValue, fallbackType);
                      return (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-4 py-2 font-mono text-xs text-slate-600">{row.date}</td>
                          <td className="px-4 py-2 font-mono text-xs text-right text-slate-900">
                            {isNaN(row.amount) ? "—" : formatAmount(row.amount)}
                          </td>
                          <td className="px-4 py-2"><TypeBadge type={rt} /></td>
                          <td className="px-4 py-2 text-xs text-slate-500 truncate max-w-[160px]">{row.description || "—"}</td>
                        </tr>
                      );
                    })}
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
              Suivant → ({rawData.length} lignes)
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3 : RECAP + IMPORT ──────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h2 className="font-bold text-slate-900">Récapitulatif</h2>
              <span className="text-sm text-slate-500">{mappedRows.length} transactions</span>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase">Montant</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedRows.map((row, i) => {
                    const rt = resolveTypePreview(row.type, row.amount, typeMode, incomeValue, expenseValue, fallbackType);
                    return (
                      <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-2 text-xs text-slate-400 font-mono">{i + 1}</td>
                        <td className="px-4 py-2 text-xs font-mono text-slate-600">{row.date}</td>
                        <td className="px-4 py-2 text-xs font-mono text-right text-slate-900">
                          {isNaN(row.amount) ? "—" : formatAmount(row.amount)}
                        </td>
                        <td className="px-4 py-2"><TypeBadge type={rt} /></td>
                        <td className="px-4 py-2 text-xs text-slate-500 truncate max-w-[180px]">{row.description || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Résultat import */}
          {result && (
            <div className={`rounded-xl border p-4 space-y-2 ${
              result.errors.length === 0 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
            }`}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="font-semibold text-slate-900">
                  ✅ {result.imported} transaction{result.imported > 1 ? "s" : ""} importée{result.imported > 1 ? "s" : ""}
                </p>
                {result.imported > 0 && (
                  <button
                    onClick={() => router.push(`/${org_slug}/budget`)}
                    onMouseEnter={() => router.prefetch(`/${org_slug}/budget`)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition active:scale-95"
                  >
                    Voir le budget →
                  </button>
                )}
              </div>
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
