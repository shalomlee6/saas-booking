/**
 * Visual check of /appointments/new at desktop, tablet and mobile. Saves shots, asserts nothing.
 * SHOT_DIR (env) picks the subfolder under playwright-screenshots/appointment-form.
 */
import fs from 'fs';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';

const OUT = path.join(
  __dirname,
  '..',
  'playwright-screenshots',
  'appointment-form',
  process.env.SHOT_DIR ?? 'current'
);

async function loginAsOwner(page: Page): Promise<void> {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="login-email"]', { timeout: 60_000 });
  await page.getByTestId('login-email').fill('owner@example.com');
  await page.getByTestId('login-password').fill('password12345');
  await page.locator('button.login-form-submit').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

async function forceTheme(page: Page, dark: boolean): Promise<void> {
  await page.evaluate((isDark) => {
    const apply = () => {
      document.documentElement.classList.toggle('theme-dark', isDark);
      document.querySelector('.layout')?.classList.toggle('theme-dark', isDark);
    };
    apply();
    const host = window as Window & { __themeWatch?: MutationObserver };
    host.__themeWatch?.disconnect();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    const layout = document.querySelector('.layout');
    if (layout) observer.observe(layout, { attributes: true, attributeFilter: ['class'] });
    host.__themeWatch = observer;
  }, dark);
  await page.waitForTimeout(400);
}

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const MATRIX =
  process.env.SHOT_MATRIX === 'baseline'
    ? ([['he', 'light']] as const)
    : ([
        ['he', 'light'],
        ['he', 'dark'],
        ['en', 'light'],
      ] as const);

test('appointment form screenshots', async ({ page }) => {
  test.setTimeout(300_000);
  fs.mkdirSync(OUT, { recursive: true });
  await loginAsOwner(page);

  for (const [lang, theme] of MATRIX) {
    await page.evaluate((value) => localStorage.setItem('sb_lang', value), lang);
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/appointments/new', { waitUntil: 'domcontentloaded' });
      await page.locator('#customer-ac').waitFor({ timeout: 30_000 });
      await forceTheme(page, theme === 'dark');
      const name = `${vp.name}-${lang}-${theme}`;
      await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });

      // Scrolled to the actions.
      await page.locator('.apt-form-actions').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `${name}-bottom.png`) });
      await page.locator('.apt-form-title').scrollIntoViewIfNeeded();

      // Validation errors: tab through every field without filling it.
      await page.locator('#customer-ac').focus();
      for (let i = 0; i < 14; i++) await page.keyboard.press('Tab');
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `${name}-errors.png`), fullPage: true });
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

      // Date picker open.
      await page.locator('#aptDate').click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT, `${name}-date-open.png`) });
      await page.keyboard.press('Escape');

      // Customer suggestions open.
      await page.locator('.p-autocomplete-dropdown').click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT, `${name}-customer-open.png`) });
      await page.keyboard.press('Escape');

      // Service select open.
      await page.locator('#serviceId').click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT, `${name}-service-open.png`) });
      await page.keyboard.press('Escape');
    }
  }
});
