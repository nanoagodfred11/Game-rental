import { test, expect } from "@playwright/test";

test.describe("Admin", () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin (using seeded admin credentials)
    await page.goto("/auth/login");
    await page.getByLabel(/email/i).fill(process.env.ADMIN_EMAIL || "admin@example.com");
    await page.getByLabel(/password/i).fill(process.env.ADMIN_PASSWORD || "changethispassword123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/admin/);
  });

  test("should show admin dashboard", async ({ page }) => {
    await expect(page.getByText(/dashboard/i).or(page.getByText(/admin panel/i))).toBeVisible();
  });

  test("should show equipment management", async ({ page }) => {
    await page.goto("/admin/equipment");
    await expect(page.getByText(/PS5/)).toBeVisible();
  });

  test("should show bookings management", async ({ page }) => {
    await page.goto("/admin/bookings");
    await expect(page.getByText(/booking/i)).toBeVisible();
  });

  test("should show payments management", async ({ page }) => {
    await page.goto("/admin/payments");
    await expect(page.getByText(/payment/i)).toBeVisible();
  });

  test("should show promo codes management", async ({ page }) => {
    await page.goto("/admin/promo-codes");
    await expect(page.getByText(/promo/i)).toBeVisible();
  });

  test("should show users management", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByText(/user/i)).toBeVisible();
  });

  test("should show analytics page", async ({ page }) => {
    await page.goto("/admin/analytics");
    await expect(page.getByText(/analytics/i).or(page.getByText(/revenue/i))).toBeVisible();
  });

  test("should show audit logs", async ({ page }) => {
    await page.goto("/admin/audit-logs");
    await expect(page.getByText(/audit/i)).toBeVisible();
  });

  test("should prevent non-admin access", async ({ page, context }) => {
    // Clear cookies and register as regular user
    await context.clearCookies();
    const email = `nonadmin${Date.now()}@test.com`;
    await page.goto("/auth/register");
    await page.getByLabel(/full name/i).fill("Non Admin");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/phone/i).fill("0551234567");
    await page.getByLabel(/password/i).fill("testpassword123");
    await page.getByLabel(/hostel/i).fill("Test Hall");
    await page.getByLabel(/room/i).fill("A-101");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/equipment/);

    // Try to access admin
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/admin/);
  });
});
