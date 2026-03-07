"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Switch } from "@heroui/react";
import { useAuth } from "@/lib/auth-context";
import AppShell from "@/app/components/AppShell";
import { useFiscalStore } from "@/lib/fiscal-store";
import { getSelf, saveProfile } from "@/lib/api";
import { FiscalInput } from "@/types/fiscal";

// ── Design tokens ─────────────────────────────────────────────────────────────
const PRIMARY = "#1B3D2C";
const PRIMARY_LIGHT = "#eef6f1";

// ── Options ───────────────────────────────────────────────────────────────────

const SITUATION_OPTIONS = [
  { value: "celibataire", label: "Célibataire" },
  { value: "marie_pacse", label: "Marié / Pacsé" },
  { value: "concubin", label: "Concubin" },
];

const PUISSANCE_OPTIONS = [
  { value: "0", label: "Forfaitaire (0,35 €/km)" },
  { value: "3", label: "3 CV fiscaux" },
  { value: "4", label: "4 CV fiscaux" },
  { value: "5", label: "5 CV fiscaux" },
  { value: "6", label: "6 CV fiscaux" },
  { value: "7", label: "7 CV et plus" },
];

// ── Shared field components ───────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-gray-500 mb-1">{children}</p>;
}

function NumberField({
  label, value, onChange, suffix, hint, warning, error,
}: {
  label: string; value: number; onChange: (v: number) => void;
  suffix?: string; hint?: string; warning?: string; error?: string;
}) {
  const borderClass = error
    ? "border-red-400 focus:border-red-500 focus:ring-red-200"
    : warning
    ? "border-amber-400 focus:border-amber-500 focus:ring-amber-200"
    : "border-gray-200 focus:border-[#1B3D2C] focus:ring-[#1B3D2C]/20";
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative">
        <input
          type="number"
          min={0}
          value={value === 0 ? "" : value}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          placeholder="0"
          className={`w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-1 transition-all pr-10 ${borderClass}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-0.5">↑ {error}</p>}
      {!error && warning && <p className="text-xs text-amber-600 mt-0.5">↑ {warning}</p>}
      {!error && !warning && hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#1B3D2C] focus:ring-1 focus:ring-[#1B3D2C]/20 bg-white transition-all appearance-none"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: "28px" }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function Counter({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-all text-lg leading-none"
        >
          −
        </button>
        <span className="w-8 text-center font-semibold text-gray-800 text-base">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-all text-lg leading-none"
        >
          +
        </button>
      </div>
    </div>
  );
}

function SituationPills({
  value, onChange,
}: {
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <FieldLabel>Situation familiale</FieldLabel>
      <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
        {SITUATION_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex-1 py-1.5 px-1 rounded-lg text-xs font-medium transition-all ${
              value === o.value
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CardHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[#1B3D2C]">{icon}</span>
      <h2 className="font-semibold text-gray-800">{title}</h2>
    </div>
  );
}

// ── Validation ────────────────────────────────────────────────────────────────

const PASS_2025 = 46368;

function computeWarnings(input: FiscalInput) {
  const w: Record<string, string> = {};

  // CP / RTT / TT sanity
  if (input.congesPayes > 50) w.congesPayes = "Plus de 50 j de congés — vérifiez";
  if (input.rtt > 30) w.rtt = "Plus de 30 j de RTT — vérifiez";
  if (input.joursTeleTravail > 200) w.joursTeleTravail = "Plus de 200 j de télétravail — vérifiez";

  // Always show computed joursSite
  const computed = Math.max(0, 260 - input.congesPayes - input.rtt - input.joursTeleTravail - 8);
  w.joursSiteInfo = `${computed} j sur site (260 − ${input.congesPayes} CP − ${input.rtt} RTT − ${input.joursTeleTravail} TT − 8 fériés)`;

  // Distance > 80 km : administration peut exiger justification
  if (input.distanceKmAller > 80) {
    w.distanceKmAller = "Au-delà de 80 km, une justification de trajet peut être demandée";
  }

  // PER plafond : 10 % du revenu net fiscal, max 8 × PASS = 37 094 €
  if (input.revenu1 > 0) {
    const perMax1 = Math.min(input.revenu1 * 0.09, PASS_2025 * 0.8);
    if (input.versementPer1 > perMax1) {
      w.versementPer1 = `Dépasse le plafond estimé de ${Math.round(perMax1).toLocaleString("fr-FR")} € (10 % du revenu net, max 8 PASS)`;
    }
  }

  // Dons 75 % : au-delà de 1 000 € le surplus bascule à 66 %
  if (input.dons75 > 1000) {
    w.dons75 = "Au-delà de 1 000 €, le surplus est taxé au taux 66 % (CGI art. 200 bis)";
  }

  // Total dons > 20 % du revenu net imposable
  if (input.revenu1 > 0) {
    const plafondDons = input.revenu1 * 0.9 * 0.2;
    if (input.dons66 + input.dons75 > plafondDons) {
      w.dons66 = `Dons > 20 % du revenu net (max ~${Math.round(plafondDons).toLocaleString("fr-FR")} €) — l'excédent est reportable sur 5 ans`;
    }
  }

  return w;
}

