// ============================================================================
// src/app/(dashboard)/[org_slug]/closures/pdf/route.ts
// Route handler qui génère et stream le PDF — GET /[org_slug]/closures/pdf
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { fetchPdfData } from "../pdf-data";
import { FinancialReport } from "../report-pdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ org_slug: string }> }
) {
  const { org_slug } = await params;

  try {
    const data = await fetchPdfData(org_slug);

    // renderToBuffer côté serveur — jamais dans le browser bundle
    const buffer = await renderToBuffer(
      createElement(FinancialReport, { data })
    );

    const filename = `bilan-${org_slug}-${new Date().toISOString().slice(0, 7)}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.byteLength.toString(),
        // Pas de cache — les données changent à chaque clôture
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}