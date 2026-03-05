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
  puissanceFiscale: number; // 0=flat, 3-7=CV fiscal
  versementPer1: number;
  dons66: number;
  dons75: number;

  // Person 2 (couple only)
  revenu2: number;
  distanceKm2: number;
  joursSite2: number;
  congesPayes2: number;
  rtt2: number;
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
