/**
 * Public booking in phone identity mode against the REAL API (`npm run dev:prodlike`):
 * production build, NODE_ENV=production, no mock interceptor, dedicated local MongoDB.
 *
 * One story on one device, in order: book → home card + "התורים שלי" → another device sees nothing →
 * reschedule → cancel → book again → log out lands on the business home page.
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const SLUG = 'prodlike-salon';
const HOME = new RegExp(`/b/${SLUG}/?$`);
const KNOWN_PHONE = '0501111111';
const API = 'http://localhost:3100';

async function newDevice(browser: import('@playwright/test').Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    baseURL: 'http://localhost:4300',
  });
  await context.addInitScript(() => {
    localStorage.setItem('sb_lang', 'he');
    sessionStorage.setItem('boki:landingEntranceSeen:prodlike-salon', '1');
  });
  return { context, page: await context.newPage() };
}

/** `alreadyIdentified`: this device identified on the business earlier, so the phone step is skipped. */
async function identify(page: Page, alreadyIdentified: boolean): Promise<void> {
  await page.goto(`/b/${SLUG}/book`, { waitUntil: 'domcontentloaded' });
  await page.locator('.book-service-card').first().click({ timeout: 60_000 });
  if (!alreadyIdentified) {
    await page.locator('#identify-phone').fill(KNOWN_PHONE);
    await page.locator('.identify-submit').click();
  }
  await expect(page.getByText('בחרי תאריך שנוח לך')).toBeVisible({ timeout: 30_000 });
}

/**
 * Picks the first day, from the `fromDay`-th selectable one on, that has a free slot, and its first slot;
 * returns the slot's time. The date picker already disables closed and full days, but which of the remaining
 * cells is still free depends on the weekday the suite runs on and on earlier bookings: scan instead of assuming.
 */
async function pickSlot(page: Page, fromDay: number): Promise<string> {
  const days = page.locator('span.p-datepicker-day:not(.p-disabled)');
  const slot = page.getByRole('option').first();
  const noSlots = page.getByText('אין שעות פנויות ביום הזה');
  for (let index = fromDay; index < fromDay + 10; index++) {
    await days.nth(index).click();
    await slot.or(noSlots).first().waitFor({ timeout: 30_000 });
    if (await slot.isVisible()) {
      const time = ((await slot.textContent()) ?? '').trim();
      await slot.click();
      return time;
    }
  }
  throw new Error('no day with a free slot in the next ten selectable days');
}

async function bookAppointment(page: Page, alreadyIdentified: boolean): Promise<string> {
  await identify(page, alreadyIdentified);
  const time = await pickSlot(page, 3);
  await page.getByRole('button', { name: 'אישור התור' }).click();
  await expect(page).toHaveURL(HOME, { timeout: 30_000 });
  return time;
}

async function openMenu(page: Page): Promise<void> {
  await page.getByRole('banner').getByRole('button', { name: 'פתיחת תפריט' }).click();
}

test.describe.configure({ mode: 'serial' });

