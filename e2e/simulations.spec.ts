import { test, expect } from "@playwright/test";
import { setupAuth, mockAuthenticatedRoutes, MOCK_SIMULATION_RECORD, MOCK_FISCAL_RESULT_SINGLE } from "./helpers";

test.describe("Mes simulations page", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await mockAuthenticatedRoutes(page);
  });

  // ── Page heading ─────────────────────────────────────────────────────────────

  test("shows 'Mes simulations' heading", async ({ page }) => {
    await page.goto("/historique");
    await expect(page.getByText("Mes simulations")).toBeVisible();
  });

  test("navigation link labeled 'Mes simulations' points to /historique", async ({ page }) => {
    await page.goto("/profil");
    const link = page.getByRole("link", { name: "Mes simulations" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/historique");
  });

  // ── List rendering ───────────────────────────────────────────────────────────

  test("shows saved simulation with label", async ({ page }) => {
    await page.goto("/historique");
    await expect(page.getByText("Ma simulation de mars")).toBeVisible({ timeout: 5000 });
  });

  test("shows simulation date in French locale", async ({ page }) => {
    await page.goto("/historique");
    // "2026-03-01T10:00:00Z" → "01 mars 2026"
    await expect(page.getByText(/mars 2026/i)).toBeVisible({ timeout: 5000 });
  });

  test("shows impôt amount for the simulation", async ({ page }) => {
    await page.goto("/historique");
    // impotNetForfait = 3 965 €
    await expect(page.getByText(/3\s*965|3\.965/)).toBeVisible({ timeout: 5000 });
  });

  test("shows empty state when no simulations", async ({ page }) => {
    await page.route("**/api/v1/simulations", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    );

    await page.goto("/historique");
    await expect(
      page.getByText(/Aucune simulation|pas encore de simulation/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("shows multiple simulations sorted newest first", async ({ page }) => {
    const older = {
      ...MOCK_SIMULATION_RECORD,
      id: "sim-000",
      label: "Simulation janvier",
      simulatedAt: "2026-01-15T08:00:00Z",
    };
    const newer = {
      ...MOCK_SIMULATION_RECORD,
      id: "sim-002",
      label: "Simulation avril",
      simulatedAt: "2026-04-01T12:00:00Z",
    };

    await page.route("**/api/v1/simulations", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([older, newer]),
      })
    );

    await page.goto("/historique");

    const items = page.getByText(/Simulation (janvier|avril)/i);
    const texts = await items.allTextContents();
    // Newest (avril) should appear before oldest (janvier)
    const avrilIdx = texts.findIndex((t) => /avril/i.test(t));
    const janvierIdx = texts.findIndex((t) => /janvier/i.test(t));
    expect(avrilIdx).toBeLessThan(janvierIdx);
  });

  // ── Expandable rows ──────────────────────────────────────────────────────────

  test("clicking a row expands detail with input data", async ({ page }) => {
    await page.goto("/historique");

    // Click the row / expand trigger
    await page.getByText("Ma simulation de mars").click();

    // Should show fiscal input details
    await expect(page.getByText(/Célibataire|Revenu|Frais/i).first()).toBeVisible({ timeout: 3000 });
  });

  test("expanded row shows bracket detail table", async ({ page }) => {
    await page.goto("/historique");
    await page.getByText("Ma simulation de mars").click();

    await expect(page.getByText(/11\s*%|30\s*%/i).first()).toBeVisible({ timeout: 3000 });
  });

  test("expanded row shows per-simulation PDF button", async ({ page }) => {
    await page.goto("/historique");
    await page.getByText("Ma simulation de mars").click();

    await expect(page.getByRole("button", { name: /PDF|Exporter/i })).toBeVisible({ timeout: 3000 });
  });

  // ── Error state ───────────────────────────────────────────────────────────────

  test("shows error message when API fails", async ({ page }) => {
    await page.route("**/api/v1/simulations", (route) =>
      route.fulfill({ status: 500, body: "Internal Server Error" })
    );

    await page.goto("/historique");
    await expect(
      page.getByText(/Impossible de charger vos simulations|erreur/i)
    ).toBeVisible({ timeout: 5000 });
  });

  // ── Navigation ────────────────────────────────────────────────────────────────

  test("shows 'Lancer une simulation' or navigation to simulation page", async ({ page }) => {
    await page.goto("/historique");
    const simulationLink = page.getByRole("link", { name: "Simulation" });
    await expect(simulationLink).toBeVisible();
  });
});
