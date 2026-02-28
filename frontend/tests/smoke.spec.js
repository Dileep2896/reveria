import { test, expect } from '@playwright/test';

// Firebase will log errors with dummy config — that's expected and fine.

test('home page loads without crashing', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Reveria/i);
  // Page should render something visible (auth screen or canvas)
  await expect(page.locator('body')).toBeVisible();
});

test('book page renders without JS error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => {
    // Ignore Firebase auth errors (expected with dummy config)
    if (/firebase|auth|network/i.test(err.message)) return;
    errors.push(err.message);
  });

  await page.goto('/book/nonexistent');
  await expect(page.locator('body')).toBeVisible();
  expect(errors).toEqual([]);
});

test('terms page shows terms content', async ({ page }) => {
  await page.goto('/terms');
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('body')).toContainText(/terms/i);
});
