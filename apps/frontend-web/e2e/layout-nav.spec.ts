/**
 * Below the shared sidebar breakpoint the topbar menu button must be reachable.
 * At and above it, the sidebar itself is on screen.
 */
import fs from 'fs';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';

const OUT = path.join(__dirname, '..', 'playwright-screenshots', 'layout-nav');
const WIDTHS = [390, 600, 768, 820, 1024, 1280] as const;

async function loginAsOwner(page: Page): Promise<void> {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="login-email"]', { timeout: 60_000 });
  await page.getByTestId('login-email').fill('owner@example.com');
  await page.getByTestId('login-password').fill('password12345');
  await page.locator('button.login-form-submit').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

async function navigationIsReachable(page: Page, width: number): Promise<void> {
  const sidebar = page.locator('.layout-sidebar');
  const menu = page.locator('.layout-topbar-menu-btn');
  await expect(sidebar).toBeAttached();
  if (width >= 1024) {
    await expect(sidebar).toBeInViewport();
    return;
  }
  await expect(menu).toBeVisible();
  const expanded = await menu.evaluate((el) => {
    const host = el.closest('[aria-expanded]') ?? el.parentElement;
    return el.getAttribute('aria-expanded') ?? host?.getAttribute('aria-expanded');
  });
  expect(expanded).toBe('false');
  const box = await menu.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const dir = await page.evaluate(() => document.documentElement.dir);
  if (dir === 'rtl') expect(box.x + box.width).toBeGreaterThan(width / 2);
  else expect(box.x).toBeLessThan(width / 2);
}

test('backoffice navigation is reachable at every width', async ({ page }) => {
  test.setTimeout(180_000);
  fs.mkdirSync(OUT, { recursive: true });
  await loginAsOwner(page);

  for (const lang of ['he', 'en'] as const) {
    await page.evaluate((value) => localStorage.setItem('sb_lang', value), lang);
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.locator('.layout-sidebar').waitFor({ timeout: 30_000 });

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width >= 1024 ? 800 : 900 });
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
      await navigationIsReachable(page, width);
      if (width === 600 || width === 820) {
        await page.screenshot({
          path: path.join(OUT, `dashboard-${width}-${lang}.png`),
          fullPage: false,
        });
      }
    }

    if (lang === 'he') {
      await page.setViewportSize({ width: 820, height: 900 });
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
      await page.locator('.layout-topbar-menu-btn').click();
      await expect(page.locator('.layout-sidebar')).toBeInViewport();
      await page.keyboard.press('Escape');
      await expect(page.locator('.layout-sidebar')).not.toBeInViewport();
    }
  }
});
