// ============================================================================
// src/app/(dashboard)/[org_slug]/closures/report-pdf.tsx
// Template PDF — @react-pdf/renderer (Node.js only, jamais importé côté client)
// ============================================================================

import {
  Document, Page, Text, View, StyleSheet, Font,
} from "@react-pdf/renderer";
import type { PdfReportData } from "./pdf-data";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(cents: number): string {
  const euros = cents / 100;
  const [int, dec] = Math.abs(euros).toFixed(2).split(".");
  const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
  return `${euros < 0 ? "-" : ""}${formatted},${dec} €`;
}

const formatMonth = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

// ─── Styles ───────────────────────────────────────────────────────────────────

const BLUE   = "#1E3A5F";
const LIGHT  = "#EEF2F8";
const GREEN  = "#166534";
const GREEN_BG = "#DCFCE7";
const RED    = "#991B1B";
const RED_BG = "#FEE2E2";
const AMBER  = "#92400E";
const AMBER_BG = "#FEF3C7";
const GRAY   = "#6B7280";
const BORDER = "#E5E7EB";
const WHITE  = "#FFFFFF";

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#111827",
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    backgroundColor: WHITE,
  },

  // ── Cover ──
  coverPage: {
    fontFamily: "Helvetica",
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    backgroundColor: BLUE,
  },
  coverTop: {
    backgroundColor: BLUE,
    padding: 64,
    flex: 1,
    justifyContent: "center",
  },
  coverLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  coverTitle: {
    fontSize: 32,
    fontFamily: "Helvetica-Bold",
    color: WHITE,
    marginBottom: 8,
  },
  coverSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 48,
  },
  coverMeta: {
    fontSize: 10,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 6,
  },
  coverMetaVal: {
    color: WHITE,
    fontFamily: "Helvetica-Bold",
  },
  coverBottom: {
    backgroundColor: "rgba(0,0,0,0.2)",
    padding: 24,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  coverBottomText: {
    fontSize: 9,
    color: "rgba(255,255,255,0.5)",
  },

  // ── Section ──
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: BLUE,
    marginTop: 24,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: BLUE,
  },

  // ── Summary cards ──
  cardsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  card: {
    flex: 1,
    backgroundColor: LIGHT,
    borderRadius: 6,
    padding: 12,
  },
  cardLabel: {
    fontSize: 7,
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: BLUE,
  },
  cardValueGreen: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
  },
  cardValueRed: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: RED,
  },

  // ── Table ──
  table: {
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: BLUE,
    borderRadius: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 2,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: WHITE,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    alignItems: "center",
  },
  tableRowAlt: {
    backgroundColor: "#F9FAFB",
  },
  tableCell: {
    fontSize: 8.5,
    color: "#374151",
  },
  tableCellBold: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  tableCellGreen: { fontSize: 8.5, color: GREEN, fontFamily: "Helvetica-Bold" },
  tableCellRed:   { fontSize: 8.5, color: RED,   fontFamily: "Helvetica-Bold" },
  tableCellAmber: { fontSize: 8.5, color: AMBER, fontFamily: "Helvetica-Bold" },
  tableCellGray:  { fontSize: 8.5, color: GRAY },

  // ── Badge ──
  badgeGreen: {
    backgroundColor: GREEN_BG,
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 5,
    fontSize: 7,
    color: GREEN,
    fontFamily: "Helvetica-Bold",
  },
  badgeAmber: {
    backgroundColor: AMBER_BG,
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 5,
    fontSize: 7,
    color: AMBER,
    fontFamily: "Helvetica-Bold",
  },
  badgeBlue: {
    backgroundColor: LIGHT,
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 5,
    fontSize: 7,
    color: BLUE,
    fontFamily: "Helvetica-Bold",
  },

  // ── Category bar ──
  catRow: {
    marginBottom: 8,
  },
  catHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  catName: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#111827" },
  catAmount: { fontSize: 8.5, color: GRAY },
  catBarBg: {
    height: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 3,
    overflow: "hidden",
  },
  catBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: BLUE,
  },

  // ── Footer ──
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: GRAY,
  },

  // ── Alert box ──
  alertBox: {
    flexDirection: "row",
    backgroundColor: AMBER_BG,
    borderRadius: 4,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  alertText: {
    fontSize: 8,
    color: AMBER,
    flex: 1,
  },
});

// ─── Sub-components ───────────────────────────────────────────────────────────