// ── Save status ───────────────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved" | "error";
const DEBOUNCE_MS = 1500;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilPage() {
  const { authenticated, initializing } = useAuth();
  const router = useRouter();
  const { input, setInput } = useFiscalStore();

  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);

  useEffect(() => {
    if (initializing) return;
    if (!authenticated) { router.replace("/login"); return; }
    getSelf()
      .then((user) => {
        if (user.fiscalProfile) {
          skipNextSave.current = true;
          setInput(user.fiscalProfile as FiscalInput);
        }
        setLoaded(true);
      })
      .catch(() => { setLoadError("Impossible de charger votre profil."); setLoaded(true); });
  }, [initializing, authenticated, router, setInput]);

  useEffect(() => {
    if (!loaded || !authenticated) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    setSaveStatus("idle");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await saveProfile(input);
        setSaveStatus("saved");
        savedTimer.current = setTimeout(() => setSaveStatus("idle"), 2500);
      } catch { setSaveStatus("error"); }
    }, DEBOUNCE_MS);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [input, loaded, authenticated]);

  const isCouple = input.situationFamiliale === "marie_pacse";
  const isConcubin = input.situationFamiliale === "concubin";
  const showPartnerCard = isCouple || isConcubin;
  const warn = computeWarnings(input);

  function field<K extends keyof typeof input>(key: K) {
    return (v: typeof input[K]) => setInput({ ...input, [key]: v });
  }

  const saveLabel = {
    idle: null,
    saving: <span className="text-xs text-gray-400 animate-pulse">Sauvegarde…</span>,
    saved: <span className="text-xs font-medium" style={{ color: "#3aaa5c" }}>✓ Profil sauvegardé</span>,
    error: <span className="text-xs text-red-500 font-medium">Erreur de sauvegarde</span>,
  }[saveStatus];

  return (
    <AppShell>
      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mon profil fiscal</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-gray-500">Renseignez votre situation pour une simulation précise.</p>
            {saveLabel}
          </div>
        </div>
        <Button
          onPress={() => router.push("/simulation")}
          isDisabled={!loaded}
          className="font-semibold text-white rounded-xl shrink-0"
          style={{ backgroundColor: PRIMARY }}
        >
          Lancer la simulation →
        </Button>
      </div>

      {loadError && <p className="text-sm text-red-500 mb-4">{loadError}</p>}

      {/* ── Row 1: Déclarants ── */}
      <div className={`grid gap-4 mb-4 ${showPartnerCard ? "grid-cols-2" : "grid-cols-1 max-w-lg"}`}>

        {/* Déclarant principal */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <CardHeader
            title="Déclarant principal"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            }
          />
          <div className="flex flex-col gap-3.5">
            <SituationPills value={input.situationFamiliale} onChange={field("situationFamiliale")} />
            <Counter label="Nombre d'enfants à charge" value={input.nbEnfants} onChange={field("nbEnfants")} />
            <NumberField label="Revenu brut annuel" value={input.revenu1} onChange={field("revenu1")} suffix="€" hint="Salaire brut avant charges patronales" />
            <NumberField label="Distance domicile-travail (aller)" value={input.distanceKmAller} onChange={field("distanceKmAller")} suffix="km" hint="Distance aller simple en km" warning={warn.distanceKmAller} />
            <div className="grid grid-cols-3 gap-3">
              <NumberField label="Congés payés" value={input.congesPayes} onChange={field("congesPayes")} suffix="j" warning={warn.congesPayes} />
              <NumberField label="RTT" value={input.rtt} onChange={field("rtt")} suffix="j" warning={warn.rtt} />
              <NumberField label="Télétravail" value={input.joursTeleTravail} onChange={field("joursTeleTravail")} suffix="j" warning={warn.joursTeleTravail} />
            </div>
            <p className="text-xs text-gray-400 -mt-1">{warn.joursSiteInfo}</p>
          </div>
        </div>

        {/* Déclarant secondaire */}
        {showPartnerCard && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <CardHeader
              title={isCouple ? "Déclarant secondaire" : "Concubin(e)"}
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
            />
            {isConcubin && (
              <div
                className="text-xs rounded-lg px-3 py-2 mb-3.5"
                style={{ backgroundColor: PRIMARY_LIGHT, color: PRIMARY }}
              >
                En renseignant ces données, FiscOpti peut estimer si un PACS serait fiscalement avantageux.
              </div>
            )}
            <div className="flex flex-col gap-3.5">
              <NumberField label="Revenu brut annuel" value={input.revenu2} onChange={field("revenu2")} suffix="€" />
              <NumberField label="Distance domicile-travail (aller)" value={input.distanceKm2} onChange={field("distanceKm2")} suffix="km" />
              <div className="grid grid-cols-3 gap-3">
                <NumberField label="Congés payés" value={input.congesPayes2} onChange={field("congesPayes2")} suffix="j" />
                <NumberField label="RTT" value={input.rtt2} onChange={field("rtt2")} suffix="j" />
                <NumberField label="Télétravail" value={input.joursTeleTravail2} onChange={field("joursTeleTravail2")} suffix="j" />
              </div>
              <p className="text-xs text-gray-400 -mt-1">{Math.max(0, 260 - input.congesPayes2 - input.rtt2 - input.joursTeleTravail2 - 8)} j sur site</p>
              <NumberField label="Versements PER" value={input.versementPer2} onChange={field("versementPer2")} suffix="€" />
              {isConcubin && (
                <p className="text-xs text-gray-400">Les enfants sont supposés déclarés par le déclarant 1.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Row 2: Transport & Épargne ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Transport & frais professionnels */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <CardHeader
            title="Transport & frais professionnels"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v5" />
                <circle cx="16" cy="17" r="2" /><circle cx="7" cy="17" r="2" />
              </svg>
            }
          />
          <div className="flex flex-col gap-3.5">
            <SelectField
              label="Motorisation du véhicule"
              value={String(input.puissanceFiscale)}
              onChange={(v) => field("puissanceFiscale")(Number(v))}
              options={PUISSANCE_OPTIONS}
            />
            <div className="flex items-center gap-3 py-1">
              <Switch
                isSelected={input.presenceCantine}
                onValueChange={field("presenceCantine")}
                size="sm"
              />
              <span className="text-sm text-gray-700">Repas à la cantine d&apos;entreprise</span>
            </div>
            {!input.presenceCantine && (
              <NumberField
                label="Part patronale ticket resto / jour"
                value={input.tiquetRestau}
                onChange={field("tiquetRestau")}
                suffix="€/j"
                hint="Part employeur du ticket restaurant par jour (ex : 6 € si ticket à 10 € pris en charge à 60 %)"
              />
            )}
          </div>
        </div>

        {/* Épargne & dons */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <CardHeader
            title="Épargne & dons"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10" />
                <path d="M12 6v6l4 2" />
                <path d="M22 2 16 8" /><path d="M17 2h5v5" />
              </svg>
            }
          />
          <div className="flex flex-col gap-3.5">
            <NumberField
              label="Versements PER annuels"
              value={input.versementPer1}
              onChange={field("versementPer1")}
              suffix="€"
              hint="Plan d'Épargne Retraite — déduit de votre revenu imposable"
              warning={warn.versementPer1}
            />
            <NumberField
              label="Dons (réduction 66%)"
              value={input.dons66}
              onChange={field("dons66")}
              suffix="€"
              hint="Associations reconnues d'utilité publique"
              warning={warn.dons66}
            />
            <NumberField
              label="Dons urgence (réduction 75%)"
              value={input.dons75}
              onChange={field("dons75")}
              suffix="€"
              hint="Max 1 000 € à 75 % — le surplus est traité à 66 %"
              warning={warn.dons75}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
