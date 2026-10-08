/**
 * Hebrew light shots of the super-admin audit log.
 * The admin chrome stays LTR; the audit page itself follows the Hebrew direction.
 */
import fs from 'fs';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';

const OUT = path.join(__dirname, '..', 'playwright-screenshots', 'audit');

async function loginAsSuperAdmin(page: Page): Promise<void> {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="login-email"]', { timeout: 60_000 });
  await page.getByTestId('login-email').fill('superadmin@example.com');
  await page.getByTestId('login-password').fill('password12345');
  await page.locator('button.login-form-submit').click();
  await expect(page).toHaveURL(/\/super-admin/, { timeout: 30_000 });
}

test('audit log hebrew light screenshots', async ({ page }) => {
  test.setTimeout(120_000);
  fs.mkdirSync(OUT, { recursive: true });
  await loginAsSuperAdmin(page);
  await page.evaluate(() => localStorage.setItem('sb_lang', 'he'));

  for (const width of [1280, 390] as const) {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 844 });
    await page.goto('/super-admin/audit', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('dm-search').waitFor({ timeout: 30_000 });
    const rows = width < 640 ? page.locator('.data-table-card') : page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.audit-page')).toHaveAttribute('dir', 'rtl');
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(OUT, `audit-${width}-he-light.png`),
      fullPage: true,
    });
  }
});