function Footer({ orgName, page }: { orgName: string; page: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{orgName} — Bilan Financier</Text>
      <Text style={s.footerText}>{page}</Text>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

// ─── Cover Page ───────────────────────────────────────────────────────────────

function CoverPage({ data }: { data: PdfReportData }) {
  const firstClosure = data.closures.find((c) => c.is_initial);
  const lastClosure = [...data.closures].reverse().find((c) => !c.is_initial);

  const period = firstClosure && lastClosure
    ? `${formatMonth(firstClosure.month)} → ${formatMonth(lastClosure.month)}`
    : firstClosure
    ? `Depuis ${formatMonth(firstClosure.month)}`
    : "Période non définie";

  return (
    <Page size="A4" style={s.coverPage}>
      <View style={s.coverTop}>
        <Text style={s.coverLabel}>Bilan Financier · Rapport de Clôture</Text>
        <Text style={s.coverTitle}>{data.org.name}</Text>
        <Text style={s.coverSub}>{period}</Text>

        <View style={{ gap: 8 }}>
          <Text style={s.coverMeta}>
            Généré par  <Text style={s.coverMetaVal}>{data.generatedBy}</Text>
          </Text>
          <Text style={s.coverMeta}>
            Date  <Text style={s.coverMetaVal}>{formatDate(data.generatedAt)}</Text>
          </Text>
          <Text style={s.coverMeta}>
            Transactions  <Text style={s.coverMetaVal}>{data.summary.transaction_count}</Text>
          </Text>
        </View>
      </View>

      <View style={s.coverBottom}>
        <Text style={s.coverBottomText}>Document confidentiel — Usage interne</Text>
        <Text style={s.coverBottomText}>Généré par Projet B</Text>
      </View>
    </Page>
  );
}

// ─── Summary Page ─────────────────────────────────────────────────────────────

function SummaryPage({ data }: { data: PdfReportData }) {
  const { summary } = data;
  const netPositive = summary.net >= 0;

  return (
    <Page size="A4" style={s.page}>
      <SectionTitle>1. Résumé Financier</SectionTitle>

      {/* Cards row 1 */}
      <View style={s.cardsRow}>
        <View style={s.card}>
          <Text style={s.cardLabel}>Solde d'ouverture</Text>
          <Text style={s.cardValue}>{formatAmount(summary.opening_balance)}</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardLabel}>Solde de clôture</Text>
          <Text style={s.cardValue}>{formatAmount(summary.closing_balance)}</Text>
        </View>
        <View style={{ ...s.card, backgroundColor: netPositive ? GREEN_BG : RED_BG }}>
          <Text style={s.cardLabel}>Variation nette</Text>
          <Text style={netPositive ? s.cardValueGreen : s.cardValueRed}>
            {netPositive ? "+" : ""}{formatAmount(summary.net)}
          </Text>
        </View>
      </View>

      {/* Cards row 2 */}
      <View style={s.cardsRow}>
        <View style={s.card}>
          <Text style={s.cardLabel}>Total recettes</Text>
          <Text style={s.cardValueGreen}>{formatAmount(summary.total_income)}</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardLabel}>Total dépenses</Text>
          <Text style={s.cardValueRed}>{formatAmount(summary.total_expense)}</Text>
        </View>
        <View style={{ ...s.card, backgroundColor: summary.missing_receipts_count > 0 ? AMBER_BG : GREEN_BG }}>
          <Text style={s.cardLabel}>Justificatifs manquants</Text>
          <Text style={summary.missing_receipts_count > 0 ? { ...s.cardValue, color: AMBER } : s.cardValueGreen}>
            {summary.missing_receipts_count}
          </Text>
        </View>
      </View>

      {/* Categories */}
      <SectionTitle>2. Répartition par Catégorie</SectionTitle>

      {data.categories.length === 0 ? (
        <Text style={s.tableCellGray}>Aucune catégorie avec transactions.</Text>
      ) : (() => {
        const maxExpense = Math.max(...data.categories.map((c) => c.total_expense), 1);
        return data.categories.map((cat, i) => (
          <View key={i} style={s.catRow}>
            <View style={s.catHeader}>
              <Text style={s.catName}>{cat.name}</Text>
              <Text style={s.catAmount}>
                {formatAmount(cat.total_expense)}{cat.total_income > 0 ? ` · +${formatAmount(cat.total_income)}` : ""}
                {"  "}({cat.transaction_count} tx)
              </Text>
            </View>
            <View style={s.catBarBg}>
              <View style={{
                ...s.catBarFill,
                width: `${Math.round((cat.total_expense / maxExpense) * 100)}%`,
                backgroundColor: cat.color || BLUE,
              }} />
            </View>
          </View>
        ));
      })()}

      <Footer orgName={data.org.name} page="Résumé · Catégories" />
    </Page>
  );
}

// ─── Closures Page ────────────────────────────────────────────────────────────

