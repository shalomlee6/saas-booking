/**
 * Public client site: axe on each state, and a keyboard-only booking.
 * Mock server only. No violations are suppressed.
 */
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Mock identity mode for this run: IDENTITY_MODE=phone or otp (default). */
const MODE: 'otp' | 'phone' = process.env.IDENTITY_MODE === 'phone' ? 'phone' : 'otp';

const SESSION = {
  slug: 'demo-salon',
  phone: '0501111111',
  verified: true,
  hasCustomer: true,
  firstName: 'נועה',
  birthday: { day: 2, month: 3 },
  attempts: 0,
  dead: false,
  upcoming: {
    id: 'apt-upcoming',
    date: '2026-11-15',
    time: '11:00',
    status: 'confirmed',
    serviceName: 'מניקור',
    serviceId: 's1',
    canChange: true,
  },
};

async function scan(page: Page, label: string): Promise<void> {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.finish();
  });
  const results = await new AxeBuilder({ page }).analyze();
  if (results.violations.length > 0) {
    console.log(`\n── Axe violations on ${label} (${results.violations.length}) ──`);
    for (const violation of results.violations) {
      console.log(`  [${violation.impact ?? 'unknown'}] ${violation.id}: ${violation.description}`);
      for (const node of violation.nodes.slice(0, 3)) {
        console.log(`    HTML: ${node.html}`);
        if (node.failureSummary) console.log(`    Why: ${node.failureSummary}`);
      }
    }
  }
  expect(results.violations).toHaveLength(0);
}

async function rememberEntrance(page: Page): Promise<void> {
  await page.addInitScript((mode) => {
    sessionStorage.setItem('boki:landingEntranceSeen:demo-salon', '1');
    localStorage.setItem('sb_mock_identity_mode', mode);
  }, MODE);
}

