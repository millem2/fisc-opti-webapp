import { test, expect } from "@playwright/test";
import {
  setupAuth,
  mockAuthenticatedRoutes,
  MOCK_FISCAL_RESULT_SINGLE,
  MOCK_FISCAL_RESULT_CONCUBIN,
} from "./helpers";

test.describe("Simulation page", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await mockAuthenticatedRoutes(page);
  });

  // ── Basic rendering ──────────────────────────────────────────────────────────

  test("shows 'Lancer la simulation' button before first run", async ({ page }) => {
    await page.goto("/simulation");
    await expect(page.getByRole("button", { name: /Lancer|Calculer/i }).first()).toBeVisible();
  });

  test("shows simulation results after clicking run", async ({ page }) => {
    await page.goto("/simulation");

    await page.getByRole("button", { name: /Lancer|Calculer/i }).first().click();

    // Result cards appear
    await expect(page.getByText(/Impôt estimé|Méthode optimale|TMI/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("shows optimal method chip (FORFAIT)", async ({ page }) => {
    await page.goto("/simulation");
    await page.getByRole("button", { name: /Lancer|Calculer/i }).first().click();

    await expect(page.getByText("FORFAIT")).toBeVisible({ timeout: 5000 });
  });

  test("shows TMI badge with 30%", async ({ page }) => {
    await page.goto("/simulation");
    await page.getByRole("button", { name: /Lancer|Calculer/i }).first().click();

    await expect(page.getByText(/30\s*%/)).toBeVisible({ timeout: 5000 });
  });

  test("shows tax amounts for forfait and reel methods", async ({ page }) => {
    await page.goto("/simulation");
    await page.getByRole("button", { name: /Lancer|Calculer/i }).first().click();

    // Impôt forfait: 3 965 €
    await expect(page.getByText(/3\s*965/)).toBeVisible({ timeout: 5000 });
  });

  // ── Bracket breakdown ────────────────────────────────────────────────────────

  test("shows bracket breakdown table", async ({ page }) => {
    await page.goto("/simulation");
    await page.getByRole("button", { name: /Lancer|Calculer/i }).first().click();

    await expect(page.getByText(/Tranche|0\s*%|11\s*%|30\s*%/i).first()).toBeVisible({ timeout: 5000 });
  });

  // ── Tips ─────────────────────────────────────────────────────────────────────

  test("shows PER optimization tip", async ({ page }) => {
    await page.goto("/simulation");
    await page.getByRole("button", { name: /Lancer|Calculer/i }).first().click();

    await expect(page.getByText(/PER/i)).toBeVisible({ timeout: 5000 });
  });

  // ── Scenario comparisons ─────────────────────────────────────────────────────

  test("shows scenario comparison section", async ({ page }) => {
    // Override optimize to return different values per call
    let callCount = 0;
    await page.route("**/api/v1/fiscal/optimize", (route) => {
      callCount++;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...MOCK_FISCAL_RESULT_SINGLE, impotNetForfait: 3500 + callCount * 100 }),
      });
    });

    await page.goto("/simulation");
    await page.getByRole("button", { name: /Lancer|Calculer/i }).first().click();

    await expect(page.getByText(/Scénarios|comparaison|PER|Mariage|Don/i).first()).toBeVisible({ timeout: 8000 });
  });

  // ── PDF export ───────────────────────────────────────────────────────────────

  test("shows PDF export button after simulation", async ({ page }) => {
    await page.goto("/simulation");
    await page.getByRole("button", { name: /Lancer|Calculer/i }).first().click();

    await expect(page.getByRole("button", { name: /PDF|Exporter/i })).toBeVisible({ timeout: 5000 });
  });

  // ── Save simulation modal ────────────────────────────────────────────────────

  test("shows save simulation button after results appear", async ({ page }) => {
    await page.goto("/simulation");
    await page.getByRole("button", { name: /Lancer|Calculer/i }).first().click();

    await expect(page.getByRole("button", { name: /Sauvegarder/i })).toBeVisible({ timeout: 5000 });
  });

  test("opens save modal and submits label", async ({ page }) => {
    await page.goto("/simulation");
    await page.getByRole("button", { name: /Lancer|Calculer/i }).first().click();

    await page.getByRole("button", { name: /Sauvegarder/i }).click({ timeout: 5000 });

    // Modal appears
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 });

    // Fill label and confirm
    const labelInput = page.getByRole("dialog").getByRole("textbox").first();
    if (await labelInput.isVisible()) {
      await labelInput.fill("Ma simulation test");
    }
    await page.getByRole("button", { name: /Confirmer|Enregistrer|Sauvegarder/i }).last().click();
  });

  // ── PACS advice card ─────────────────────────────────────────────────────────

  test("PACS advice card not shown for célibataire", async ({ page }) => {
    await page.goto("/simulation");
    await page.getByRole("button", { name: /Lancer|Calculer/i }).first().click();

    await page.waitForTimeout(500);
    // pacsAnalysis is null in MOCK_FISCAL_RESULT_SINGLE
    await expect(page.getByText(/PACS avantageux|PACS neutre|CGI art\. 194/i)).not.toBeVisible();
  });

  test("PACS advice card shown for concubin with partner data", async ({ page }) => {
    // Override optimize route to return concubin result with pacsAnalysis
    await page.route("**/api/v1/fiscal/optimize", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FISCAL_RESULT_CONCUBIN),
      });
    });

    await page.goto("/simulation");
    await page.getByRole("button", { name: /Lancer|Calculer/i }).first().click();

    await expect(page.getByText(/PACS avantageux|Le PACS est avantageux/i)).toBeVisible({ timeout: 5000 });
  });

  test("PACS card shows gain amount when PACS is advantageous", async ({ page }) => {
    await page.route("**/api/v1/fiscal/optimize", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FISCAL_RESULT_CONCUBIN),
      })
    );

    await page.goto("/simulation");
    await page.getByRole("button", { name: /Lancer|Calculer/i }).first().click();

    // gainPacs = 1600.54 → displayed as ~1 601 €
    await expect(page.getByText(/1\s*6[0-9][0-9]/)).toBeVisible({ timeout: 5000 });
  });

  test("PACS card shows comparison table with concubinage vs PACS impôts", async ({ page }) => {
    await page.route("**/api/v1/fiscal/optimize", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FISCAL_RESULT_CONCUBIN),
      })
    );

    await page.goto("/simulation");
    await page.getByRole("button", { name: /Lancer|Calculer/i }).first().click();

    await expect(page.getByText(/Concubinage|PACS/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("PACS card shows legal references", async ({ page }) => {
    await page.route("**/api/v1/fiscal/optimize", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FISCAL_RESULT_CONCUBIN),
      })
    );

    await page.goto("/simulation");
    await page.getByRole("button", { name: /Lancer|Calculer/i }).first().click();

    await expect(page.getByText(/CGI|art\./i).first()).toBeVisible({ timeout: 5000 });
  });

  // ── Mode test panel ──────────────────────────────────────────────────────────

  test("shows mode test toggle", async ({ page }) => {
    await page.goto("/simulation");
    await expect(page.getByText(/Mode test/i)).toBeVisible();
  });
});
