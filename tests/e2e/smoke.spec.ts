import { expect, test } from "@playwright/test";
import release from "../../release.json";

// Each test represents a separate visitor, including independent login limits.
test.beforeEach(async ({ context }, testInfo) => {
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `e2e-${testInfo.testId}`,
  });
});

test.describe("smoke", () => {
  test("home page renders without auth", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/pongo/i);
  });

  test("operational routes respond with dashboard auth enabled", async ({
    request,
  }) => {
    const health = await request.get("/health", { maxRedirects: 0 });
    expect(health.status()).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });

    const ready = await request.get("/ready", { maxRedirects: 0 });
    expect(ready.status()).toBe(200);
    expect(await ready.json()).toEqual({ status: "ready" });

    const version = await request.get("/version", { maxRedirects: 0 });
    expect(version.status()).toBe(200);
    expect(await version.json()).toMatchObject({ version: release.version });
  });

  test("protected route redirects to /login when no session", async ({
    page,
  }) => {
    await page.goto("/monitors");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("Access code", { exact: true })).toBeVisible();
  });

  test("login with invalid code shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Access code", { exact: true }).fill("wrong-code");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText(/invalid access code/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
