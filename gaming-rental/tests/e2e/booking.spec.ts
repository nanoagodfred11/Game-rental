import { test, expect } from "@playwright/test";

test.describe("Booking Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Register a new user for each test
    const email = `booking${Date.now()}@test.com`;
    await page.goto("/auth/register");
    await page.getByLabel(/full name/i).fill("Booking Tester");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/phone/i).fill("0551234567");
    await page.getByLabel(/password/i).fill("testpassword123");
    await page.getByLabel(/hostel/i).fill("Test Hall");
    await page.getByLabel(/room/i).fill("A-101");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/equipment/);
  });

  test("should display available equipment", async ({ page }) => {
    await page.goto("/equipment");
    await expect(page.getByRole("heading", { name: /available equipment/i })).toBeVisible();
    await expect(page.getByText(/PS5/)).toBeVisible();
  });

  test("should navigate to booking creation", async ({ page }) => {
    await page.goto("/bookings/new");
    await expect(page.getByRole("heading", { name: /new booking/i }).or(page.getByText(/book/i))).toBeVisible();
  });

  test("should show my bookings page", async ({ page }) => {
    await page.goto("/bookings");
    await expect(page.getByRole("heading", { name: /my bookings/i }).or(page.getByText(/bookings/i).first())).toBeVisible();
  });

  test("should show empty state when no bookings", async ({ page }) => {
    await page.goto("/bookings");
    await expect(page.getByText(/no bookings/i).or(page.getByText(/book now/i))).toBeVisible();
  });
});
