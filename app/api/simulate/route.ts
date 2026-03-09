import { NextRequest, NextResponse } from "next/server";
import { FiscalInput, FiscalResult } from "@/types/fiscal";

const GO_API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

function euro(v: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

const RISQUE_LABEL: Record<string, string> = {
  faible: "prudent (capital garanti, faible rendement)",
  moyen: "équilibré (volatilité modérée)",
  eleve: "dynamique (forte volatilité acceptée)",
};

const HORIZON_LABEL: Record<string, string> = {
  court: "court terme (< 3 ans)",
  moyen: "moyen terme (3–8 ans)",
  long: "long terme (> 8 ans, retraite)",
};

function buildPrompt(input: FiscalInput, result: FiscalResult): string {
  const impotNet = Math.min(result.impotNetForfait, result.impotNetReel);
  const pacs = result.pacsAnalysis;

  const lines: string[] = [
    `Situation familiale : ${input.situationFamiliale}, ${input.nbEnfants} enfant(s)`,
    `Revenu brut total du foyer : ${euro(result.revenuTotalBrut)}`,
    `Tranche marginale d'imposition (TMI) : ${Math.round(result.tmi * 100)} %`,
    `Impôt net estimé : ${euro(impotNet)}`,
    `Méthode optimale : ${result.methodeOptimale} — économie vs l'autre méthode : ${euro(result.economie)}`,
    `Parts fiscales : ${result.parts}`,
  ];

  if (result.totalPer > 0) lines.push(`Versements PER déjà effectués : ${euro(result.totalPer)}`);
  if (input.dons66 > 0) lines.push(`Dons 66 % déjà effectués : ${euro(input.dons66)}`);
  if (input.dons75 > 0) lines.push(`Dons 75 % déjà effectués : ${euro(input.dons75)}`);
  if (result.creditEmploiDomicile > 0)
    lines.push(`Crédit emploi à domicile obtenu : ${euro(result.creditEmploiDomicile)}`);
  if (result.creditGardeEnfants > 0)
    lines.push(`Crédit garde d'enfants obtenu : ${euro(result.creditGardeEnfants)}`);
  if (result.plafonnementNichesApplique)
    lines.push("Plafond global des niches fiscales (10 000 €) atteint — certains crédits ont été écrêtés.");

  const tipLines: string[] = [];
  for (const tip of result.tips ?? []) {
    switch (tip.type) {
      case "PER":
        tipLines.push(`Plafond PER restant : ${euro(tip.montant)} → économie potentielle : ${euro(tip.economieImpot)}`);
        break;
      case "DONS_66":
        tipLines.push(`Marge de dons 66 % : ${euro(tip.montant)} → réduction d'impôt : ${euro(tip.economieImpot)}`);
        break;
      case "EMPLOI_DOMICILE":
        tipLines.push(`Dépenses emploi à domicile encore déclarables : ${euro(tip.montant)} → crédit potentiel : ${euro(tip.economieImpot)}`);
        break;
      case "GARDE_ENFANT":
        tipLines.push(`Frais de garde encore déclarables : ${euro(tip.montant)} → crédit potentiel : ${euro(tip.economieImpot)}`);
        break;
      case "PLAFOND_NICHES":
        tipLines.push("Plafond niches fiscales atteint : les crédits supplémentaires n'apportent plus de gain.");
        break;
      case "PER_MENSUEL":
        tipLines.push(`Avec la capacité d'épargne mensuelle, montant PER atteignable : ${euro(tip.montant)} → économie : ${euro(tip.economieImpot)}`);
        break;
      case "FCPI_FIP":
        tipLines.push(`FCPI / FIP : investissement jusqu'à ${euro(tip.montant)} → réduction d'impôt de 18 % soit ${euro(tip.economieImpot)}`);
        break;
      case "ASSURANCE_VIE":
        tipLines.push(`Assurance-vie recommandée${tip.montant > 0 ? ` (capacité annuelle : ${euro(tip.montant)})` : ""} : fiscalité allégée après 8 ans, transmission optimisée.`);
        break;
      case "PEA":
        tipLines.push("PEA recommandé : plus-values et dividendes exonérés d'IR après 5 ans (plafond 150 000 €).");
        break;
    }
  }

  if (tipLines.length > 0) {
    lines.push("\nLevier(s) d'optimisation identifiés :");
    lines.push(...tipLines);
  }

  const ip = input.investorProfile;
  if (ip) {
    lines.push("\nProfil investisseur :");
    if (ip.toleranceRisque) lines.push(`- Tolérance au risque : ${RISQUE_LABEL[ip.toleranceRisque] ?? ip.toleranceRisque}`);
    if (ip.horizonInvestissement) lines.push(`- Horizon : ${HORIZON_LABEL[ip.horizonInvestissement] ?? ip.horizonInvestissement}`);
    if (ip.capaciteEpargne > 0) lines.push(`- Capacité d'épargne : ${euro(ip.capaciteEpargne)}/mois soit ${euro(ip.capaciteEpargne * 12)}/an`);
  }

  const hasPacs = !!pacs;
  if (pacs) {
    lines.push(
      `\nAnalyse PACS : impôt en concubinage = ${euro(pacs.impotConcubinage)}, impôt PACS/mariage = ${euro(pacs.impotPacs)}, ` +
      `différence = ${euro(Math.abs(pacs.gainPacs))} (${pacs.pacsAvantageux ? "en faveur du PACS" : "en défaveur du PACS"})`
    );
  }

  const jsonShape = hasPacs
    ? `{ "summary": "...", "tips": ["...", "..."], "infos": ["...", "..."], "pacsComment": "..." }`
    : `{ "summary": "...", "tips": ["...", "..."], "infos": ["...", "..."] }`;

  return `Voici les résultats fiscaux 2025 d'un contribuable français :
${lines.join("\n")}

Réponds en JSON strict (pas de markdown, pas de texte autour) :
${jsonShape}

Règles :
- "summary" : 2 à 3 phrases en français clair expliquant la situation, le TMI et la piste d'optimisation principale. Cite les chiffres exacts.
- "tips" : liste de 2 à 4 conseils d'investissement ou d'optimisation actionnables (PER, FCPI/FIP, PEA, assurance-vie, emploi à domicile, garde d'enfants…). Chaque conseil doit mentionner le bénéfice chiffré quand il existe, et être adapté au profil investisseur (risque, horizon, capacité d'épargne). NE PAS inclure les dons ici.
- "infos" : liste de 1 à 3 informations fiscales pures (non actionnables comme conseil d'investissement). Par exemple : indiquer que si le contribuable fait un don de X € à un organisme éligible à 66 %, il peut déduire Y € de ses impôts. Formuler comme une information ("Si vous faites un don de X…, vous pouvez déduire Y…"), pas comme un conseil ("Faites un don de…"). Inclure également le plafond des niches fiscales si applicable.
${hasPacs ? '- "pacsComment" : 1 à 2 phrases pédagogiques sur l\'impact du PACS avec les chiffres fournis.' : ""}
- N'invente aucun chiffre. Utilise uniquement les données fournies. Sois direct et concret.`;
}

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const SYSTEM_PROMPT =
  "Tu es un conseiller fiscal et patrimonial français expert. Tu rédiges des analyses fiscales claires, précises et actionnables, " +
  "adaptées au profil investisseur de l'utilisateur (tolérance au risque, horizon, capacité d'épargne). " +
  "Tu n'inventes aucun chiffre — tu utilises uniquement les données fournies. " +
  "Tu réponds toujours en JSON strict, sans markdown ni texte autour.";

async function callGemini(prompt: string, apiKey: string): Promise<unknown> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        temperature: 0.2,
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  const data = await res.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini: réponse vide");
  return JSON.parse(text);
}

async function callAI(input: FiscalInput, result: FiscalResult) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = buildPrompt(input, result);
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callGemini(prompt, apiKey);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[AI] tentative ${attempt}/${MAX_RETRIES} échouée : ${lastError.message}`);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500 * attempt)); // 500ms, 1s, …
      }
    }
  }

  throw lastError ?? new Error("AI: échec après 3 tentatives");
}

export async function POST(req: NextRequest) {
  const authorization = req.headers.get("Authorization");
  const { input }: { input: FiscalInput } = await req.json();

  // 1. Call Go backend for fiscal computation
  const goRes = await fetch(`${GO_API}/fiscal/optimize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!goRes.ok) {
    const text = await goRes.text().catch(() => goRes.statusText);
    return NextResponse.json({ error: text }, { status: goRes.status });
  }

  const result: FiscalResult = await goRes.json();

  // 2. Call Claude for AI summary (best-effort — never blocks the fiscal result)
  let aiSummary = null;
  try {
    aiSummary = await callAI(input, result);
  } catch (err) {
    console.error("AI summary error:", err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ result, aiSummary });
}
