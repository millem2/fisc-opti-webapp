"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@heroui/react";
import { useAuth } from "@/lib/auth-context";
import AppShell from "@/app/components/AppShell";
import { listLevers, LeverInfo } from "@/lib/api";

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORIES: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  deduction: {
    label: "Déduction du revenu",
    color: "text-purple-700",
    bg: "bg-purple-50 border-purple-200",
    dot: "bg-purple-500",
  },
  reduction_impot: {
    label: "Réduction d'impôt",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    dot: "bg-blue-500",
  },
  credit_impot: {
    label: "Crédit d'impôt",
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
    dot: "bg-emerald-500",
  },
  placement: {
    label: "Enveloppe d'investissement",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    dot: "bg-amber-500",
  },
  mecanisme: {
    label: "Mécanisme fiscal",
    color: "text-gray-600",
    bg: "bg-gray-50 border-gray-200",
    dot: "bg-gray-400",
  },
};

// ── Lever card ────────────────────────────────────────────────────────────────

function LeverCard({ lever }: { lever: LeverInfo }) {
  const [expanded, setExpanded] = useState(false);
  const cat = CATEGORIES[lever.categorie] ?? CATEGORIES.mecanisme;
  const bofipUrl = `https://bofip.impots.gouv.fr/bofip/${lever.sourceBofip}.html`;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header — always visible */}
      <button
        className="w-full text-left px-6 py-5 hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${cat.bg} ${cat.color}`}>
                {cat.label}
              </span>
              <span className="text-xs text-gray-400 font-mono">{lever.articleCGI}</span>
            </div>
            <h3 className="font-semibold text-gray-900 text-base">{lever.nom}</h3>
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">{lever.description}</p>
          </div>
          <span className="text-gray-300 text-sm shrink-0 mt-1">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 bg-[#fafafa]">
          <div className="px-6 py-5 flex flex-col gap-5">

            {/* Mécanisme */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Fonctionnement détaillé
              </p>
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-white rounded-xl border border-gray-100 p-4">
                {lever.mecanisme}
              </div>
            </div>

            {/* Plafonds */}
            {lever.plafonds.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                  Plafonds & limites
                </p>
                <ul className="flex flex-col gap-1.5">
                  {lever.plafonds.map((p, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cat.dot}`} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Exemple */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Exemple chiffré
              </p>
              <div className="text-sm text-gray-700 font-mono leading-relaxed bg-[#1B3D2C]/5 rounded-xl border border-[#1B3D2C]/10 p-4 whitespace-pre-line">
                {lever.exemple}
              </div>
            </div>

            {/* Conseil */}
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-100 p-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-sm text-amber-800 leading-relaxed">{lever.conseil}</p>
            </div>

            {/* Sources */}
            <div className="flex items-center gap-4 pt-1 border-t border-gray-100 text-xs text-gray-400">
              <span className="font-semibold">{lever.articleCGI}</span>
              <span>·</span>
              <span>BOFIP : {lever.sourceBofip}</span>
              <span>·</span>
              <a
                href={bofipUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-600 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                Consulter sur bofip.impots.gouv.fr ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Category group ────────────────────────────────────────────────────────────

const CATEGORY_ORDER = ["deduction", "reduction_impot", "credit_impot", "placement", "mecanisme"];
const CATEGORY_TITLES: Record<string, string> = {
  deduction: "Déductions du revenu imposable",
  reduction_impot: "Réductions d'impôt",
  credit_impot: "Crédits d'impôt",
  placement: "Enveloppes d'investissement",
  mecanisme: "Mécanismes fiscaux (informatif)",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LeviersPage() {
  const { authenticated, initializing } = useAuth();
  const router = useRouter();
  const [levers, setLevers] = useState<LeverInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!initializing && !authenticated) router.replace("/login");
  }, [initializing, authenticated, router]);

  useEffect(() => {
    listLevers()
      .then(setLevers)
      .catch(() => setError("Impossible de charger les leviers fiscaux."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? levers.filter((l) =>
        [l.nom, l.description, l.mecanisme, l.articleCGI]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : levers;

  const grouped = CATEGORY_ORDER.reduce<Record<string, LeverInfo[]>>((acc, cat) => {
    const items = filtered.filter((l) => l.categorie === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  return (
    <AppShell>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Leviers fiscaux</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Barème 2025 — Sources : Code Général des Impôts (CGI) & Bulletin Officiel des Finances Publiques (BOFIP)
        </p>
      </div>

      {/* Disclaimer */}
      <div className="mb-5 flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-700">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>
          Ces fiches sont fournies à titre indicatif sur la base du barème fiscal 2025 (revenus 2024).
          Les montants calculés dans FiscOpti sont des estimations — consultez un expert-comptable ou
          un conseiller fiscal pour votre situation réelle.
        </span>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Rechercher un levier (PER, frais réels, dons…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-gray-400 bg-white"
        />
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {loading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" label="Chargement…" />
        </div>
      )}

      {!loading && (
        <div className="flex flex-col gap-8">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-3">
                {CATEGORY_TITLES[cat]}
              </h2>
              <div className="flex flex-col gap-3">
                {items.map((lever) => (
                  <LeverCard key={lever.id} lever={lever} />
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && !error && (
            <p className="text-sm text-gray-400 text-center py-10">
              Aucun levier ne correspond à votre recherche.
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-8 pt-4 border-t border-gray-100">
        Sources : Code Général des Impôts — Bulletin Officiel des Finances Publiques (bofip.impots.gouv.fr) — Loi de finances 2025
      </p>
    </AppShell>
  );
}
