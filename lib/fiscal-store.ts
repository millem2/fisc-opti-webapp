import { create } from "zustand";
import { FiscalInput, FiscalResult } from "@/types/fiscal";

const DEFAULT_INPUT: FiscalInput = {
  situationFamiliale: "celibataire",
  nbEnfants: 0,
  revenu1: 0,
  distanceKmAller: 0,
  presenceCantine: false,
  tiquetRestau: 0,
  joursSite: 0,
  congesPayes: 25,
  rtt: 0,
  joursTeleTravail: 0,
  puissanceFiscale: 0,
  versementPer1: 0,
  dons66: 0,
  dons75: 0,
  depensesEmploiDomicile: 0,
  depensesGardeEnfants: 0,
  nbEnfantsMoins6Ans: 0,
  investorProfile: {
    capaciteEpargne: 0,
    toleranceRisque: "moyen",
    horizonInvestissement: "moyen",
  },
  revenu2: 0,
  distanceKm2: 0,
  joursSite2: 0,
  congesPayes2: 25,
  rtt2: 0,
  joursTeleTravail2: 0,
  versementPer2: 0,
};

interface FiscalStore {
  input: FiscalInput;
  result: FiscalResult | null;
  setInput: (input: FiscalInput) => void;
  setResult: (result: FiscalResult | null) => void;
}

export const useFiscalStore = create<FiscalStore>((set) => ({
  input: DEFAULT_INPUT,
  result: null,
  setInput: (input) => set({ input }),
  setResult: (result) => set({ result }),
}));
