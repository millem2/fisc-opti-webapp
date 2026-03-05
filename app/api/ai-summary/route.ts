import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { FiscalInput, FiscalResult } from "@/types/fiscal";

function euro(v: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

function buildPrompt(input: FiscalInput, result: FiscalResult): string {
  const impotNet = Math.min(result.impotNetForfait, result.impotNetReel);
  const perTip = result.tips?.find((t) => t.type === "PER");
  const donsTip = result.tips?.find((t) => t.type === "DONS_66");
  const pacs = result.pacsAnalysis;

  const lines = [
    `Situation familiale : ${input.situationFamiliale}, ${input.nbEnfants} enfant(s)`,
    `Revenu brut total du foyer : ${euro(result.revenuTotalBrut)}`,
    `Tranche marginale d'imposition (TMI) : ${Math.round(result.tmi * 100)} %`,
    `Impôt net estimé : ${euro(impotNet)}`,
    `Méthode optimale : ${result.methodeOptimale} — économie vs l'autre méthode : ${euro(result.economie)}`,
    `Parts fiscales : ${result.parts}`,
  ];

  if (result.totalPer > 0) lines.push(`Versements PER déjà effectués : ${euro(result.totalPer)}`);
  if (perTip) lines.push(`Plafond PER restant : ${euro(perTip.montant)} → économie potentielle si versé : ${euro(perTip.economieImpot)}`);
  if (donsTip) lines.push(`Don 66% optimisable : ${euro(donsTip.montant)} → réduction d'impôt de ${euro(donsTip.economieImpot)}`);
  if (input.dons66 > 0) lines.push(`Dons 66% déjà effectués : ${euro(input.dons66)}`);

  const hasPacs = !!pacs;
  if (pacs) {
    lines.push(
      `Analyse PACS : impôt en concubinage = ${euro(pacs.impotConcubinage)}, impôt PACS/mariage = ${euro(pacs.impotPacs)}, ` +
      `différence = ${euro(Math.abs(pacs.gainPacs))} (${pacs.pacsAvantageux ? "en faveur du PACS" : "en défaveur du PACS"})`
    );
  }

  const jsonShape = hasPacs
    ? `{ "summary": "...", "tips": ["...", "..."], "pacsComment": "..." }`
    : `{ "summary": "...", "tips": ["...", "..."] }`;

  return `Voici les résultats fiscaux 2025 d'un contribuable français :
${lines.join("\n")}

Rédige en JSON strict (pas de markdown, pas de texte autour) :
${jsonShape}

Règles :
- "summary" : 2 à 3 phrases en français clair, expliquant la situation, le TMI et la piste d'optimisation principale. Cite les chiffres exacts fournis.
- "tips" : liste de 2 à 4 conseils courts et actionnables. Chaque conseil mentionne l'économie chiffrée en euros. Sois direct et concret.
${hasPacs ? '- "pacsComment" : 1 à 2 phrases expliquant pourquoi le PACS est avantageux ou non dans ce cas précis, avec les chiffres fournis. Sois pédagogique.' : ""}
- N'invente aucun chiffre. Utilise uniquement les données ci-dessus.`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });
  }

  try {
    const client = new OpenAI({ apiKey });
    const body: { input: FiscalInput; result: FiscalResult } = await req.json();
    const prompt = buildPrompt(body.input, body.result);

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Tu es un assistant fiscal français expert. Tu rédiges des analyses fiscales claires, précises et actionnables. " +
            "Tu n'inventes aucun chiffre — tu utilises uniquement les données fournies par l'utilisateur.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = JSON.parse(completion.choices[0].message.content ?? "{}");
    return NextResponse.json(content);
  } catch (err) {
    console.error("ai-summary error", err);
    return NextResponse.json({ error: "AI summary unavailable" }, { status: 500 });
  }
}
