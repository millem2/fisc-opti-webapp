"use client";

import { useRef, useState } from "react";
import { FiscalInput } from "@/types/fiscal";

// ── Types ──────────────────────────────────────────────────────────────────────

interface FichePaieExtraction {
  revenu1?: number | null;
  revenu1_label?: string | null;
  netImposable?: number | null;
  distanceKmAller?: number | null;
  tiquetRestau?: number | null;
  presenceCantine?: boolean | null;
  joursTeleTravail?: number | null;
  congesPayes?: number | null;
  rtt?: number | null;
  versementPer1?: number | null;
  employeur?: string | null;
  periode?: string | null;
  notes?: string[];
}

// ── Field definitions (mapped to FiscalInput keys) ────────────────────────────

type FieldType = "number" | "boolean";

interface FieldDef {
  extractedKey: keyof FichePaieExtraction;
  fiscalKey: keyof FiscalInput;
  label: string;
  type: FieldType;
  suffix?: string;
  noteKey?: keyof FichePaieExtraction;
}

const FIELDS: FieldDef[] = [
  {
    extractedKey: "revenu1",
    fiscalKey: "revenu1",
    label: "Revenu brut annuel",
    type: "number",
    suffix: "€",
    noteKey: "revenu1_label",
  },
  {
    extractedKey: "distanceKmAller",
    fiscalKey: "distanceKmAller",
    label: "Distance domicile-travail (aller)",
    type: "number",
    suffix: "km",
  },
  {
    extractedKey: "tiquetRestau",
    fiscalKey: "tiquetRestau",
    label: "Part patronale ticket restaurant / jour",
    type: "number",
    suffix: "€/j",
  },
  {
    extractedKey: "presenceCantine",
    fiscalKey: "presenceCantine",
    label: "Repas à la cantine d'entreprise",
    type: "boolean",
  },
  {
    extractedKey: "joursTeleTravail",
    fiscalKey: "joursTeleTravail",
    label: "Jours de télétravail / an",
    type: "number",
    suffix: "j",
  },
  {
    extractedKey: "congesPayes",
    fiscalKey: "congesPayes",
    label: "Congés payés",
    type: "number",
    suffix: "j",
  },
  {
    extractedKey: "rtt",
    fiscalKey: "rtt",
    label: "RTT",
    type: "number",
    suffix: "j",
  },
  {
    extractedKey: "versementPer1",
    fiscalKey: "versementPer1",
    label: "Versements PER annuels",
    type: "number",
    suffix: "€",
  },
];

// ── Design tokens ──────────────────────────────────────────────────────────────

const PRIMARY = "#1B3D2C";
const PRIMARY_LIGHT = "#eef6f1";

