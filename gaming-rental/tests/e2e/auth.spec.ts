import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should show login page", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("should show register page", async ({ page }) => {
    await page.goto("/auth/register");
    await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();
  });

  test("should show validation errors on empty login", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid email/i).or(page.getByText(/required/i))).toBeVisible();
  });

  test("should show error on invalid credentials", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel(/email/i).fill("nonexistent@test.com");
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test("should register a new user", async ({ page }) => {
    const email = `test${Date.now()}@test.com`;
    await page.goto("/auth/register");
    await page.getByLabel(/full name/i).fill("Test User");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/phone/i).fill("0551234567");
    await page.getByLabel(/password/i).fill("testpassword123");
    await page.getByLabel(/hostel/i).fill("Test Hall");
    await page.getByLabel(/room/i).fill("A-101");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/equipment/);
  });

  test("should redirect authenticated users away from login", async ({ page }) => {
    // Register first
    const email = `redirect${Date.now()}@test.com`;
    await page.goto("/auth/register");
    await page.getByLabel(/full name/i).fill("Redirect User");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/phone/i).fill("0551234567");
    await page.getByLabel(/password/i).fill("testpassword123");
    await page.getByLabel(/hostel/i).fill("Test Hall");
    await page.getByLabel(/room/i).fill("A-101");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/equipment/);

    // Try to visit login - should redirect
    await page.goto("/auth/login");
    await expect(page).toHaveURL(/equipment/);
  });

  test("should protect routes for unauthenticated users", async ({ page }) => {
    await page.goto("/bookings");
    await expect(page).toHaveURL(/auth\/login/);
  });

  test("should logout", async ({ page }) => {
    // Register first
    const email = `logout${Date.now()}@test.com`;
    await page.goto("/auth/register");
    await page.getByLabel(/full name/i).fill("Logout User");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/phone/i).fill("0551234567");
    await page.getByLabel(/password/i).fill("testpassword123");
    await page.getByLabel(/hostel/i).fill("Test Hall");
    await page.getByLabel(/room/i).fill("A-101");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/equipment/);

    // Logout via form submission
    await page.locator('form[action="/auth/logout"] button').click();
    await expect(page).toHaveURL(/auth\/login/);
  });
});
