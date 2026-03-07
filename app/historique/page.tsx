"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardBody,
  Button,
  Chip,
  Spinner,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";
import { useAuth } from "@/lib/auth-context";
import AppShell from "@/app/components/AppShell";
import { listSimulations, SimulationRecord } from "@/lib/api";
import { FiscalInput, FiscalResult, BracketDetail } from "@/types/fiscal";

function euro(v: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}
function pct(v: number) { return `${(v * 100).toFixed(0)} %`; }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const SITUATION_LABELS: Record<string, string> = {
  celibataire: "Célibataire",
  marie_pacse: "Marié / Pacsé",
  concubin: "Concubin",
};

// ── PDF export ────────────────────────────────────────────────────────────────

async function exportSimulationPdf(record: SimulationRecord) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  const input: FiscalInput = record.fiscalInput;
  const result: FiscalResult = record.fiscalResult;
  const label = record.label;
  const date = formatDate(record.simulatedAt);

  // ── Header band ──
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, 210, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("FiscOpti", 14, 13);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Simulation fiscale · Barème 2025", 14, 21);
  doc.setFontSize(8);
  doc.text(`${date}${label ? ` · ${label}` : ""}`, 14, 27);
  doc.setTextColor(30, 30, 30);

  // ── Key metrics band ──
  const bestImpot = Math.min(result.impotNetForfait, result.impotNetReel);
  doc.setFillColor(240, 244, 248);
  doc.rect(0, 30, 210, 18, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 95);
  const metrics = [
    { k: "Revenu brut", v: euro(result.revenuTotalBrut) },
    { k: "TMI", v: pct(result.tmi) },
    { k: `Impôt (${result.methodeOptimale})`, v: euro(bestImpot) },
    { k: "Économie", v: euro(result.economie) },
  ];
  metrics.forEach((m, i) => {
    const x = 14 + i * 48;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(m.k, x, 37);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 95);
    doc.text(m.v, x, 44);
  });
  doc.setTextColor(30, 30, 30);

  // ── Méthode recommandée ──
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(58, 170, 92);
  doc.text(
    `→ ${result.methodeOptimale === "REEL" ? "Frais réels recommandés" : "Forfait 10% recommandé"}`,
    14, 55
  );
  doc.setTextColor(30, 30, 30);

  // ── Données de la simulation ──
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Données de la simulation", 14, 64);

  autoTable(doc, {
    startY: 68,
    head: [["Paramètre", "Valeur"]],
    body: [
      ["Situation familiale", SITUATION_LABELS[input.situationFamiliale] ?? input.situationFamiliale],
      ["Enfants à charge", String(input.nbEnfants)],
      ["Salaire brut (D1)", euro(input.revenu1)],
      ...(input.situationFamiliale === "marie_pacse" ? [["Salaire brut (D2)", euro(input.revenu2)]] : []),
      ["Distance domicile-travail (aller)", `${input.distanceKmAller} km`],
      ["Congés payés (D1)", `${input.congesPayes} j`],
      ["RTT (D1)", `${input.rtt} j`],
      ["Télétravail (D1)", `${input.joursTeleTravail ?? 0} j`],
      ["Jours sur site D1 (calculé)", `${Math.max(0, 260 - input.congesPayes - input.rtt - (input.joursTeleTravail ?? 0) - 8)} j`],
      ["Versements PER (D1)", euro(input.versementPer1)],
      ...(input.situationFamiliale === "marie_pacse" ? [["Versements PER (D2)", euro(input.versementPer2)]] : []),
      ["Dons 66%", euro(input.dons66)],
      ["Dons 75%", euro(input.dons75)],
    ],
    theme: "striped",
    headStyles: { fillColor: [80, 80, 80] },
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 } },
  });

  const y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // ── Comparaison méthodes ──
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Comparaison des méthodes", 14, y2);

  autoTable(doc, {
    startY: y2 + 4,
    head: [["Indicateur", "Forfait (10%)", "Frais réels"]],
    body: [
      ["Déduction", euro(result.forfaitFrais), euro(result.fraisReels)],
      ["  dont frais km", "—", euro(result.fraisKm)],
      ["  dont frais repas", "—", euro(result.fraisRepas)],
      ["Déduction PER", euro(result.totalPer), euro(result.totalPer)],
      ["Revenu net imposable", euro(result.revenuNetForfait), euro(result.revenuNetReel)],
      ["Parts fiscales", String(result.parts), String(result.parts)],
      ["Impôt net", euro(result.impotNetForfait), euro(result.impotNetReel)],
    ],
    theme: "grid",
    headStyles: { fillColor: [30, 58, 95], textColor: 255 },
    columnStyles: { 0: { fontStyle: "bold" } },
    styles: { fontSize: 9 },
  });

  const y3 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // ── Tranches d'imposition ──
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Tranches d'imposition (méthode ${result.methodeOptimale})`, 14, y3);

  const optBrackets: BracketDetail[] = result.methodeOptimale === "REEL"
    ? result.bracketDetailsReel : result.bracketDetailsForfait;

  autoTable(doc, {
    startY: y3 + 4,
    head: [["Tranche", "Taux", "Montant imposable", "Impôt"]],
    body: optBrackets.map((b) => [
      `${euro(b.lower)} – ${b.upper > 1_000_000 ? "∞" : euro(b.upper)}`,
      pct(b.rate),
      euro(b.montantImposable),
      euro(b.impot),
    ]),
    theme: "grid",
    headStyles: { fillColor: [30, 58, 95], textColor: 255 },
    styles: { fontSize: 9 },
  });

  // ── Footer ──
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      "Calcul indicatif basé sur le barème 2025. Consultez un expert pour votre situation réelle. © 2026 FiscOpti",
      14, 290
    );
    doc.text(`${i} / ${pageCount}`, 196, 290, { align: "right" });
  }

  const filename = label
    ? `fiscopti-${label.replace(/\s+/g, "-").toLowerCase()}.pdf`
    : `fiscopti-${record.id.slice(0, 8)}.pdf`;
  doc.save(filename);
}

