/**
 * Visual check of the customers data-management shell.
 * Saves viewport shots and does not assert pixels. Axe stays in accessibility.spec.ts.
 *
 * SHOT_DIR (env) picks the subfolder under playwright-screenshots/customers.
 * SHOT_MATRIX=baseline limits the run to he RTL light at both widths.
 */
import fs from 'fs';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';

const OUT = path.join(
  __dirname,
  '..',
  'playwright-screenshots',
  'customers',
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
}

async function waitForRows(page: Page, width: number): Promise<void> {
  await page.getByTestId('dm-search').waitFor({ timeout: 30_000 });
  const rows =
    width < 640
      ? page.locator('.data-table-card, .dm-card')
      : page.locator('tbody tr:not(.dm-skeleton-row)');
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
}

const MATRIX =
  process.env.SHOT_MATRIX === 'baseline'
    ? ([['he', 'light']] as const)
    : ([
        ['he', 'light'],
        ['he', 'dark'],
        ['en', 'light'],
      ] as const);

test('customers shell screenshots', async ({ page }) => {
  test.setTimeout(240_000);
  fs.mkdirSync(OUT, { recursive: true });
  await loginAsOwner(page);

  for (const [lang, theme] of MATRIX) {
    await page.evaluate((value) => localStorage.setItem('sb_lang', value), lang);
    for (const width of [1280, 390] as const) {
      await page.setViewportSize({ width, height: width === 1280 ? 800 : 844 });
      await page.goto('/customers', { waitUntil: 'domcontentloaded' });
      await waitForRows(page, width);
      await page.waitForTimeout(400);
      await forceTheme(page, theme === 'dark');
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, `customers-${width}-${lang}-${theme}.png`) });
    }
  }
});

/** Delays or replaces the mock customers fixture so loading and empty states hold still. */
async function stubCustomersFixture(page: Page, mode: 'slow' | 'empty'): Promise<void> {
  await page.addInitScript((value) => {
    const original = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/assets/mocks/customers.json')) {
        if (value === 'empty') {
          return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
        }
        await new Promise((resolve) => setTimeout(resolve, 60_000));
      }
      return original(input, init);
    };
  }, mode);
}

test('customers shell states', async ({ page }) => {
  test.setTimeout(240_000);
  const dir = path.join(OUT, 'states');
  fs.mkdirSync(dir, { recursive: true });
  await loginAsOwner(page);
  await page.evaluate(() => localStorage.setItem('sb_lang', 'he'));

  for (const width of [1280, 390] as const) {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 844 });
    const shot = (name: string) => page.screenshot({ path: path.join(dir, `${name}-${width}.png`) });

    // Drawer open, one filter chosen, then applied (chips row).
    await page.goto('/customers', { waitUntil: 'domcontentloaded' });
    await waitForRows(page, width);
    await page.getByTestId('dm-open-filters').click();
    await page.getByTestId('dm-filter-customerType').getByRole('button').nth(1).click();
    await page.getByTestId('dm-filter-activity').selectOption('noUpcoming');
    await page.waitForTimeout(500);
    await shot('drawer');
    await page.getByTestId('dm-drawer-apply').click();
    await page.waitForTimeout(600);
    await shot('chips');

    // No results.
    await page.getByTestId('dm-search').fill('zzzz-no-match');
    await expect(page.getByTestId('dm-no-results')).toBeVisible({ timeout: 10_000 });
    await shot('no-results');

    // Columns menu.
    await page.getByTestId('dm-no-results-clear').click();
    await waitForRows(page, width);
    if (width >= 640) {
      await page.getByTestId('dm-columns').click();
      await page.waitForTimeout(200);
      await shot('columns');
    }
  }

  // Drawer in dark mode (portaled to <body>, so it relies on the copied theme tokens).
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/customers', { waitUntil: 'domcontentloaded' });
  await waitForRows(page, 1280);
  await forceTheme(page, true);
  await page.waitForTimeout(400);
  await page.getByTestId('dm-open-filters').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(dir, 'drawer-dark-1280.png') });
  await page.getByTestId('dm-drawer-apply').click();
  await forceTheme(page, false);

  for (const mode of ['slow', 'empty'] as const) {
    const fresh = await page.context().newPage();
    await stubCustomersFixture(fresh, mode);
    await loginAsOwner(fresh);
    await fresh.evaluate(() => localStorage.setItem('sb_lang', 'he'));
    for (const width of [1280, 390] as const) {
      await fresh.setViewportSize({ width, height: width === 1280 ? 800 : 844 });
      await fresh.goto('/customers', { waitUntil: 'domcontentloaded' });
      await fresh.getByTestId(mode === 'slow' ? 'dm-loading' : 'dm-empty').waitFor({ timeout: 30_000 });
      await fresh.waitForTimeout(300);
      await fresh.screenshot({ path: path.join(dir, `${mode === 'slow' ? 'skeleton' : 'empty'}-${width}.png`) });
    }
    await fresh.close();
  }
});
