export interface InvestorProfile {
  capaciteEpargne: number;           // monthly savings capacity in €/month
  toleranceRisque: string;           // "faible" | "moyen" | "eleve"
  horizonInvestissement: string;     // "court" | "moyen" | "long"
}

export interface FiscalInput {
  // Person 1
  situationFamiliale: string; // "celibataire" | "marie_pacse" | "concubin"
  nbEnfants: number;
  revenu1: number;
  distanceKmAller: number;
  presenceCantine: boolean;
  tiquetRestau: number;
  joursSite: number;
  congesPayes: number;
  rtt: number;
  joursTeleTravail: number;
  puissanceFiscale: number; // 0=flat, 3-7=CV fiscal
  versementPer1: number;
  dons66: number;
  dons75: number;

  // Investor profile (optional)
  investorProfile?: InvestorProfile;

  // Crédits d'impôt niches fiscales
  depensesEmploiDomicile: number; // emploi à domicile (Art. 199 sexdecies)
  depensesGardeEnfants: number;   // garde hors domicile (Art. 200 quater B)
  nbEnfantsMoins6Ans: number;     // enfants < 6 ans (ouvre le crédit garde)

  // Person 2 (couple only)
  revenu2: number;
  distanceKm2: number;
  joursSite2: number;
  congesPayes2: number;
  rtt2: number;
  joursTeleTravail2: number;
  versementPer2: number;
}

export interface BracketDetail {
  lower: number;
  upper: number;
  rate: number;
  montantImposable: number;
  impot: number;
}

export interface Tip {
  type: string;
  montant: number;
  economieImpot: number;
}

export interface PacsAnalysis {
  impotConcubinage: number;
  impotPacs: number;
  gainPacs: number;
  pacsAvantageux: boolean;
  raison: string;
}

export interface FiscalResult {
  revenuTotalBrut: number;
  forfaitFrais: number;
  fraisKm: number;
  fraisRepas: number;
  fraisReels: number;
  totalPer: number;
  revenuNetForfait: number;
  revenuNetReel: number;
  parts: number;
  creditEmploiDomicile: number;
  creditGardeEnfants: number;
  totalCreditsNiches: number;
  plafonnementNichesApplique: boolean;
  impotNetForfait: number;
  impotNetReel: number;
  tmi: number;
  methodeOptimale: string;
  economie: number;
  bracketDetailsForfait: BracketDetail[];
  bracketDetailsReel: BracketDetail[];
  tips: Tip[];
  pacsAnalysis?: PacsAnalysis;
}