// ── Simulation row / detail ───────────────────────────────────────────────────

function SimulationRow({ record, expanded, onToggle }: {
  record: SimulationRecord;
  expanded: boolean;
  onToggle: () => void;
}) {
  const r = record.fiscalResult;
  const bestImpot = Math.min(r.impotNetForfait, r.impotNetReel);

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm bg-white">
      {/* Summary row */}
      <button
        className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 truncate">
              {record.label || "Simulation sans titre"}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{formatDate(record.simulatedAt)}</p>
          </div>
          <div className="flex items-center gap-6 text-sm shrink-0">
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Revenu brut</p>
              <p className="font-semibold text-gray-800">{euro(r.revenuTotalBrut)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide">TMI</p>
              <p className="font-semibold text-amber-600">{pct(r.tmi)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Impôt</p>
              <p className="font-semibold text-red-600">{euro(bestImpot)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Économie</p>
              <p className="font-semibold text-emerald-600">{euro(r.economie)}</p>
            </div>
            <Chip
              size="sm"
              color={r.methodeOptimale === "REEL" ? "primary" : "success"}
              variant="flat"
            >
              {r.methodeOptimale === "REEL" ? "Frais réels" : "Forfait"}
            </Chip>
            <span className="text-gray-400 text-xs">{expanded ? "▲" : "▼"}</span>
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-5 bg-[#f8fafb]">
          <div className="flex justify-end mb-4">
            <Button size="sm" variant="flat" color="primary" onPress={() => exportSimulationPdf(record)}>
              Télécharger PDF
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Inputs */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Données saisies</p>
              <div className="flex flex-col gap-1.5 text-sm">
                {[
                  ["Situation", SITUATION_LABELS[record.fiscalInput.situationFamiliale]],
                  ["Enfants", String(record.fiscalInput.nbEnfants)],
                  ["Salaire brut (D1)", euro(record.fiscalInput.revenu1)],
                  ...(record.fiscalInput.situationFamiliale === "marie_pacse"
                    ? [["Salaire brut (D2)", euro(record.fiscalInput.revenu2)]] : []),
                  ["Distance km", `${record.fiscalInput.distanceKmAller} km`],
                  ["PER (D1)", euro(record.fiscalInput.versementPer1)],
                  ...(record.fiscalInput.situationFamiliale === "marie_pacse"
                    ? [["PER (D2)", euro(record.fiscalInput.versementPer2)]] : []),
                  ["Dons 66%", euro(record.fiscalInput.dons66)],
                  ["Dons 75%", euro(record.fiscalInput.dons75)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-medium text-gray-800">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Results */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Résultats</p>
              <div className="flex flex-col gap-1.5 text-sm mb-4">
                {[
                  ["Déduction forfait", euro(r.forfaitFrais)],
                  ["Frais réels (km + repas)", euro(r.fraisReels)],
                  ["Déduction PER totale", euro(r.totalPer)],
                  ["Rev. net imposable (forfait)", euro(r.revenuNetForfait)],
                  ["Rev. net imposable (réel)", euro(r.revenuNetReel)],
                  ["Parts fiscales", String(r.parts)],
                  ["Impôt forfait", euro(r.impotNetForfait)],
                  ["Impôt frais réels", euro(r.impotNetReel)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-medium text-gray-800">{v}</span>
                  </div>
                ))}
              </div>

              {/* Bracket table (optimal method) */}
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                Tranches ({r.methodeOptimale})
              </p>
              <Table aria-label="Tranches" isStriped className="text-xs">
                <TableHeader>
                  <TableColumn>Tranche</TableColumn>
                  <TableColumn>Taux</TableColumn>
                  <TableColumn align="end">Impôt</TableColumn>
                </TableHeader>
                <TableBody>
                  {(r.methodeOptimale === "REEL" ? r.bracketDetailsReel : r.bracketDetailsForfait).map((b, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{euro(b.lower)}–{b.upper > 1_000_000 ? "∞" : euro(b.upper)}</TableCell>
                      <TableCell>
                        <Chip size="sm" variant="flat"
                          color={b.rate === 0 ? "default" : b.rate < 0.3 ? "primary" : b.rate < 0.41 ? "warning" : "danger"}>
                          {pct(b.rate)}
                        </Chip>
                      </TableCell>
                      <TableCell className="text-right font-medium">{euro(b.impot)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HistoriquePage() {
  const { authenticated, initializing } = useAuth();
  const router = useRouter();
  const [simulations, setSimulations] = useState<SimulationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (initializing) return;
    if (!authenticated) { router.replace("/login"); return; }

    listSimulations()
      .then((data) => {
        // Sort newest first
        setSimulations(data.sort((a, b) =>
          new Date(b.simulatedAt).getTime() - new Date(a.simulatedAt).getTime()
        ));
      })
      .catch(() => setError("Impossible de charger vos simulations."))
      .finally(() => setLoading(false));
  }, [initializing, authenticated, router]);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes simulations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {simulations.length > 0
              ? `${simulations.length} simulation${simulations.length > 1 ? "s" : ""} sauvegardée${simulations.length > 1 ? "s" : ""}`
              : "Retrouvez ici toutes vos simulations sauvegardées"}
          </p>
        </div>
        <Button color="primary" onPress={() => router.push("/simulation")}>
          Nouvelle simulation →
        </Button>
      </div>

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      {loading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" label="Chargement…" />
        </div>
      )}

      {!loading && simulations.length === 0 && !error && (
        <Card className="py-20">
          <CardBody className="flex flex-col items-center gap-4 text-center">
            <p className="text-gray-500 text-lg font-medium">Aucune simulation sauvegardée</p>
            <p className="text-sm text-gray-400">
              Lancez une simulation depuis l&apos;onglet Simulation et cliquez sur &quot;Sauvegarder&quot;.
            </p>
            <Button color="primary" onPress={() => router.push("/simulation")}>
              Lancer une simulation
            </Button>
          </CardBody>
        </Card>
      )}

      {!loading && simulations.length > 0 && (
        <div className="flex flex-col gap-3">
          {simulations.map((sim) => (
            <SimulationRow
              key={sim.id}
              record={sim}
              expanded={expandedId === sim.id}
              onToggle={() => setExpandedId(expandedId === sim.id ? null : sim.id)}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