test.describe('phone mode on the real API', () => {
  test.setTimeout(180_000);

  let device: { context: BrowserContext; page: Page };
  let page: Page;
  let bookedTime = '';

  test.beforeAll(async ({ browser }) => {
    device = await newDevice(browser);
    page = device.page;
  });

  test.afterAll(async () => {
    await device.context.close();
  });

  test('runs with production identity and cookie settings', async () => {
    const start = await device.context.request.post(`${API}/api/public/businesses/${SLUG}/identify/start`, {
      data: { phone: KNOWN_PHONE },
      headers: { Origin: 'http://localhost:4300' },
    });
    expect(start.status()).toBe(200);
    expect((await start.json()).status).toBe('known');
    const cookie = start.headers()['set-cookie'] ?? '';
    expect(cookie).toContain('sb_public_customer=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    // The one deliberate difference from production: no Secure flag over plain http://localhost.
    expect(cookie).not.toContain('Secure');
    await device.context.clearCookies();
  });

  test('date picker: closed Saturdays are disabled, the first free day is preselected and announced', async ({ browser }) => {
    const other = await newDevice(browser);
    try {
      await identify(other.page, false);
      // The month answered, so the first day with slots is already chosen and its times show.
      await expect(other.page.getByRole('option').first()).toBeVisible({ timeout: 30_000 });
      // Saturday is the last column; the salon is closed that day.
      await expect(other.page.locator('tbody td:last-child span.p-datepicker-day:not(.p-disabled)')).toHaveCount(0);
      expect(await other.page.locator('span.p-datepicker-day:not(.p-disabled)').count()).toBeGreaterThan(0);
      const saturday = other.page.locator('tbody td:last-child span.p-datepicker-day.p-disabled').first();
      await expect(saturday.locator('.sr-only')).toHaveText('לא זמין');
    } finally {
      await other.context.close();
    }
  });

  test('book: the home card and "התורים שלי" show it, with no name', async () => {
    bookedTime = await bookAppointment(page, false);
    await expect(page.locator('.public-apt-card')).toHaveCount(1);
    await expect(page.locator('.public-apt-card')).toContainText(bookedTime);
    await expect(page.locator('.pl-greeting__title')).toHaveText('שלום, ברוכות הבאות');

    await openMenu(page);
    await page.getByRole('link', { name: 'התורים שלי' }).click();
    await expect(page).toHaveURL(/\/upcoming/);
    await expect(page.getByText(bookedTime).first()).toBeVisible();
  });

  test('another device with the same phone sees nothing', async ({ browser }) => {
    const other = await newDevice(browser);
    try {
      await identify(other.page, false);
      await other.page.goto(`/b/${SLUG}`, { waitUntil: 'domcontentloaded' });
      await expect(other.page.getByRole('button', { name: 'קביעת תור' }).first()).toBeVisible({ timeout: 30_000 });
      await expect(other.page.locator('.public-apt-card')).toHaveCount(0);
      await expect(other.page.locator('.pl-greeting__title')).toHaveText('שלום, ברוכות הבאות');
      await openMenu(other.page);
      await expect(other.page.getByRole('link', { name: 'התורים שלי' })).toHaveCount(0);

      const list = await other.context.request.get(`${API}/api/public/appointments/upcoming?slug=${SLUG}`);
      expect(list.status()).toBe(200);
      const body = await list.json();
      expect(body.appointment).toBeNull();
      expect(body.appointments).toHaveLength(0);
    } finally {
      await other.context.close();
    }
  });

  test('reschedule from the home card', async () => {
    await page.goto(`/b/${SLUG}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'עריכה' }).click({ timeout: 30_000 });
    const drawer = page.locator('.public-apt-details-drawer, .public-apt-details-dialog').first();
    await drawer.getByRole('button', { name: 'קבעי מועד אחר' }).click();
    await expect(page.getByText('בחרי תאריך שנוח לך')).toBeVisible({ timeout: 30_000 });
    const movedTime = await pickSlot(page, 4);
    await page.getByRole('button', { name: 'אישור התור' }).click();
    await expect(page).toHaveURL(HOME, { timeout: 30_000 });
    await expect(page.locator('.public-apt-card')).toHaveCount(1);
    await expect(page.locator('.public-apt-card')).toContainText(movedTime);
    bookedTime = movedTime;
  });

  test('cancel: the card and the menu entry go away', async () => {
    await page.goto(`/b/${SLUG}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'עריכה' }).click({ timeout: 30_000 });
    const drawer = page.locator('.public-apt-details-drawer, .public-apt-details-dialog').first();
    await drawer.locator('#publicAptCancelReason').fill('לא יכולה להגיע');
    await drawer.getByRole('button', { name: 'לחצי כאן לביטול התור' }).click();
    await expect(page.locator('.public-apt-card')).toHaveCount(0);
    await openMenu(page);
    await expect(page.getByRole('link', { name: 'התורים שלי' })).toHaveCount(0);
  });

  test('log out: lands on the business home page with no client state left', async () => {
    const time = await bookAppointment(page, true);
    await expect(page.locator('.public-apt-card')).toContainText(time);

    await openMenu(page);
    await page.getByRole('button', { name: 'יציאה' }).click();

    await expect(page).toHaveURL(HOME, { timeout: 30_000 });
    await expect(page.locator('.public-apt-card')).toHaveCount(0);
    await expect(page.locator('.pl-greeting__title')).toHaveText('שלום, ברוכות הבאות');
    await expect(page.locator('#main-content')).toBeFocused();
    await expect(page.locator('.public-nav-sidebar-open')).toHaveCount(0);
    await openMenu(page);
    await expect(page.getByRole('link', { name: 'התורים שלי' })).toHaveCount(0);

    const me = await device.context.request.get(`${API}/api/public/session/me?slug=${SLUG}`);
    expect(me.status()).toBe(401);
  });
});
