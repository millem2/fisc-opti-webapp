import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { FiscalInput, FiscalResult } from "@/types/fiscal";

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
    ? `{ "summary": "...", "tips": ["...", "..."], "pacsComment": "..." }`
    : `{ "summary": "...", "tips": ["...", "..."] }`;

  return `Voici les résultats fiscaux 2025 d'un contribuable français :
${lines.join("\n")}

Réponds en JSON strict (pas de markdown, pas de texte autour) :
${jsonShape}

Règles :
- "summary" : 2 à 3 phrases en français clair expliquant la situation, le TMI et la piste d'optimisation principale. Cite les chiffres exacts.
- "tips" : liste de 3 à 5 conseils courts et actionnables. Chaque conseil doit mentionner le bénéfice chiffré quand il existe, et être adapté au profil investisseur (risque, horizon, capacité d'épargne).
${hasPacs ? '- "pacsComment" : 1 à 2 phrases pédagogiques sur l\'impact du PACS avec les chiffres fournis.' : ""}
- N'invente aucun chiffre. Utilise uniquement les données fournies. Sois direct et concret.`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  try {
    const client = new Anthropic({ apiKey });
    const body: { input: FiscalInput; result: FiscalResult } = await req.json();
    const prompt = buildPrompt(body.input, body.result);

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system:
        "Tu es un conseiller fiscal et patrimonial français expert. Tu rédiges des analyses fiscales claires, précises et actionnables, " +
        "adaptées au profil investisseur de l'utilisateur (tolérance au risque, horizon, capacité d'épargne). " +
        "Tu n'inventes aucun chiffre — tu utilises uniquement les données fournies. " +
        "Tu réponds toujours en JSON strict, sans markdown ni texte autour.",
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const content = JSON.parse(raw);
    return NextResponse.json(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("ai-summary error:", message, err);
    return NextResponse.json({ error: "AI summary unavailable", detail: message }, { status: 500 });
  }
}