// ── Step indicator ─────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: "upload" | "analyzing" | "review" }) {
  const steps = [
    { key: "upload", label: "Document" },
    { key: "analyzing", label: "Analyse" },
    { key: "review", label: "Validation" },
  ];
  const idx = steps.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center mb-6">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center transition-all ${
                i <= idx ? "text-white" : "bg-gray-100 text-gray-400"
              }`}
              style={i <= idx ? { backgroundColor: PRIMARY } : undefined}
            >
              {i < idx ? "✓" : i + 1}
            </div>
            <span className={`text-xs font-medium ${i === idx ? "text-gray-800" : "text-gray-400"}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 h-px mx-2 ${i < idx ? "bg-[#1B3D2C]" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Field row ──────────────────────────────────────────────────────────────────

function FieldRow({
  def,
  rawValue,
  note,
  checked,
  editedValue,
  onToggle,
  onEdit,
}: {
  def: FieldDef;
  rawValue: unknown;
  note?: string | null;
  checked: boolean;
  editedValue: unknown;
  onToggle: () => void;
  onEdit: (v: unknown) => void;
}) {
  const displayValue = editedValue !== undefined ? editedValue : rawValue;

  const valueInput =
    def.type === "boolean" ? (
      <div className="flex items-center gap-1.5">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onEdit(v)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
              displayValue === v
                ? "border-[#1B3D2C] bg-[#eef6f1] text-[#1B3D2C]"
                : "border-gray-200 text-gray-500"
            }`}
          >
            {v ? "Oui" : "Non"}
          </button>
        ))}
      </div>
    ) : (
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          value={displayValue == null ? "" : String(displayValue)}
          onChange={(e) => onEdit(e.target.value === "" ? null : Number(e.target.value))}
          className="w-28 px-2 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#1B3D2C] focus:ring-1 focus:ring-[#1B3D2C]/20"
        />
        {def.suffix && (
          <span className="text-xs text-gray-400 whitespace-nowrap">{def.suffix}</span>
        )}
      </div>
    );

  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
        checked ? "border-[#1B3D2C]/30 bg-[#eef6f1]" : "border-gray-100 bg-white opacity-60"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 rounded accent-[#1B3D2C] shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{def.label}</p>
        {note && <p className="text-xs text-gray-400 mt-0.5 leading-tight">{note}</p>}
      </div>
      <div className="shrink-0">{valueInput}</div>
    </label>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onApply: (partial: Partial<FiscalInput>) => void;
}

export default function DocumentScanModal({ onClose, onApply }: Props) {
  const [step, setStep] = useState<"upload" | "analyzing" | "review">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [extraction, setExtraction] = useState<FichePaieExtraction | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [edited, setEdited] = useState<Record<string, unknown>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(f: File) {
    setError("");
    setFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }

  async function analyze() {
    if (!file) return;
    setError("");
    setStep("analyzing");

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/analyze-document", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Erreur lors de l'analyse");

      const ext = data.extracted as FichePaieExtraction;
      setExtraction(ext);

      const initialChecked: Record<string, boolean> = {};
      for (const f of FIELDS) {
        const val = ext[f.extractedKey];
        initialChecked[f.extractedKey] = val !== null && val !== undefined;
      }
      setChecked(initialChecked);
      setEdited({});
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
      setStep("upload");
    }
  }

  function apply() {
    if (!extraction) return;
    const partial: Partial<FiscalInput> = {};
    for (const f of FIELDS) {
      if (!checked[f.extractedKey]) continue;
      const value = edited[f.extractedKey] !== undefined
        ? edited[f.extractedKey]
        : extraction[f.extractedKey];
      if (value !== null && value !== undefined) {
        (partial as Record<string, unknown>)[f.fiscalKey] = value;
      }
    }
    onApply(partial);
    onClose();
  }

  const extractedFields = extraction
    ? FIELDS.filter((f) => {
        const v = extraction[f.extractedKey];
        return v !== null && v !== undefined;
      })
    : [];

  const hasAnyChecked = Object.values(checked).some(Boolean);
  const metaLine = extraction
    ? [extraction.employeur, extraction.periode].filter(Boolean).join(" — ")
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900 text-base">
              Compléter depuis une fiche de paie
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              De préférence celle de décembre — le document n'est jamais sauvegardé.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <StepIndicator step={step} />

          {/* ── Upload ── */}
          {step === "upload" && (
            <div className="flex flex-col gap-4">
              {/* Why December tip */}
              <div className="rounded-xl px-4 py-3 text-xs leading-relaxed" style={{ backgroundColor: PRIMARY_LIGHT, color: PRIMARY }}>
                <span className="font-semibold">Pourquoi décembre ?</span> La fiche de décembre contient les{" "}
                <span className="font-semibold">cumuls annuels</span> (brut, net imposable, PER…),
                ce qui donne une image fidèle de l'année entière plutôt qu'un seul mois.
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  dragOver
                    ? "border-[#1B3D2C] bg-[#eef6f1]"
                    : file
                    ? "border-[#1B3D2C]/50 bg-[#eef6f1]/50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: PRIMARY_LIGHT }}>
                      📄
                    </div>
                    <p className="text-sm font-medium text-gray-800 truncate max-w-xs">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} Ko — cliquez pour changer</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-2xl">⬆️</div>
                    <p className="text-sm font-medium text-gray-700">Glissez votre fiche de paie ici</p>
                    <p className="text-xs text-gray-400">PDF, JPG, PNG · max 10 Mo</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</div>
              )}

              <p className="text-xs text-gray-400 text-center">
                Votre document est transmis à l'IA pour analyse uniquement et n'est jamais stocké.
              </p>
            </div>
          )}

          {/* ── Analyzing ── */}
          {step === "analyzing" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl animate-pulse" style={{ backgroundColor: PRIMARY_LIGHT }}>
                🔍
              </div>
              <div className="text-center">
                <p className="font-medium text-gray-800">Analyse en cours…</p>
                <p className="text-sm text-gray-400 mt-1">Lecture des cumuls annuels et données fiscales</p>
              </div>
              <div className="flex gap-1 mt-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{ backgroundColor: PRIMARY, animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Review ── */}
          {step === "review" && extraction && (
            <div className="flex flex-col gap-3">
              {/* Summary banner */}
              <div className="rounded-xl px-4 py-3 text-sm flex items-center justify-between" style={{ backgroundColor: PRIMARY_LIGHT, color: PRIMARY }}>
                <span className="font-medium">
                  {extractedFields.length} information{extractedFields.length > 1 ? "s" : ""} extraite{extractedFields.length > 1 ? "s" : ""}
                </span>
                {metaLine && <span className="text-xs opacity-80">{metaLine}</span>}
              </div>

              {/* Net imposable — info only, not applied to profile */}
              {extraction.netImposable != null && (
                <div className="rounded-xl px-4 py-2.5 border border-dashed border-gray-200 bg-gray-50 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Net imposable annuel</p>
                    <p className="text-xs text-gray-400">Information uniquement — non appliqué au profil</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">
                    {extraction.netImposable.toLocaleString("fr-FR")} €
                  </span>
                </div>
              )}

              {extractedFields.length === 0 && (
                <div className="text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3">
                  Aucune information fiscale n'a pu être extraite. Vérifiez que le document est lisible et qu'il s'agit bien d'une fiche de paie.
                </div>
              )}

              {/* Fields */}
              <div className="flex flex-col gap-2">
                {extractedFields.map((f) => {
                  const rawVal = extraction[f.extractedKey];
                  const note = f.noteKey ? (extraction[f.noteKey] as string | null) : null;
                  return (
                    <FieldRow
                      key={f.extractedKey}
                      def={f}
                      rawValue={rawVal}
                      note={note}
                      checked={checked[f.extractedKey] ?? false}
                      editedValue={edited[f.extractedKey]}
                      onToggle={() => setChecked((p) => ({ ...p, [f.extractedKey]: !p[f.extractedKey] }))}
                      onEdit={(v) => setEdited((p) => ({ ...p, [f.extractedKey]: v }))}
                    />
                  );
                })}
              </div>

              {/* AI notes */}
              {(extraction.notes ?? []).length > 0 && (
                <div className="text-xs text-gray-500 bg-gray-50 rounded-xl px-4 py-3 space-y-1">
                  {extraction.notes!.map((n, i) => <p key={i}>ℹ️ {n}</p>)}
                </div>
              )}

              {/* Select/deselect all */}
              {extractedFields.length > 1 && (
                <div className="flex gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const all: Record<string, boolean> = {};
                      for (const f of extractedFields) all[f.extractedKey] = true;
                      setChecked(all);
                    }}
                    className="text-gray-500 hover:text-gray-700 underline"
                  >
                    Tout sélectionner
                  </button>
                  <span className="text-gray-300">·</span>
                  <button
                    type="button"
                    onClick={() => setChecked({})}
                    className="text-gray-500 hover:text-gray-700 underline"
                  >
                    Tout désélectionner
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          {step === "review" ? (
            <>
              <button
                type="button"
                onClick={() => { setStep("upload"); setExtraction(null); setChecked({}); setEdited({}); }}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium px-3 py-2 rounded-lg hover:bg-gray-100 transition-all"
              >
                ← Nouvelle fiche
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={!hasAnyChecked}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: PRIMARY }}
              >
                Appliquer au profil
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium px-3 py-2 rounded-lg hover:bg-gray-100 transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={analyze}
                disabled={!file || step === "analyzing"}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                style={{ backgroundColor: PRIMARY }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                Analyser
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
