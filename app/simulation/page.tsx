"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Spinner,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/lib/auth-context";
import AppShell from "@/app/components/AppShell";
import { useFiscalStore } from "@/lib/fiscal-store";
import { optimize, saveSimulation } from "@/lib/api";
import { BracketDetail, FiscalInput, FiscalResult, PacsAnalysis } from "@/types/fiscal";

function euro(v: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

function pct(v: number) {
  return `${(v * 100).toFixed(0)} %`;
}

const SIM_PRIMARY = "#1B3D2C";

function StatCard({ label, value, sub, accent = false }: {
  label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-2xl font-bold ${accent ? "text-[#3aaa5c]" : "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function DetailDuCalcul({ result }: { result: FiscalResult }) {
  const isReel = result.methodeOptimale === "REEL";
  const deduction = isReel ? result.fraisReels : result.forfaitFrais;
  const revenuNet = isReel ? result.revenuNetReel : result.revenuNetForfait;
  const impotNet = isReel ? result.impotNetReel : result.impotNetForfait;
  const brackets = isReel ? result.bracketDetailsReel : result.bracketDetailsForfait;
  const impotBrut = (brackets || []).reduce((s, b) => s + b.impot, 0);
  const decoteEtReductions = Math.round((impotBrut - impotNet) * 100) / 100;
  const methodLabel = isReel ? "Frais réels kilométriques (utilisés)" : "Déduction forfaitaire 10%";

  const rows: Array<{ label: string; value: string; negative?: boolean; muted?: boolean }> = [
    { label: "Revenu brut total", value: euro(result.revenuTotalBrut) },
    { label: methodLabel, value: `− ${euro(deduction)}`, negative: true },
  ];
  if (result.totalPer > 0) {
    rows.push({ label: "Déduction PER", value: `− ${euro(result.totalPer)}`, negative: true });
  }
  rows.push({ label: "Revenu net imposable", value: euro(revenuNet) });
  rows.push({ label: "Impôt brut (barème)", value: euro(Math.round(impotBrut * 100) / 100) });
  if (decoteEtReductions > 0) {
    rows.push({ label: "Décote & réductions appliquées", value: `− ${euro(decoteEtReductions)}`, negative: true });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800">Détail du calcul</h3>
        <p className="text-xs text-gray-400 mt-0.5">Méthode optimale : {result.methodeOptimale}</p>
      </div>
      <div className="divide-y divide-gray-50">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-600">{row.label}</span>
            <span className={`text-sm font-medium ${row.negative ? "text-red-500" : "text-gray-800"}`}>
              {row.value}
            </span>
          </div>
        ))}
        {/* Impôt net — highlighted row */}
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{ backgroundColor: SIM_PRIMARY }}
        >
          <span className="text-sm font-semibold text-white">Impôt net à payer</span>
          <span className="text-base font-bold text-white">{euro(impotNet)}</span>
        </div>
      </div>
    </div>
  );
}

