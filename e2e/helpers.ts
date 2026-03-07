import { Page } from "@playwright/test";

// ── Credentials ───────────────────────────────────────────────────────────────

export const TEST_EMAIL = "test@fiscopti.fr";
export const TEST_PASSWORD = "password123";

/** Injects auth credentials into sessionStorage before the page loads. */
export async function setupAuth(page: Page): Promise<void> {
  await page.addInitScript(
    ({ email, password }) => {
      sessionStorage.setItem(
        "fiscopti_credentials",
        JSON.stringify({ username: email, password })
      );
    },
    { email: TEST_EMAIL, password: TEST_PASSWORD }
  );
}

// ── Mock data ─────────────────────────────────────────────────────────────────

export const MOCK_USER = {
  id: "mock-user-id",
  email: TEST_EMAIL,
  fiscalProfile: null,
};

export const MOCK_FISCAL_RESULT_SINGLE = {
  revenuTotalBrut: 40000,
  forfaitFrais: 4000,
  fraisKm: 0,
  fraisRepas: 1372.40,
  fraisReels: 1372.40,
  totalPer: 0,
  revenuNetForfait: 36000,
  revenuNetReel: 38627.60,
  parts: 1,
  impotNetForfait: 3965.48,
  impotNetReel: 4628.48,
  tmi: 0.30,
  methodeOptimale: "FORFAIT",
  economie: 663.0,
  bracketDetailsForfait: [
    { lower: 0, upper: 11497, rate: 0, montantImposable: 11497, impot: 0 },
    { lower: 11497, upper: 29315, rate: 0.11, montantImposable: 17818, impot: 1959.98 },
    { lower: 29315, upper: 83823, rate: 0.30, montantImposable: 6685, impot: 2005.50 },
  ],
  bracketDetailsReel: [
    { lower: 0, upper: 11497, rate: 0, montantImposable: 11497, impot: 0 },
    { lower: 11497, upper: 29315, rate: 0.11, montantImposable: 17818, impot: 1959.98 },
    { lower: 29315, upper: 83823, rate: 0.30, montantImposable: 9312.60, impot: 2793.78 },
  ],
  tips: [
    { type: "PER", montant: 4000, economieImpot: 1200 },
    { type: "DONS_66", montant: 8000, economieImpot: 5280 },
  ],
  pacsAnalysis: null,
};

export const MOCK_FISCAL_RESULT_CONCUBIN = {
  ...MOCK_FISCAL_RESULT_SINGLE,
  revenuTotalBrut: 80000,
  forfaitFrais: 8000,
  revenuNetForfait: 72000,
  parts: 1,
  impotNetForfait: 9531.50,
  impotNetReel: 10500,
  methodeOptimale: "FORFAIT",
  economie: 968.50,
  pacsAnalysis: {
    impotConcubinage: 9531.50,
    impotPacs: 7930.96,
    gainPacs: 1600.54,
    pacsAvantageux: true,
    raison:
      "L'écart de revenus entre les deux déclarants génère un effet de lissage fiscal : " +
      "le revenu du foyer est réparti sur 2 parts de quotient familial, " +
      "ce qui réduit l'impôt global du foyer.",
  },
};

export const MOCK_SIMULATION_RECORD = {
  id: "sim-001",
  userId: "mock-user-id",
  label: "Ma simulation de mars",
  simulatedAt: "2026-03-01T10:00:00Z",
  fiscalInput: {
    situationFamiliale: "celibataire",
    nbEnfants: 0,
    revenu1: 40000,
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
    revenu2: 0,
    distanceKm2: 0,
    joursSite2: 0,
    congesPayes2: 25,
    rtt2: 0,
    joursTeleTravail2: 0,
    versementPer2: 0,
  },
  fiscalResult: MOCK_FISCAL_RESULT_SINGLE,
};

// ── Route mocking ─────────────────────────────────────────────────────────────

/** Mocks all API routes required for authenticated pages. */
export async function mockAuthenticatedRoutes(page: Page): Promise<void> {
  await page.route("**/api/v1/users/self", (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_USER) });
    } else {
      route.continue();
    }
  });

  await page.route("**/api/v1/users/self/profile", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );

  await page.route("**/api/v1/fiscal/optimize", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_FISCAL_RESULT_SINGLE),
    })
  );

  await page.route("**/api/v1/simulations", (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([MOCK_SIMULATION_RECORD]),
      });
    } else {
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SIMULATION_RECORD),
      });
    }
  });
}
