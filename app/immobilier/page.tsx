"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  SelectItem,
  Button,
  Tabs,
  Tab,
  Chip,
  Divider,
} from "@heroui/react";
import { useAuth } from "@/lib/auth-context";
import AppShell from "@/app/components/AppShell";

function euro(v: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

function NumberField({
  label,
  value,
  onChange,
  endContent,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  endContent?: string;
}) {
  return (
    <Input
      type="number"
      label={label}
      value={value === 0 ? "" : String(value)}
      onValueChange={(v) => onChange(v === "" ? 0 : Number(v))}
      min={0}
      endContent={endContent ? <span className="text-sm text-gray-400">{endContent}</span> : undefined}
    />
  );
}

// ─── Location nue ───────────────────────────────────────────────────────────

interface LocationNueInput {
  loyersAnnuels: number;
  chargesDeductibles: number;
  interetsEmprunt: number;
  travauxDeductibles: number;
  taxeFonciere: number;
}

function computeLocationNue(inp: LocationNueInput) {
  // Micro-foncier: 30% abattement, plafonné à 15 000 € de loyers bruts
  const microFoncier = inp.loyersAnnuels <= 15000;
  const baseImposableMicro = microFoncier ? inp.loyersAnnuels * 0.7 : null;

  // Réel
  const totalCharges = inp.chargesDeductibles + inp.interetsEmprunt + inp.travauxDeductibles + inp.taxeFonciere;
  const baseImposableReel = inp.loyersAnnuels - totalCharges;
  const deficitFoncier = baseImposableReel < 0 ? Math.abs(baseImposableReel) : 0;

  return { baseImposableMicro, baseImposableReel, deficitFoncier, totalCharges, microFoncier };
}

function LocationNueTab() {
  const [inp, setInp] = useState<LocationNueInput>({
    loyersAnnuels: 0,
    chargesDeductibles: 0,
    interetsEmprunt: 0,
    travauxDeductibles: 0,
    taxeFonciere: 0,
  });
  const [result, setResult] = useState<ReturnType<typeof computeLocationNue> | null>(null);

  function field(key: keyof LocationNueInput) {
    return (v: number) => setInp((prev) => ({ ...prev, [key]: v }));
  }

  function simulate() {
    setResult(computeLocationNue(inp));
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><h3 className="font-semibold">Revenus & Charges</h3></CardHeader>
        <CardBody className="gap-4">
          <NumberField label="Loyers annuels bruts" value={inp.loyersAnnuels} onChange={field("loyersAnnuels")} endContent="€" />
          <NumberField label="Charges de copropriété déductibles" value={inp.chargesDeductibles} onChange={field("chargesDeductibles")} endContent="€" />
          <NumberField label="Intérêts d'emprunt" value={inp.interetsEmprunt} onChange={field("interetsEmprunt")} endContent="€" />
          <NumberField label="Travaux déductibles" value={inp.travauxDeductibles} onChange={field("travauxDeductibles")} endContent="€" />
          <NumberField label="Taxe foncière" value={inp.taxeFonciere} onChange={field("taxeFonciere")} endContent="€" />
          <Button color="primary" onPress={simulate} className="mt-2">Comparer micro vs réel</Button>
        </CardBody>
      </Card>

      {result && (
        <Card className="border border-gray-200">
          <CardHeader><h3 className="font-semibold">Résultat</h3></CardHeader>
          <CardBody className="gap-4">
            {/* Micro-foncier */}
            <div className={`rounded-lg p-4 ${result.microFoncier ? "bg-green-50 border border-green-200" : "bg-gray-100 border"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Chip size="sm" color={result.microFoncier ? "success" : "default"} variant="flat">Micro-foncier</Chip>
                {!result.microFoncier && <span className="text-xs text-gray-400">(non éligible &gt; 15 000 €)</span>}
              </div>
              {result.microFoncier && result.baseImposableMicro !== null ? (
                <>
                  <p className="text-sm text-gray-700">Abattement 30% appliqué</p>
                  <p className="text-xl font-bold text-gray-800 mt-1">Base imposable : {euro(result.baseImposableMicro)}</p>
                </>
              ) : (
                <p className="text-sm text-gray-500">Régime non disponible</p>
              )}
            </div>

            {/* Réel */}
            <div className="rounded-lg p-4 bg-blue-50 border border-blue-200">
              <Chip size="sm" color="primary" variant="flat" className="mb-2">Régime réel</Chip>
              <p className="text-sm text-gray-700">Total charges déduites : {euro(result.totalCharges)}</p>
              {result.baseImposableReel >= 0 ? (
                <p className="text-xl font-bold text-gray-800 mt-1">Base imposable : {euro(result.baseImposableReel)}</p>
              ) : (
                <>
                  <p className="text-xl font-bold text-gray-800 mt-1">Base imposable : 0 €</p>
                  <p className="text-sm text-green-700 font-medium">Déficit foncier : {euro(result.deficitFoncier)} (imputable sur revenu global)</p>
                </>
              )}
            </div>

            <Divider />
            <div className="text-sm text-amber-700 bg-amber-50 rounded p-3">
              <strong>Méthode optimale : </strong>
              {result.microFoncier && result.baseImposableMicro !== null
                ? result.baseImposableMicro <= result.baseImposableReel
                  ? "Micro-foncier (base imposable plus faible)"
                  : "Régime réel (base imposable plus faible)"
                : "Régime réel (micro non éligible)"}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

// ─── LMNP ───────────────────────────────────────────────────────────────────

interface LmnpInput {
  loyersAnnuels: number;
  chargesExploitation: number;
  interetsEmprunt: number;
  amortissementBien: number;   // durée 25-30 ans typiquement
  amortissementMobilier: number;
  prixAchat: number;
  dureeAmortissementAns: number;
}

function computeLmnp(inp: LmnpInput) {
  // Micro-BIC: 50% abattement, plafonné 77 700 € de recettes
  const microBic = inp.loyersAnnuels <= 77700;
  const baseImposableMicro = microBic ? inp.loyersAnnuels * 0.5 : null;

  // Réel simplifié
  const amortAnnuel = inp.dureeAmortissementAns > 0
    ? inp.prixAchat / inp.dureeAmortissementAns
    : inp.amortissementBien;
  const totalCharges = inp.chargesExploitation + inp.interetsEmprunt + amortAnnuel + inp.amortissementMobilier;
  const baseImposableReel = Math.max(0, inp.loyersAnnuels - totalCharges);

  return { baseImposableMicro, baseImposableReel, totalCharges, amortAnnuel, microBic };
}

function LmnpTab() {
  const [inp, setInp] = useState<LmnpInput>({
    loyersAnnuels: 0,
    chargesExploitation: 0,
    interetsEmprunt: 0,
    amortissementBien: 0,
    amortissementMobilier: 0,
    prixAchat: 0,
    dureeAmortissementAns: 25,
  });
  const [result, setResult] = useState<ReturnType<typeof computeLmnp> | null>(null);

  function field(key: keyof LmnpInput) {
    return (v: number) => setInp((prev) => ({ ...prev, [key]: v }));
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><h3 className="font-semibold">Revenus & Charges LMNP</h3></CardHeader>
        <CardBody className="gap-4">
          <NumberField label="Loyers annuels (recettes)" value={inp.loyersAnnuels} onChange={field("loyersAnnuels")} endContent="€" />
          <NumberField label="Charges d'exploitation" value={inp.chargesExploitation} onChange={field("chargesExploitation")} endContent="€" />
          <NumberField label="Intérêts d'emprunt" value={inp.interetsEmprunt} onChange={field("interetsEmprunt")} endContent="€" />
          <NumberField label="Prix d'achat du bien (pour amortissement)" value={inp.prixAchat} onChange={field("prixAchat")} endContent="€" />
          <Select
            label="Durée d'amortissement du bien"
            selectedKeys={[String(inp.dureeAmortissementAns)]}
            onSelectionChange={(keys) => {
              const val = Array.from(keys)[0] as string;
              setInp((prev) => ({ ...prev, dureeAmortissementAns: Number(val) }));
            }}
          >
            {["20", "25", "30", "33"].map((v) => (
              <SelectItem key={v}>{v} ans</SelectItem>
            ))}
          </Select>
          <NumberField label="Amortissement mobilier annuel" value={inp.amortissementMobilier} onChange={field("amortissementMobilier")} endContent="€" />
          <Button color="primary" onPress={() => setResult(computeLmnp(inp))} className="mt-2">
            Comparer micro-BIC vs réel
          </Button>
        </CardBody>
      </Card>

      {result && (
        <Card className="border border-gray-200">
          <CardHeader><h3 className="font-semibold">Résultat LMNP</h3></CardHeader>
          <CardBody className="gap-4">
            <div className={`rounded-lg p-4 ${result.microBic ? "bg-green-50 border border-green-200" : "bg-gray-100 border"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Chip size="sm" color={result.microBic ? "success" : "default"} variant="flat">Micro-BIC</Chip>
                {!result.microBic && <span className="text-xs text-gray-400">(non éligible &gt; 77 700 €)</span>}
              </div>
              {result.microBic && result.baseImposableMicro !== null ? (
                <>
                  <p className="text-sm text-gray-700">Abattement 50% appliqué</p>
                  <p className="text-xl font-bold text-gray-800 mt-1">Base imposable : {euro(result.baseImposableMicro)}</p>
                </>
              ) : (
                <p className="text-sm text-gray-500">Régime non disponible</p>
              )}
            </div>

            <div className="rounded-lg p-4 bg-blue-50 border border-blue-200">
              <Chip size="sm" color="primary" variant="flat" className="mb-2">Réel simplifié</Chip>
              <p className="text-sm text-gray-700">Amortissement annuel du bien : {euro(result.amortAnnuel)}</p>
              <p className="text-sm text-gray-700">Total charges déduites : {euro(result.totalCharges)}</p>
              <p className="text-xl font-bold text-gray-800 mt-1">Base imposable : {euro(result.baseImposableReel)}</p>
            </div>

            <Divider />
            <div className="text-sm text-amber-700 bg-amber-50 rounded p-3">
              <strong>Méthode optimale : </strong>
              {result.microBic && result.baseImposableMicro !== null
                ? result.baseImposableMicro <= result.baseImposableReel
                  ? "Micro-BIC (base imposable plus faible)"
                  : "Réel simplifié (amortissements plus avantageux)"
                : "Réel simplifié (micro-BIC non éligible)"}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ImmobilierPage() {
  const { authenticated, initializing } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!initializing && !authenticated) router.replace("/login");
  }, [initializing, authenticated, router]);

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Revenus Immobiliers</h1>
      <Tabs aria-label="Type de location" color="primary" variant="underlined" size="lg">
        <Tab key="location-nue" title="Location nue (foncier)">
          <div className="pt-4">
            <LocationNueTab />
          </div>
        </Tab>
        <Tab key="lmnp" title="LMNP (meublé)">
          <div className="pt-4">
            <LmnpTab />
          </div>
        </Tab>
      </Tabs>
      <p className="text-xs text-gray-400 mt-8 text-center">
        Calcul indicatif. Consultez un expert-comptable pour le régime LMNP.
      </p>
    </AppShell>
  );
}
