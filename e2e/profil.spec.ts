import { test, expect } from "@playwright/test";
import { setupAuth, mockAuthenticatedRoutes, MOCK_USER } from "./helpers";

test.describe("Profil page", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await mockAuthenticatedRoutes(page);
  });

  test("shows the fiscal profile form", async ({ page }) => {
    await page.goto("/profil");
    await expect(page.getByText("Mon Profil Fiscal")).toBeVisible();
    await expect(page.getByText("Déclarant principal")).toBeVisible();
    await expect(page.getByText("Situation familiale")).toBeVisible();
  });

  test("shows 'Lancer la simulation' button", async ({ page }) => {
    await page.goto("/profil");
    await expect(page.getByRole("button", { name: /Lancer la simulation/i })).toBeVisible();
  });

  test("shows auto-save indicator after changing a field", async ({ page }) => {
    await page.goto("/profil");
    const salaryInput = page.getByLabel("Salaire brut annuel").first();
    await salaryInput.fill("50000");
    await expect(page.getByText(/Sauvegarde/i)).toBeVisible({ timeout: 3000 });
  });

  test("does not show partner card for célibataire", async ({ page }) => {
    await page.goto("/profil");
    await expect(page.getByText("Déclarant 2")).not.toBeVisible();
    await expect(page.getByText(/Concubin/i)).not.toBeVisible();
  });

  test("shows partner card with 'Déclarant 2' chip for marié/pacsé", async ({ page }) => {
    await page.goto("/profil");

    // Select marié/pacsé
    await page.getByLabel("Situation familiale").click();
    await page.getByRole("option", { name: "Marié / Pacsé" }).click();

    await expect(page.getByText("Déclarant 2")).toBeVisible();
    await expect(page.getByText(/données optionnelles/i)).not.toBeVisible();
  });

  test("shows partner card with PACS hint for concubin", async ({ page }) => {
    await page.goto("/profil");

    await page.getByLabel("Situation familiale").click();
    await page.getByRole("option", { name: "Concubin" }).click();

    await expect(page.getByText(/Concubin\(e\)/i)).toBeVisible();
    await expect(page.getByText(/données optionnelles/i)).toBeVisible();
    await expect(page.getByText(/FiscOpti peut estimer si un PACS serait fiscalement avantageux/i)).toBeVisible();
  });

  test("partner card for concubin shows revenue and km fields", async ({ page }) => {
    await page.goto("/profil");

    await page.getByLabel("Situation familiale").click();
    await page.getByRole("option", { name: "Concubin" }).click();

    // Partner card should show salary and km fields
    await expect(page.getByLabel("Salaire brut annuel").nth(1)).toBeVisible();
    await expect(page.getByLabel("Distance domicile-travail (aller)").nth(1)).toBeVisible();
  });

  test("partner card closes when switching back to célibataire", async ({ page }) => {
    await page.goto("/profil");

    await page.getByLabel("Situation familiale").click();
    await page.getByRole("option", { name: "Concubin" }).click();
    await expect(page.getByText(/Concubin\(e\)/i)).toBeVisible();

    await page.getByLabel("Situation familiale").click();
    await page.getByRole("option", { name: "Célibataire" }).click();
    await expect(page.getByText(/Concubin\(e\)/i)).not.toBeVisible();
    await expect(page.getByText("Déclarant 2")).not.toBeVisible();
  });

  test("profile loads saved data from API on mount", async ({ page }) => {
    // Override user mock to include a saved profile
    await page.route("**/api/v1/users/self", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...MOCK_USER,
          fiscalProfile: {
            situationFamiliale: "marie_pacse",
            nbEnfants: 1,
            revenu1: 55000,
            distanceKmAller: 25,
            presenceCantine: false,
            tiquetRestau: 0,
            joursSite: 0,
            congesPayes: 25,
            rtt: 5,
            puissanceFiscale: 0,
            versementPer1: 0,
            dons66: 0,
            dons75: 0,
            revenu2: 35000,
            distanceKm2: 10,
            joursSite2: 0,
            congesPayes2: 25,
            rtt2: 0,
            versementPer2: 0,
          },
        }),
      })
    );

    await page.goto("/profil");

    // Partner card should appear (marie_pacse)
    await expect(page.getByText("Déclarant 2")).toBeVisible();
  });

  test("'Lancer la simulation' navigates to simulation page", async ({ page }) => {
    await page.goto("/profil");
    await page.getByRole("button", { name: /Lancer la simulation/i }).click();
    await expect(page).toHaveURL("/simulation");
  });

  test("navigation bar shows 'Mes simulations' link", async ({ page }) => {
    await page.goto("/profil");
    await expect(page.getByRole("link", { name: "Mes simulations" })).toBeVisible();
  });

  test("logout button clears session and redirects to login", async ({ page }) => {
    await page.goto("/profil");
    await page.getByRole("button", { name: "Déconnexion" }).click();
    await expect(page).toHaveURL("/login");
  });
});