function BracketTable({ brackets, title }: { brackets: BracketDetail[]; title: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="grid grid-cols-4 px-4 py-3 text-xs font-semibold text-white uppercase tracking-wide"
        style={{ backgroundColor: SIM_PRIMARY }}
      >
        <span>Tranche</span>
        <span className="text-center">Taux</span>
        <span className="text-right">Base imposable</span>
        <span className="text-right">Impôt</span>
      </div>
      <div className="divide-y divide-gray-50">
        {brackets.map((b, i) => (
          <div key={i} className="grid grid-cols-4 px-4 py-2.5 text-sm items-center">
            <span className="text-gray-600">
              {euro(b.lower)} – {b.upper > 1_000_000 ? "∞" : euro(b.upper)}
            </span>
            <span className="text-center">
              <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${
                b.rate === 0 ? "bg-gray-100 text-gray-500"
                : b.rate <= 0.11 ? "bg-blue-100 text-blue-700"
                : b.rate <= 0.30 ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
              }`}>
                {pct(b.rate)}
              </span>
            </span>
            <span className="text-right text-gray-700">{euro(b.montantImposable)}</span>
            <span className="text-right font-semibold text-gray-800">{euro(b.impot)}</span>
          </div>
        ))}
      </div>
      <div className="px-4 py-2.5 text-right text-sm">
        <span className="font-semibold text-gray-500 mr-2">Total</span>
        <span className="font-bold text-gray-900">{euro(brackets.reduce((s, b) => s + b.impot, 0))}</span>
      </div>
    </div>
  );
}

function TaxChart({ result }: { result: FiscalResult }) {
  const data = [
    { name: "Actuel", impot: Math.min(result.impotNetForfait, result.impotNetReel) },
    { name: "Avec PER max", impot: Math.max(0, Math.min(result.impotNetForfait, result.impotNetReel) - (result.tips?.find(t => t.type === "PER")?.economieImpot ?? 0)) },
    { name: "Avec dons max", impot: Math.max(0, Math.min(result.impotNetForfait, result.impotNetReel) - (result.tips?.find(t => t.type === "DONS_66")?.economieImpot ?? 0)) },
  ];
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v: number | undefined) => [euro(v ?? 0), "Impôt estimé"]} cursor={{ fill: "#f9fafb" }} />
        <Bar dataKey="impot" name="Impôt estimé" radius={[6, 6, 0, 0]}
          fill="#1B3D2C"
          label={{ position: "top", formatter: (v: unknown) => `${((Number(v) || 0) / 1000).toFixed(1)}k€`, fontSize: 10, fill: "#6b7280" }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Scenario comparison ──────────────────────────────────────────────────────

interface Scenario {
  label: string;
  description: string;
  applicable: (inp: FiscalInput) => boolean;
  mutate: (inp: FiscalInput) => FiscalInput;
}

const SCENARIOS: Scenario[] = [
  {
    label: "PER +1 000 €",
    description: "Versement supplémentaire de 1 000 € sur votre PER",
    applicable: () => true,
    mutate: (inp) => ({ ...inp, versementPer1: inp.versementPer1 + 1000 }),
  },
  {
    label: "Mariage / PACS",
    description: "Passage en déclaration commune (2 parts de base)",
    applicable: (inp) => inp.situationFamiliale !== "marie_pacse",
    mutate: (inp) => ({ ...inp, situationFamiliale: "marie_pacse" }),
  },
  {
    label: "Don +500 € (66%)",
    description: "Don de 500 € supplémentaires à un organisme éligible à 66%",
    applicable: () => true,
    mutate: (inp) => ({ ...inp, dons66: inp.dons66 + 500 }),
  },
];

interface ScenarioResult {
  scenario: Scenario;
  baseImpot: number;
  newImpot: number;
  delta: number;
  loading: boolean;
  error?: string;
}

function ScenarioCard({ sr }: { sr: ScenarioResult }) {
  const gain = sr.baseImpot - sr.newImpot;
  const isGain = gain > 0;
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="font-semibold text-gray-800 text-sm">{sr.scenario.label}</p>
          <p className="text-xs text-gray-400 mt-0.5">{sr.scenario.description}</p>
        </div>
        {sr.loading && <Spinner size="sm" />}
        {!sr.loading && !sr.error && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${isGain ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {isGain ? `−${euro(gain)}` : "Neutre"}
          </span>
        )}
        {sr.error && <span className="text-xs text-red-500">Erreur</span>}
      </div>
      {!sr.loading && !sr.error && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="font-medium text-gray-700">{euro(sr.baseImpot)}</span>
          <span className="text-gray-300">→</span>
          <span className={`font-semibold ${isGain ? "text-[#1B3D2C]" : "text-gray-700"}`}>{euro(sr.newImpot)}</span>
        </div>
      )}
    </div>
  );
}

// ── Temporary profile panel ───────────────────────────────────────────────────

const SITUATION_OPTIONS = [
  { value: "celibataire", label: "Célibataire" },
  { value: "marie_pacse", label: "Marié / Pacsé" },
  { value: "concubin", label: "Concubin" },
];

function TempField({ label, value, onChange, suffix }: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="relative">
        <input
          type="number" min={0}
          value={value === 0 ? "" : value}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          placeholder="0"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-gray-400 bg-white pr-8"
        />
        {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>}
      </div>
    </div>
  );
}

function TempProfilePanel({ value, onChange, onReset }: {
  value: FiscalInput; onChange: (v: FiscalInput) => void; onReset: () => void;
}) {
  const isCouple = value.situationFamiliale === "marie_pacse";
  function f<K extends keyof FiscalInput>(key: K) { return (v: FiscalInput[K]) => onChange({ ...value, [key]: v }); }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-semibold text-gray-800 text-sm">Profil temporaire</p>
          <p className="text-xs text-gray-400 mt-0.5">Ces valeurs ne sont pas sauvegardées — pour explorer un scénario hypothétique</p>
        </div>
        <button
          onClick={onReset}
          className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors shrink-0"
        >
          Réinitialiser
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <p className="text-xs text-gray-500 mb-1">Situation familiale</p>
          <select
            value={value.situationFamiliale}
            onChange={(e) => f("situationFamiliale")(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-gray-400 bg-white appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: "28px" }}
          >
            {SITUATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <TempField label="Enfants" value={value.nbEnfants} onChange={f("nbEnfants")} />
        <TempField label="Revenu brut D1" value={value.revenu1} onChange={f("revenu1")} suffix="€" />
        {isCouple && <TempField label="Revenu brut D2" value={value.revenu2} onChange={f("revenu2")} suffix="€" />}
        <TempField label="Distance aller" value={value.distanceKmAller} onChange={f("distanceKmAller")} suffix="km" />
        <TempField label="Versements PER" value={value.versementPer1} onChange={f("versementPer1")} suffix="€" />
        <TempField label="Dons 66 %" value={value.dons66} onChange={f("dons66")} suffix="€" />
      </div>
    </div>
  );
}

// ── PACS advice card ──────────────────────────────────────────────────────────

function PacsAdviceCard({ analysis, aiComment }: { analysis: PacsAnalysis; aiComment?: string }) {
  const gain = Math.abs(analysis.gainPacs);
  const color = analysis.pacsAvantageux ? "border-green-300 bg-green-50" : analysis.gainPacs < 0 ? "border-orange-300 bg-orange-50" : "border-gray-200 bg-gray-50";
  const chipColor = analysis.pacsAvantageux ? "success" : analysis.gainPacs < 0 ? "warning" : "default";
  const verdict = analysis.pacsAvantageux
    ? `Le PACS vous ferait économiser ${euro(gain)} d'impôt / an`
    : analysis.gainPacs < 0
    ? `Le PACS vous coûterait ${euro(gain)} d'impôt supplémentaire / an`
    : "Le PACS est fiscalement neutre";

  return (
    <Card className={`border-2 ${color}`}>
      <CardHeader className="pb-2 pt-5 px-6">
        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center gap-3 flex-wrap">
            <Chip color={chipColor} size="lg" variant="solid">
              {analysis.pacsAvantageux ? "PACS avantageux" : analysis.gainPacs < 0 ? "PACS peu avantageux" : "PACS neutre"}
            </Chip>
            <h3 className="font-semibold text-gray-800">Analyse PACS vs Concubinage</h3>
          </div>
          <p className={`text-sm font-medium ${analysis.pacsAvantageux ? "text-green-700" : analysis.gainPacs < 0 ? "text-orange-700" : "text-gray-600"}`}>
            {verdict}
          </p>
        </div>
      </CardHeader>
      <CardBody className="px-6 pb-6 flex flex-col gap-4">
        <Table aria-label="Comparaison PACS vs concubinage" isStriped className="text-sm">
          <TableHeader>
            <TableColumn>Scénario</TableColumn>
            <TableColumn align="end">Impôt total du foyer</TableColumn>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Concubinage (2 déclarations séparées)</TableCell>
              <TableCell className="text-right font-medium">{euro(analysis.impotConcubinage)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>PACS / Mariage (déclaration commune)</TableCell>
              <TableCell className="text-right font-medium">{euro(analysis.impotPacs)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-semibold">Différence</TableCell>
              <TableCell className={`text-right font-bold ${analysis.pacsAvantageux ? "text-green-700" : analysis.gainPacs < 0 ? "text-orange-600" : "text-gray-600"}`}>
                {analysis.pacsAvantageux ? `−${euro(gain)}` : analysis.gainPacs < 0 ? `+${euro(gain)}` : "0 €"}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <div className="bg-white rounded-lg p-4 border border-gray-100">
          <p className="text-sm text-gray-600">{aiComment ?? analysis.raison}</p>
        </div>

        <p className="text-xs text-gray-400">
          Calcul indicatif basé sur le barème 2025. Cette analyse ne tient pas compte des aspects juridiques et patrimoniaux.
          Consultez un notaire ou un expert-comptable pour votre situation réelle.
        </p>
      </CardBody>
    </Card>
  );
}

// ── Save simulation modal ─────────────────────────────────────────────────────

function SaveModal({ isOpen, onClose, onSave, saving }: {
  isOpen: boolean; onClose: () => void; onSave: (label: string) => void; saving: boolean;
}) {
  const [label, setLabel] = useState("");
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalContent>
        <ModalHeader>Sauvegarder la simulation</ModalHeader>
        <ModalBody>
          <Input
            label="Nom de la simulation (optionnel)"
            placeholder="ex. Scénario PER 2025"
            value={label}
            onValueChange={setLabel}
            classNames={{ inputWrapper: "border border-gray-200 shadow-none" }}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>Annuler</Button>
          <Button color="primary" isLoading={saving} onPress={() => onSave(label)}>Sauvegarder</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ── PDF export ────────────────────────────────────────────────────────────────

async function exportPdf(input: FiscalInput, result: FiscalResult, label?: string) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });

  // Header
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("FiscOpti", 14, 12);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Simulation fiscale 2025", 14, 20);
  doc.setFontSize(9);
  doc.text(`Générée le ${today}${label ? ` · ${label}` : ""}`, 14, 26);

  doc.setTextColor(30, 30, 30);

  // Résumé clé
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Résultats clés", 14, 40);

  autoTable(doc, {
    startY: 44,
    head: [["Indicateur", "Forfait (10%)", "Frais réels"]],
    body: [
      ["Revenu brut total", euro(result.revenuTotalBrut), euro(result.revenuTotalBrut)],
      ["Déduction totale", euro(result.forfaitFrais), euro(result.fraisReels)],
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

  const y1 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  const methode = result.methodeOptimale === "REEL" ? "Frais réels recommandés" : "Forfait 10% recommandé";
  doc.setTextColor(58, 170, 92);
  doc.text(`→ ${methode} · Économie : ${euro(result.economie)} · TMI : ${pct(result.tmi)}`, 14, y1);
  doc.setTextColor(30, 30, 30);

  // Inputs
  const y2 = y1 + 10;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Données de la simulation", 14, y2);

  const situationLabel: Record<string, string> = {
    celibataire: "Célibataire",
    marie_pacse: "Marié / Pacsé",
    concubin: "Concubin",
  };

  autoTable(doc, {
    startY: y2 + 4,
    head: [["Paramètre", "Valeur"]],
    body: [
      ["Situation familiale", situationLabel[input.situationFamiliale] ?? input.situationFamiliale],
      ["Enfants à charge", String(input.nbEnfants)],
      ["Salaire brut (D1)", euro(input.revenu1)],
      ...(input.situationFamiliale === "marie_pacse" ? [["Salaire brut (D2)", euro(input.revenu2)]] : []),
      ["Distance domicile-travail (aller)", `${input.distanceKmAller} km`],
      ["Jours sur site", input.joursSite === 0 ? "Calcul auto" : `${input.joursSite} j`],
      ["Congés payés", `${input.congesPayes} j`],
      ["RTT", `${input.rtt} j`],
      ["Versements PER (D1)", euro(input.versementPer1)],
      ...(input.situationFamiliale === "marie_pacse" ? [["Versements PER (D2)", euro(input.versementPer2)]] : []),
      ["Dons 66%", euro(input.dons66)],
      ["Dons 75%", euro(input.dons75)],
    ],
    theme: "striped",
    headStyles: { fillColor: [100, 100, 100] },
    styles: { fontSize: 9 },
  });

  // Brackets
  const y3 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Tranches d'imposition", 14, y3);

  const optBrackets = result.methodeOptimale === "REEL" ? result.bracketDetailsReel : result.bracketDetailsForfait;
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

  // Footer
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text("Calcul indicatif basé sur le barème 2025. Consultez un expert pour votre situation réelle. © 2026 FiscOpti", 14, 290);
    doc.text(`${i} / ${pageCount}`, 196, 290, { align: "right" });
  }

  const filename = label ? `fiscopti-${label.replace(/\s+/g, "-").toLowerCase()}.pdf` : "fiscopti-simulation.pdf";
  doc.save(filename);
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SimulationPage() {
  const { authenticated, initializing } = useAuth();
  const router = useRouter();
  const { input, setInput, result, setResult } = useFiscalStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scenarios, setScenarios] = useState<ScenarioResult[]>([]);
  const [savedSimLabel, setSavedSimLabel] = useState<string | undefined>();
  const [savingSimulation, setSavingSimulation] = useState(false);
  const [aiSummary, setAiSummary] = useState<{ summary: string; tips: string[]; pacsComment?: string } | null>(null);
  const [showTempPanel, setShowTempPanel] = useState(false);
  const [tempInput, setTempInput] = useState<FiscalInput>(input);
  const { isOpen: isSaveOpen, onOpen: onSaveOpen, onClose: onSaveClose } = useDisclosure();

  useEffect(() => {
    if (!initializing && !authenticated) router.replace("/login");
  }, [initializing, authenticated, router]);

  // Keep tempInput in sync with the saved profile when not in temp mode
  useEffect(() => {
    if (!showTempPanel) setTempInput(input);
  }, [input, showTempPanel]);

  const runSimulation = useCallback(async () => {
    setError("");
    setLoading(true);
    setScenarios([]);
    setSavedSimLabel(undefined);
    setAiSummary(null);
    try {
      const res = await optimize(tempInput);
      setResult(res);
      // Async AI summary — non-blocking, silently ignored on error
      fetch("/api/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: tempInput, result: res }),
      })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => { if (data && !data.error) setAiSummary(data); })
        .catch(() => undefined);
      const baseImpot = Math.min(res.impotNetForfait, res.impotNetReel);
      const applicableScenarios = SCENARIOS.filter((s) => s.applicable(tempInput));
      const initial: ScenarioResult[] = applicableScenarios.map((s) => ({
        scenario: s, baseImpot, newImpot: 0, delta: 0, loading: true,
      }));
      setScenarios(initial);
      applicableScenarios.forEach((s, i) => {
        optimize(s.mutate(tempInput))
          .then((sr) => {
            const newImpot = Math.min(sr.impotNetForfait, sr.impotNetReel);
            setScenarios((prev) =>
              prev.map((p, j) => j === i ? { ...p, loading: false, newImpot, delta: baseImpot - newImpot } : p)
            );
          })
          .catch((e: unknown) => {
            setScenarios((prev) =>
              prev.map((p, j) => j === i ? { ...p, loading: false, error: e instanceof Error ? e.message : "Erreur" } : p)
            );
          });
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors du calcul");
    } finally {
      setLoading(false);
    }
  }, [tempInput, setResult]);

  async function handleSaveSimulation(label: string) {
    setSavingSimulation(true);
    try {
      await saveSimulation(tempInput, label || undefined);
      setSavedSimLabel(label || "Simulation");
      onSaveClose();
    } catch {
      // keep modal open
    } finally {
      setSavingSimulation(false);
    }
  }

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Simulation fiscale</h1>
          <p className="text-sm text-gray-500 mt-0.5">Barème progressif IR 2025 (revenus 2024)</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
          <Button size="sm" variant="flat" className="border border-gray-200 text-gray-600"
            onPress={() => router.push("/profil")}>
            Modifier le profil
          </Button>
          <Button
            size="sm" variant="flat"
            onPress={() => {
              setShowTempPanel((v) => {
                if (v) setTempInput(input); // reset on close
                return !v;
              });
            }}
            className={showTempPanel ? "border border-blue-300 bg-blue-50 text-blue-700" : "border border-gray-200 text-gray-600"}
          >
            {showTempPanel ? "Annuler le scénario" : "Tester un scénario"}
          </Button>
          {result && !savedSimLabel && (
            <Button size="sm" variant="bordered" onPress={onSaveOpen}
              className="border-gray-300 text-gray-700">
              Sauvegarder
            </Button>
          )}
          {result && savedSimLabel && (
            <Chip color="success" variant="flat" size="sm">✓ Sauvegardée</Chip>
          )}
          {result && (
            <Button size="sm" variant="flat"
              onPress={() => exportPdf(input, result, savedSimLabel)}
              className="border border-gray-200 text-gray-600">
              ↓ Export PDF
            </Button>
          )}
          <Button
            size="sm"
            onPress={runSimulation}
            isLoading={loading}
            className="font-semibold text-white rounded-lg px-4"
            style={{ backgroundColor: SIM_PRIMARY }}
          >
            Lancer la simulation
          </Button>
        </div>
      </div>

      {showTempPanel && (
        <div className="mb-5">
          <TempProfilePanel
            value={tempInput}
            onChange={setTempInput}
            onReset={() => setTempInput(input)}
          />
        </div>
      )}

      {error && (
        <Card className="mb-4 border border-danger-200 bg-danger-50">
          <CardBody><p className="text-danger text-sm">{error}</p></CardBody>
        </Card>
      )}

      {loading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" label="Calcul en cours…" />
        </div>
      )}

      {!loading && result && (
        <div className="flex flex-col gap-6">
          {/* 4 stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Impôt actuel"
              value={euro(Math.min(result.impotNetForfait, result.impotNetReel))}
              sub={`TMI : ${pct(result.tmi)}`}
            />
            <StatCard
              label="Impôt optimisé"
              value={result.methodeOptimale}
              sub={`Forfait ${euro(result.impotNetForfait)} · Réel ${euro(result.impotNetReel)}`}
            />
            <StatCard
              label="Économie potentielle"
              value={euro(result.economie)}
              sub={result.methodeOptimale === "REEL" ? "Frais réels vs forfait" : "Forfait vs frais réels"}
              accent
            />
            <StatCard
              label="Parts fiscales"
              value={String(result.parts)}
              sub={`QF : ${euro(Math.min(result.revenuNetForfait, result.revenuNetReel) / result.parts)}`}
            />
          </div>

          {/* Comparaison des scénarios — bar chart */}
          {scenarios.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-1">Comparaison des scénarios</h3>
              <p className="text-xs text-gray-400 mb-4">Impôt estimé selon différentes stratégies d&apos;optimisation</p>
              <TaxChart result={result} />
            </div>
          )}

          {/* Détail du calcul */}
          <DetailDuCalcul result={result} />

          {/* Détail par tranche */}
          {result.bracketDetailsForfait && result.bracketDetailsForfait.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2 text-sm">Détail par tranche d&apos;imposition (TMI)</h3>
              <BracketTable
                brackets={result.methodeOptimale === "REEL" ? result.bracketDetailsReel : result.bracketDetailsForfait}
                title="Tranches"
              />
            </div>
          )}

          {/* Recommandations IA */}
          {(aiSummary || result.tips.length > 0) && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#eef6f1" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1B3D2C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Analyse & recommandations</h3>
                  <p className="text-xs text-gray-400">{aiSummary ? "Générée par IA sur la base de vos chiffres exacts" : "Chargement de l'analyse…"}</p>
                </div>
              </div>
              {aiSummary ? (
                <div className="p-5 flex flex-col gap-4">
                  {/* Summary paragraph */}
                  <p className="text-sm text-gray-700 leading-relaxed">{aiSummary.summary}</p>
                  {/* Tips */}
                  {aiSummary.tips.length > 0 && (
                    <ul className="flex flex-col gap-2">
                      {aiSummary.tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-3 rounded-xl border border-gray-100 p-3">
                          <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: "#3aaa5c" }} />
                          <p className="text-sm text-gray-700">{tip}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="p-5 flex flex-col gap-3">
                  {/* Fallback: raw tips while AI loads */}
                  {result.tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl border border-gray-100 p-3">
                      <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: "#3aaa5c" }} />
                      <p className="text-sm text-gray-700">
                        {tip.type === "PER"
                          ? `Versez ${euro(tip.montant)} sur un PER pour économiser ${euro(tip.economieImpot)} d'impôt.`
                          : `Un don de ${euro(tip.montant)} à 66% vous ferait économiser ${euro(tip.economieImpot)}.`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PACS analysis (concubin with partner data) */}
          {result.pacsAnalysis && (
            <PacsAdviceCard analysis={result.pacsAnalysis} aiComment={aiSummary?.pacsComment} />
          )}

          {/* Scenario comparison cards */}
          {scenarios.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {scenarios.map((sr, i) => <ScenarioCard key={i} sr={sr} />)}
            </div>
          )}

          <p className="text-xs text-gray-400 text-center pt-2">
            Calcul indicatif basé sur le barème progressif 2025. Consultez un expert pour votre situation réelle.
          </p>
        </div>
      )}

      {!loading && !result && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-24 flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-2" style={{ backgroundColor: "#eef6f1" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1B3D2C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <p className="text-gray-700 text-lg font-semibold">Prêt à calculer votre impôt</p>
          <p className="text-sm text-gray-400 max-w-xs">Complétez votre profil et lancez la simulation pour obtenir votre estimation fiscale 2025.</p>
          <button
            onClick={runSimulation}
            className="mt-2 px-6 py-2.5 rounded-xl font-semibold text-white text-sm"
            style={{ backgroundColor: SIM_PRIMARY }}
          >
            Lancer la simulation
          </button>
        </div>
      )}

      <SaveModal
        isOpen={isSaveOpen}
        onClose={onSaveClose}
        onSave={handleSaveSimulation}
        saving={savingSimulation}
      />
    </AppShell>
  );
}