function ClosuresPage({ data }: { data: PdfReportData }) {
  const hasGaps = data.closures.some((c) => c.delta !== 0 && !c.is_initial);

  return (
    <Page size="A4" style={s.page}>
      <SectionTitle>3. Rapprochement Bancaire Mensuel</SectionTitle>

      {hasGaps && (
        <View style={s.alertBox}>
          <Text style={s.alertText}>
            ⚠ Des écarts ont été détectés sur certains mois. Chaque ligne en anomalie
            doit faire l'objet d'une vérification (frais bancaires non saisis,
            virement hors système, erreur de saisie).
          </Text>
        </View>
      )}

      <View style={s.table}>
        <View style={s.tableHeader}>
          <Text style={{ ...s.tableHeaderCell, width: "20%" }}>Mois</Text>
          <Text style={{ ...s.tableHeaderCell, width: "22%", textAlign: "right" }}>Solde banque</Text>
          <Text style={{ ...s.tableHeaderCell, width: "22%", textAlign: "right" }}>Solde système</Text>
          <Text style={{ ...s.tableHeaderCell, width: "18%", textAlign: "right" }}>Écart</Text>
          <Text style={{ ...s.tableHeaderCell, width: "18%", textAlign: "center" }}>Statut</Text>
        </View>

        {data.closures.map((closure, i) => (
          <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
            <Text style={{ ...s.tableCellBold, width: "20%", textTransform: "capitalize" }}>
              {closure.is_initial ? "⬤ " : ""}{formatMonth(closure.month)}
            </Text>
            <Text style={{ ...s.tableCell, width: "22%", textAlign: "right" }}>
              {formatAmount(closure.bank_balance)}
            </Text>
            <Text style={{ ...s.tableCellGray, width: "22%", textAlign: "right" }}>
              {closure.is_initial ? "—" : formatAmount(closure.computed_balance)}
            </Text>
            <Text style={{
              ...(closure.delta === 0 ? s.tableCellGreen : s.tableCellAmber),
              width: "18%",
              textAlign: "right",
            }}>
              {closure.is_initial ? "—" : closure.delta === 0 ? "✓ 0,00 €" : `${closure.delta > 0 ? "+" : ""}${formatAmount(closure.delta)}`}
            </Text>
            <View style={{ width: "18%", alignItems: "center" }}>
              {closure.is_initial ? (
                <Text style={s.badgeBlue}>Solde initial</Text>
              ) : closure.delta === 0 ? (
                <Text style={s.badgeGreen}>Équilibré</Text>
              ) : (
                <Text style={s.badgeAmber}>Écart</Text>
              )}
            </View>
          </View>
        ))}
      </View>

      <Footer orgName={data.org.name} page="Rapprochement bancaire" />
    </Page>
  );
}

// ─── Missing Receipts Page ────────────────────────────────────────────────────

function MissingReceiptsPage({ data }: { data: PdfReportData }) {
  if (data.missing_receipts.length === 0) return null;

  return (
    <Page size="A4" style={s.page}>
      <SectionTitle>4. Transactions sans Justificatif</SectionTitle>

      <View style={s.alertBox}>
        <Text style={s.alertText}>
          Ces {data.missing_receipts.length} transaction(s) ne disposent d'aucun
          justificatif attaché. Elles doivent être régularisées avant la passation
          du mandat.{data.missing_receipts.length > 50 ? " (50 premières affichées)" : ""}
        </Text>
      </View>

      <View style={s.table}>
        <View style={s.tableHeader}>
          <Text style={{ ...s.tableHeaderCell, width: "16%" }}>Date</Text>
          <Text style={{ ...s.tableHeaderCell, width: "38%" }}>Libellé</Text>
          <Text style={{ ...s.tableHeaderCell, width: "22%" }}>Catégorie</Text>
          <Text style={{ ...s.tableHeaderCell, width: "24%", textAlign: "right" }}>Montant</Text>
        </View>

        {data.missing_receipts.map((t, i) => (
          <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
            <Text style={{ ...s.tableCellGray, width: "16%" }}>{formatDate(t.date)}</Text>
            <Text style={{ ...s.tableCell, width: "38%" }} numberOfLines={1}>
              {t.description || "Sans libellé"}
            </Text>
            <Text style={{ ...s.tableCellGray, width: "22%" }}>
              {t.category_name ?? "—"}
            </Text>
            <Text style={{
              ...(t.type === "income" ? s.tableCellGreen : s.tableCellRed),
              width: "24%",
              textAlign: "right",
            }}>
              {t.type === "expense" ? "-" : "+"}{formatAmount(t.amount)}
            </Text>
          </View>
        ))}
      </View>

      <Footer orgName={data.org.name} page="Anomalies — justificatifs manquants" />
    </Page>
  );
}

// ─── Main Document ────────────────────────────────────────────────────────────

export function FinancialReport({ data }: { data: PdfReportData }) {
  return (
    <Document
      title={`Bilan Financier — ${data.org.name}`}
      author={data.generatedBy}
      subject="Rapport de clôture de mandat"
      creator="Projet B"
    >
      <CoverPage data={data} />
      <SummaryPage data={data} />
      <ClosuresPage data={data} />
      <MissingReceiptsPage data={data} />
    </Document>
  );
}