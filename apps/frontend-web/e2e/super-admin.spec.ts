import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Super admin console', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.addInitScript(() => {
      try {
        localStorage.clear();
        // Do not sessionStorage.clear(): mock auth persists keys across full navigations.
        sessionStorage.removeItem('sb_session_exp_ms');
      } catch {
        /* ignore */
      }
    });
  });

  async function loginAsSuperAdmin(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="login-email"]', { timeout: 90_000 });
    await expect(page.getByTestId('login-email')).toBeVisible();
    await page.getByTestId('login-email').fill('superadmin@example.com');
    await page.getByTestId('login-password').fill('password12345');
    await page.locator('button.login-form-submit').click();
    await expect(page).toHaveURL(/\/super-admin/, { timeout: 30_000 });
  }

  test('login lands on /super-admin', async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test('cannot access owner /dashboard without impersonation', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/super-admin/);
  });

  test('impersonation flow and exit', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/super-admin/businesses');
    await page.getByRole('button', { name: 'Impersonate' }).first().click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByText(/Impersonating/i).first()).toBeVisible();
    await page.getByRole('button', { name: 'Exit' }).click();
    await expect(page).toHaveURL(/\/super-admin\//);
    await expect(page.getByText(/Impersonating/i)).toHaveCount(0);
  });

  test('users page loads data', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/super-admin/users');
    await expect(page.getByRole('cell', { name: 'Email' }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('superadmin@example.com').first()).toBeVisible();
  });

  test('analytics page renders charts', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/super-admin/analytics');
    await expect(page.locator('.sa-kpi-value').first()).toBeVisible();
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });
  });

  test('settings save shows success toast', async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/super-admin/settings');
    await page.getByRole('switch').first().click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('.p-toast-message-success').first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Smoke', () => {
  test('Angular app boots on dev server', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('app-root')).toBeAttached();
  });
});