async function tabTo(page: Page, selector: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const matched = await page.evaluate((sel) => document.activeElement?.matches(sel) ?? false, selector);
    if (matched) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Tab did not reach ${selector}`);
}

test.describe('Public accessibility', () => {
  test.setTimeout(90_000);

  test('landing, menu, settings, and 320px have no axe violations', async ({ page }) => {
    await rememberEntrance(page);
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#main-content', { timeout: 60_000 });
    await page.waitForFunction(() => !document.querySelector('.pl-page--intro'));
    await scan(page, 'landing he light');

    await page.getByRole('button', { name: 'פתיחת תפריט' }).click();
    await scan(page, 'menu open');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'פתיחת תפריט' })).toBeFocused();

    await page.evaluate(() => localStorage.setItem('sb_lang', 'en'));
    await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#main-content');
    await page.waitForFunction(() => !document.querySelector('.pl-page--intro'));
    await scan(page, 'landing en');

    await page.evaluate(() => {
      localStorage.setItem('sb_lang', 'he');
      localStorage.setItem('sb_public_theme', 'dark');
    });
    await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#main-content');
    await page.waitForFunction(() => !document.querySelector('.pl-page--intro'));
    await scan(page, 'landing dark');

    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/b/demo-salon/settings', { waitUntil: 'domcontentloaded' });
    await page.locator('.public-settings-title').waitFor();
    await scan(page, 'settings 320');

    await page.goto('/b/demo-salon/accessibility', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'הצהרת נגישות' }).waitFor();
    await scan(page, 'accessibility statement');
  });

  test('booking steps, blocked, upcoming, and both drawers have no axe violations', async ({ page }) => {
    await rememberEntrance(page);
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/b/demo-salon/book', { waitUntil: 'domcontentloaded' });
    await page.locator('.book-service-card').first().waitFor({ timeout: 30_000 });
    await scan(page, 'book service');
    await page.locator('.book-service-card').first().click();
    await page.locator('#identify-phone').waitFor();
    await scan(page, 'identify phone');
    await page.locator('#identify-phone').fill('0502222222');
    await page.locator('.identify-submit').click();
    if (MODE === 'otp') {
      await page.locator('#identify-code').waitFor();
      await scan(page, 'otp');
      await page.locator('#identify-code').fill('482913');
      await page.locator('.identify-submit').first().click();
    }
    await page.locator('#identify-name').waitFor();
    await scan(page, 'profile');
    await page.locator('#identify-name').fill('דנה כהן');
    await page.locator('#identify-day').selectOption({ index: 29 });
    await page.locator('#identify-month').selectOption({ index: 2 });
    await page.locator('.identify-submit').click();
    if (MODE === 'otp') {
      await page.getByTestId('identify-greeting').waitFor();
      await scan(page, 'greeting');
      await page.locator('.identify-submit').click();
    }
    const day = page.locator('span.p-datepicker-day:not(.p-disabled)').nth(2);
    await day.waitFor();
    await scan(page, 'datetime');
    await day.click();
    await page.getByRole('option', { name: '09:00' }).click();
    await page.getByRole('button', { name: 'אישור התור' }).waitFor();
    await scan(page, 'confirm');

    await page.evaluate(() => localStorage.removeItem('sb_mock_public_session'));
    await page.goto('/b/demo-salon/book', { waitUntil: 'domcontentloaded' });
    await page.locator('.book-service-card').first().click();
    await page.locator('#identify-phone').fill('0500000000');
    await page.locator('.identify-submit').click();
    await page.getByText('לא ניתן לקבוע תור אונליין').waitFor();
    await scan(page, 'blocked');

    await page.evaluate((session) => {
      localStorage.setItem('sb_mock_public_session', JSON.stringify(session));
      localStorage.removeItem('sb_mock_identity_mode');
    }, SESSION);
    await page.goto('/b/demo-salon/upcoming', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'עריכה' }).waitFor({ timeout: 30_000 });
    await scan(page, 'upcoming');
    await page.getByRole('button', { name: 'עריכה' }).click();
    await page.getByRole('button', { name: 'קבעי מועד אחר' }).waitFor();
    await scan(page, 'drawer changeable');

    await page.evaluate(() => {
      const raw = localStorage.getItem('sb_mock_public_session');
      const session = raw ? JSON.parse(raw) : {};
      session.upcoming = { ...session.upcoming, canChange: false };
      localStorage.setItem('sb_mock_public_session', JSON.stringify(session));
      localStorage.setItem('sb_mock_identity_mode', 'phone');
    });
    await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'עריכה' }).click();
    await page.getByRole('link', { name: 'התקשרי לעסק' }).waitFor();
    await scan(page, 'drawer locked');
  });

  test('keyboard-only booking confirms an appointment', async ({ page }) => {
    await rememberEntrance(page);
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto('/b/demo-salon/book', { waitUntil: 'domcontentloaded' });
    await page.locator('.book-service-card').first().waitFor({ timeout: 30_000 });
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) animation.finish();
      // The step heading is focused on load. Reset the sequential focus
      // starting point to the document so the next Tab is the first stop.
      document.documentElement.tabIndex = -1;
      document.documentElement.focus();
    });

    await page.keyboard.press('Tab');
    await expect(page.locator('a.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();

    await tabTo(page, '.book-service-card');
    await page.keyboard.press('Enter');
    await page.locator('#identify-phone').waitFor();
    await tabTo(page, '#identify-phone');
    await page.keyboard.type('0502222222');
    await tabTo(page, '.identify-submit');
    await page.keyboard.press('Enter');

    if (MODE === 'otp') {
      await page.locator('#identify-code').waitFor();
      await tabTo(page, '#identify-code');
      await page.keyboard.type('482913');
      await tabTo(page, '.identify-submit');
      await page.keyboard.press('Enter');
    }

    await page.locator('#identify-name').waitFor();
    await tabTo(page, '#identify-name');
    await page.keyboard.type('דנה כהן');
    await tabTo(page, '#identify-day');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await tabTo(page, '#identify-month');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await tabTo(page, '.identify-submit');
    await page.keyboard.press('Enter');

    if (MODE === 'otp') {
      await page.getByTestId('identify-greeting').waitFor();
      await tabTo(page, '.identify-submit');
      await page.keyboard.press('Enter');
    }

    await page.locator('span.p-datepicker-day:not(.p-disabled)').nth(2).waitFor();
    await tabTo(page, 'span.p-datepicker-day[tabindex="0"]');
    await page.keyboard.press('Enter');
    await page.getByRole('option', { name: '09:00' }).waitFor();
    await tabTo(page, '.book-slot-btn');
    await page.keyboard.press('Enter');

    await page.getByRole('button', { name: 'אישור התור' }).waitFor();
    await tabTo(page, '.book-confirm');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/b\/demo-salon\/?$/);
  });
});
