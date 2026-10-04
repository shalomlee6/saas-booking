/**
 * Hebrew RTL light shots of the appointments list and the unchanged week calendar.
 */
import fs from 'fs';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';

const OUT = path.join(__dirname, '..', 'playwright-screenshots', 'appointments');

async function loginAsOwner(page: Page): Promise<void> {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="login-email"]', { timeout: 60_000 });
  await page.getByTestId('login-email').fill('owner@example.com');
  await page.getByTestId('login-password').fill('password12345');
  await page.locator('button.login-form-submit').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

test('appointments list and calendar hebrew light screenshots', async ({ page }) => {
  test.setTimeout(120_000);
  fs.mkdirSync(OUT, { recursive: true });
  await loginAsOwner(page);
  await page.evaluate(() => localStorage.setItem('sb_lang', 'he'));

  for (const width of [1280, 390] as const) {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 844 });
    await page.goto('/appointments?view=list', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('dm-search').waitFor({ timeout: 30_000 });
    const rows = width < 640 ? page.locator('.data-table-card') : page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(OUT, `appointments-list-${width}-he-light.png`),
      fullPage: true,
    });

    await page.goto('/appointments', { waitUntil: 'domcontentloaded' });
    await page.locator('.appointments-page').waitFor({ timeout: 30_000 });
    await expect(page.locator('.appointments-list-page')).toHaveCount(0);
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(OUT, `appointments-calendar-${width}-he-light.png`),
      fullPage: true,
    });
  }
});
