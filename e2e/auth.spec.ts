import { test, expect } from "@playwright/test";
import { TEST_EMAIL, TEST_PASSWORD } from "./helpers";

test.describe("Auth – login page", () => {
  test("shows login form with email, password and submit button", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Connexion à votre compte")).toBeVisible();
    await expect(page.getByLabel("Adresse e-mail")).toBeVisible();
    await expect(page.getByLabel("Mot de passe")).toBeVisible();
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  });

  test("shows link to register page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: "Inscrivez-vous" })).toBeVisible();
  });

  test("shows error message with wrong credentials", async ({ page }) => {
    await page.route("**/api/v1/users/self", (route) =>
      route.fulfill({ status: 401, body: "Unauthorized" })
    );

    await page.goto("/login");
    await page.getByLabel("Adresse e-mail").fill("wrong@example.fr");
    await page.getByLabel("Mot de passe").fill("badpassword");
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page.getByText("Email ou mot de passe incorrect.")).toBeVisible();
  });

  test("redirects to /profil after successful login", async ({ page }) => {
    await page.route("**/api/v1/users/self", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "1", email: TEST_EMAIL }),
      })
    );

    await page.goto("/login");
    await page.getByLabel("Adresse e-mail").fill(TEST_EMAIL);
    await page.getByLabel("Mot de passe").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page).toHaveURL("/profil");
  });

  test("unauthenticated access to /profil redirects to /login", async ({ page }) => {
    await page.route("**/api/v1/users/self", (route) =>
      route.fulfill({ status: 401, body: "Unauthorized" })
    );

    await page.goto("/profil");
    await expect(page).toHaveURL("/login");
  });
});

test.describe("Auth – register page", () => {
  test("shows register form", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByText(/Créez votre compte|Inscription/i)).toBeVisible();
    await expect(page.getByLabel("Adresse e-mail")).toBeVisible();
    await expect(page.getByLabel(/Mot de passe/i).first()).toBeVisible();
  });

  test("shows link back to login page", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("link", { name: /Connectez-vous|connexion/i })).toBeVisible();
  });

  test("shows error for duplicate email", async ({ page }) => {
    await page.route("**/api/v1/users", (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ title: "Email déjà utilisé." }),
      })
    );

    await page.goto("/register");
    await page.getByLabel("Adresse e-mail").fill("existing@test.fr");
    await page.getByLabel(/Mot de passe/i).first().fill("password123");
    await page.getByRole("button", { name: /Créer|S'inscrire/i }).click();

    await expect(page.getByText(/Email déjà utilisé/i)).toBeVisible();
  });
});
