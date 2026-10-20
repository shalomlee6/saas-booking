/**
 * Screenshots of the client-site theme: the owner's settings tab (1280 and 390) and the public site
 * with one custom theme. Saves shots, asserts nothing. SHOT_DIR (env) picks the subfolder under
 * playwright-screenshots/client-theme.
 */
import fs from 'fs';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';

const OUT = path.join(__dirname, '..', 'playwright-screenshots', 'client-theme', process.env.SHOT_DIR ?? 'current');
const THEME = { preset: 'custom', colors: { primary: '#1D4ED8', secondary: '#F59E0B', background: '#F8FAFC' } };

async function loginAsOwner(page: Page): Promise<void> {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="login-email"]', { timeout: 60_000 });
  await page.getByTestId('login-email').fill('owner@example.com');
  await page.getByTestId('login-password').fill('password12345');
  await page.locator('button.login-form-submit').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

/** The app scrolls inside its own container, so grow the viewport to show the whole page. */
async function fitAndShoot(page: Page, file: string, width: number, height: number): Promise<void> {
  const overflow = await page.evaluate(() => {
    let el = document.querySelector('.settings-shell')?.parentElement ?? null;
    while (el) {
      const scrolls = el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY !== 'visible';
      if (scrolls) return el.scrollHeight - el.clientHeight;
      el = el.parentElement;
    }
    return 0;
  });
  if (overflow > 0) {
    await page.setViewportSize({ width, height: height + overflow });
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  if (overflow > 0) await page.setViewportSize({ width, height });
}

test('client theme settings tab', async ({ page }) => {
  test.setTimeout(240_000);
  fs.mkdirSync(OUT, { recursive: true });
  await loginAsOwner(page);
  await page.evaluate(() => localStorage.setItem('sb_lang', 'he'));

  for (const [name, width, height] of [
    ['1280', 1280, 900],
    ['390', 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/settings/design', { waitUntil: 'domcontentloaded' });
    await page.locator('.settings-shell').waitFor({ timeout: 30_000 });
    await page.getByRole('tab', { name: 'אתר הלקוחות' }).click();
    await page.locator('app-public-theme-editor').waitFor();
    await page.waitForTimeout(300);
    await fitAndShoot(page, `settings-client-tab-preset-${name}.png`, width, height);

    await page.getByRole('radio', { name: 'מותאם אישית' }).check({ force: true });
    await page.locator('#clientPrimary').fill(THEME.colors.primary);
    await page.locator('#clientSecondary').fill(THEME.colors.secondary);
    await page.locator('#clientBackground').fill(THEME.colors.background);
    await page.waitForTimeout(400);
    await fitAndShoot(page, `settings-client-tab-custom-${name}.png`, width, height);

    await page.locator('input[name="previewMode"][value="dark"]').check({ force: true });
    await page.waitForTimeout(400);
    await page.locator('[data-testid="theme-preview"]').screenshot({ path: path.join(OUT, `preview-dark-${name}.png`) });
  }
});

test('public site with a custom theme', async ({ page }) => {
  test.setTimeout(240_000);
  fs.mkdirSync(OUT, { recursive: true });
  for (const mode of ['light', 'dark'] as const) {
    await page.addInitScript(
      ([pinned]) => {
        localStorage.setItem('sb_lang', 'he');
        localStorage.setItem('sb_mock_public_theme', pinned);
        localStorage.removeItem('sb_public_theme');
        sessionStorage.setItem('boki:landingEntranceSeen:demo-salon', '1');
      },
      [JSON.stringify({ ...THEME, defaultMode: mode })]
    );
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#main-content');
    await page.waitForFunction(() => !document.querySelector('.pl-page--intro'));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, `public-home-custom-${mode}.png`), fullPage: true });

    await page.goto('/b/demo-salon/book', { waitUntil: 'domcontentloaded' });
    await page.locator('.book-service-card').first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `public-book-custom-${mode}.png`), fullPage: true });
    // Fresh init scripts for the next mode.
    await page.context().clearCookies();
  }
});
