/**
 * Visual check of the owner business-settings sections at desktop, tablet and mobile.
 * Saves shots, asserts nothing. SHOT_DIR (env) picks the subfolder under playwright-screenshots/settings.
 */
import fs from 'fs';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';

const OUT = path.join(__dirname, '..', 'playwright-screenshots', 'settings', process.env.SHOT_DIR ?? 'current');
const SECTIONS = ['design', 'hours', 'booking', 'reliability', 'customers', 'policy'] as const;
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const;
const MATRIX = [
  ['he', 'light'],
  ['he', 'dark'],
  ['en', 'light'],
] as const;

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
  await page.waitForTimeout(300);
}

test('business settings screenshots', async ({ page }) => {
  test.setTimeout(600_000);
  fs.mkdirSync(OUT, { recursive: true });
  await loginAsOwner(page);

  for (const [lang, theme] of MATRIX) {
    await page.evaluate((value) => localStorage.setItem('sb_lang', value), lang);
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const id of SECTIONS) {
        await page.goto(`/settings/${id}`, { waitUntil: 'domcontentloaded' });
        await page.locator('.settings-shell').waitFor({ timeout: 30_000 });
        await expect(page.locator('html')).toHaveAttribute('dir', lang === 'he' ? 'rtl' : 'ltr');
        await forceTheme(page, theme === 'dark');
        await page.waitForTimeout(400);
        // The app scrolls inside its own container, so grow the viewport to show the whole page.
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
          await page.setViewportSize({ width: vp.width, height: vp.height + overflow });
          await page.waitForTimeout(300);
        }
        await page.screenshot({
          path: path.join(OUT, `${id}-${vp.name}-${lang}-${theme}.png`),
          fullPage: true,
        });
        if (overflow > 0) await page.setViewportSize({ width: vp.width, height: vp.height });
      }
    }
  }
});
