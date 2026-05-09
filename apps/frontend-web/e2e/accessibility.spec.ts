/**
 * Accessibility E2E suite — axe-core scans + keyboard navigation.
 *
 * Runs against the mock Angular server (--configuration=mock) so no real
 * backend is required.  All violations are printed verbatim to the console;
 * none are suppressed.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Login as the mock owner and wait for /dashboard. */
async function loginAsOwner(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="login-email"]', { timeout: 60_000 });
  await page.getByTestId('login-email').fill('owner@example.com');
  await page.getByTestId('login-password').fill('password12345');
  await page.locator('button.login-form-submit').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

/** Run an axe scan and log any violations — does NOT suppress them. */
async function runAxe(page: import('@playwright/test').Page, routeLabel: string) {
  const results = await new AxeBuilder({ page }).analyze();

  if (results.violations.length > 0) {
    console.log(`\n── Axe violations on ${routeLabel} (${results.violations.length}) ──`);
    for (const v of results.violations) {
      console.log(`  [${v.impact ?? 'unknown'}] ${v.id}: ${v.description}`);
      for (const n of v.nodes.slice(0, 3)) {
        console.log(`    HTML: ${n.html}`);
        if (n.failureSummary) console.log(`    Why: ${n.failureSummary}`);
      }
    }
    console.log('────────────────────────────────────────────────');
  }

  return results;
}

// ─── axe scans ────────────────────────────────────────────────────────────────

test.describe('Accessibility — axe-core scans', () => {
  // No serial mode — every route is scanned independently so a failure on
  // one route does not prevent the others from reporting their violations.
  test.setTimeout(120_000);

  test('/auth/login has no axe violations', async ({ page }) => {
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="login-email"]', { timeout: 60_000 });

    const results = await runAxe(page, '/auth/login');
    expect(results.violations).toHaveLength(0);
  });

  test('/auth/register has no axe violations', async ({ page }) => {
    await page.goto('/auth/register', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('form', { timeout: 60_000 });

    const results = await runAxe(page, '/auth/register');
    expect(results.violations).toHaveLength(0);
  });

  test('/b/demo-salon (public booking) has no axe violations', async ({ page }) => {
    await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#main-content', { timeout: 60_000 });

    const results = await runAxe(page, '/b/demo-salon');
    expect(results.violations).toHaveLength(0);
  });

  test('/dashboard (owner portal) has no axe violations', async ({ page, context }) => {
    await context.clearCookies();
    await page.addInitScript(() => {
      try {
        localStorage.clear();
        sessionStorage.removeItem('sb_session_exp_ms');
      } catch {
        /* ignore */
      }
    });

    await loginAsOwner(page);
    await page.waitForSelector('#main-content', { timeout: 30_000 });

    const results = await runAxe(page, '/dashboard');
    expect(results.violations).toHaveLength(0);
  });
});

// ─── Keyboard navigation — public booking ─────────────────────────────────────

test.describe('Keyboard navigation — public booking', () => {
  test.setTimeout(60_000);

  test('skip link is the first Tab stop on /b/demo-salon', async ({ page }) => {
    await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#main-content', { timeout: 60_000 });

    await page.keyboard.press('Tab');

    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLAnchorElement | null;
      return { tag: el?.tagName?.toLowerCase(), href: el?.getAttribute('href') ?? '' };
    });

    expect(focused.tag).toBe('a');
    expect(focused.href).toContain('#main-content');
  });

  test('skip link target #main-content exists and is focusable', async ({ page }) => {
    await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#main-content', { timeout: 60_000 });

    // The skip link must point to #main-content
    const skipLink = page.locator('a.skip-link').first();
    await expect(skipLink).toHaveAttribute('href', '#main-content');

    // The target must exist in the DOM and carry tabindex="-1" so it
    // is programmatically focusable even though it is not interactive.
    const mainContent = page.locator('#main-content').first();
    await expect(mainContent).toBeAttached();
    const tabindex = await mainContent.getAttribute('tabindex');
    expect(tabindex).toBe('-1');
  });

  test('booking CTA button inside #main-content is keyboard-focusable', async ({ page }) => {
    await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
    // Wait until at least one button exists inside the main landmark
    await page.waitForFunction(
      () => {
        const main = document.getElementById('main-content');
        return !!main && main.querySelectorAll('button:not([disabled])').length > 0;
      },
      { timeout: 60_000 },
    );

    // The hero CTA button ("קביעת תור") must be in the DOM and focusable
    const ctaBtn = page.locator('#main-content button').filter({ hasText: 'קביעת תור' }).first();
    await expect(ctaBtn).toBeVisible({ timeout: 10_000 });

    // Programmatically focus the button to confirm it accepts keyboard focus
    await ctaBtn.focus();
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase() ?? '');
    expect(focusedTag).toBe('button');

    // The button must not carry tabindex="-1" (which would remove it from tab order)
    const tabindex = await ctaBtn.getAttribute('tabindex');
    expect(tabindex).not.toBe('-1');
  });

  test(':focus-visible outline is visible on the booking CTA button', async ({ page }) => {
    await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => {
        const main = document.getElementById('main-content');
        return !!main && main.querySelectorAll('button:not([disabled])').length > 0;
      },
      { timeout: 60_000 },
    );

    const ctaBtn = page.locator('#main-content button').filter({ hasText: 'קביעת תור' }).first();
    await expect(ctaBtn).toBeVisible({ timeout: 10_000 });

    // Focus via keyboard simulation (Tab sequence) to trigger :focus-visible
    await ctaBtn.focus();

    const { outlineWidth, outlineStyle } = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return { outlineWidth: '0px', outlineStyle: 'none' };
      const s = window.getComputedStyle(el);
      return { outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle };
    });

    // A non-zero outline confirms the :focus-visible ring in styles.scss is applied
    expect(outlineStyle).not.toBe('none');
    expect(outlineWidth).not.toBe('0px');
  });

  test('booking/CTA button on /b/demo-salon is reachable via keyboard', async ({ page }) => {
    await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#main-content', { timeout: 60_000 });

    // The landing page has at least one "book" / CTA button.
    // Locate it by role and confirm it is in the DOM and tabbable.
    const bookBtn = page
      .getByRole('button', { name: /קביעת תור|הזמנה|הזמן/i })
      .or(page.getByRole('link', { name: /קביעת תור|הזמנה|הזמן/i }))
      .first();

    await expect(bookBtn).toBeVisible({ timeout: 10_000 });

    // Confirm it has no tabindex=-1 (i.e. is reachable from keyboard)
    const tabindex = await bookBtn.getAttribute('tabindex');
    expect(tabindex).not.toBe('-1');
  });
});
