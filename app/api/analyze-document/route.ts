import { NextRequest, NextResponse } from "next/server";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT =
  "Tu es un expert en fiscalité française. Tu extrais des informations fiscales depuis des fiches de paie françaises. " +
  "Tu réponds toujours en JSON strict, sans markdown ni texte autour. " +
  "Tu n'inventes aucune donnée — tu extrais uniquement ce qui est clairement présent dans le document.";

function buildPrompt(): string {
  return `Analyse cette fiche de paie française (idéalement de décembre, qui contient les cumuls annuels) et extrais les informations fiscales pertinentes.

Réponds en JSON strict avec ce schéma exact (null pour toute valeur absente) :
{
  "revenu1": <salaire brut annuel en euros entier. Priorité : cumul annuel brut ou "cumul brut" affiché sur la fiche. Si absent, prends le brut mensuel × 12. Si aucun des deux, null>,
  "revenu1_label": <explication courte de la source, ex: "Cumul annuel brut 42 000 €" ou "Brut mensuel 3 500 € × 12", null si revenu1 est null>,
  "netImposable": <cumul annuel net imposable en euros entier si présent (souvent libellé "cumul net imposable" ou "net fiscal"), null sinon>,
  "distanceKmAller": <distance domicile-travail aller-simple en km entier, uniquement si explicitement mentionnée (remboursement kilométrique, IK, frais de transport), null sinon>,
  "tiquetRestau": <part patronale du ticket restaurant PAR JOUR en euros décimal. Cherche "part patronale TR", "contribution employeur ticket resto". null si absent ou si c'est la cantine>,
  "presenceCantine": <true si avantage cantine/restaurant d'entreprise sans ticket resto, false si ticket restaurant mentionné, null si non déterminable>,
  "joursTeleTravail": <nombre de jours de télétravail sur l'ANNÉE (cumul) si mentionné, null sinon>,
  "congesPayes": <nombre de jours de congés payés ANNUELS si mentionné (acquis ou pris sur l'année), null sinon>,
  "rtt": <nombre de jours RTT sur l'année si mentionné, null sinon>,
  "versementPer1": <versements PER (Plan d'Épargne Retraite, PERCO, PEROB) en euros annuels (cumul si dispo), null sinon>,
  "employeur": <raison sociale de l'entreprise employeur, null sinon>,
  "periode": <mois et année de la fiche, ex: "Décembre 2024", null sinon>,
  "notes": [<observations importantes, max 3 — ex: "Cumul annuel disponible", "Fiche non décembre : brut annualisé depuis mensuel", "Distance km non mentionnée">]
}

Règles :
- Priorité absolue aux cumuls annuels sur les valeurs mensuelles
- Ne déduis jamais ce qui n'est pas écrit (ex: ne calcule pas de distance depuis un montant de remboursement)
- Pour les tickets resto, la part patronale est la contribution de l'employeur, pas la valeur faciale totale`;
}

async function callGeminiVision(base64Data: string, mimeType: string, apiKey: string): Promise<unknown> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: buildPrompt() },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        temperature: 0.1,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  }
  const data = await res.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini: réponse vide");
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  return JSON.parse(cleaned);
}

const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Service d'analyse non configuré" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 10 Mo)" }, { status: 413 });
  }

  const mimeType = file.type || "application/octet-stream";
  if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: "Format non supporté. Utilisez un PDF ou une image (JPG, PNG, WEBP)" },
      { status: 415 }
    );
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");

  try {
    const extracted = await callGeminiVision(base64, mimeType, apiKey);
    return NextResponse.json({ extracted });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[analyze-document]", message);
    return NextResponse.json({ error: "Échec de l'analyse du document" }, { status: 500 });
  }
}
