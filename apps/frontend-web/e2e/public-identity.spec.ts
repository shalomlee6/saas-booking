/**
 * Public client identity on the mock booking site.
 * Hebrew, RTL, light, 390px. Screenshots land in playwright-screenshots/public-identity.
 */
import fs from 'fs';
import path from 'path';
import { expect, test, type Page } from '@playwright/test';

const OUT = path.join(__dirname, '..', 'playwright-screenshots', 'public-identity');
const BLOCKED = 'לא ניתן לקבוע תור אונליין. נא ליצור קשר עם העסק.';

async function prepare(page: Page, extra?: () => void): Promise<void> {
  await page.addInitScript((setup) => {
    localStorage.setItem('sb_lang', 'he');
    localStorage.removeItem('sb_mock_identity_mode');
    localStorage.removeItem('sb_mock_public_session');
    setup?.();
  }, extra ? undefined : undefined);
  await page.setViewportSize({ width: 390, height: 844 });
}

async function openBook(page: Page): Promise<void> {
  await page.goto('/b/demo-salon/book', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.book-service-card').first()).toBeVisible({ timeout: 30_000 });
}

async function shot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${name}-390-he-light.png`), fullPage: true });
}

test.describe('public client identity', () => {
  test.setTimeout(120_000);

  test('new client registers, then reaches confirm without a name field', async ({ page }) => {
    await prepare(page);
    await openBook(page);
    await shot(page, '01-service');
    await page.locator('.book-service-card').first().click();
    await expect(page.locator('#identify-phone')).toBeVisible();
    await shot(page, '02-phone');
    await page.locator('#identify-phone').fill('0502222222');
    await page.locator('.identify-submit').click();
    await expect(page.locator('#identify-code')).toBeVisible();
    await shot(page, '03-code');
    await page.locator('#identify-code').fill('482913');
    await page.locator('.identify-submit').first().click();
    await expect(page.locator('#identify-name')).toBeVisible();
    await shot(page, '04-profile');
    await page.locator('#identify-name').fill('דנה כהן');
    await page.locator('#identify-day').selectOption({ index: 29 });
    await page.locator('#identify-month').selectOption({ index: 2 });
    await page.locator('.identify-submit').click();
    await expect(page.getByTestId('identify-greeting')).toContainText('דנה');
    await shot(page, '05-greeting');
    await page.locator('.identify-submit').click();
    await page.locator('span.p-datepicker-day:not(.p-disabled)').nth(2).click();
    await expect(page.getByTestId('book-offer')).toContainText('45');
    await expect(page.getByTestId('book-offer')).toContainText('180');
    await shot(page, '06-datetime');
    await page.getByRole('option', { name: '09:00' }).click();
    await expect(page.getByText('הכל נראה טוב? לחצי לאישור התור')).toBeVisible();
    await expect(page.locator('#guestName')).toHaveCount(0);
    await expect(page.locator('#guestPhone')).toHaveCount(0);
    await shot(page, '07-confirm');
  });

  test('known client on a new device is greeted by name', async ({ page }) => {
    await prepare(page);
    await openBook(page);
    await page.locator('.book-service-card').first().click();
    await page.locator('#identify-phone').fill('0501111111');
    await page.locator('.identify-submit').click();
    await page.locator('#identify-code').fill('482913');
    await page.locator('.identify-submit').first().click();
    await expect(page.getByTestId('identify-greeting')).toContainText('נועה');
    await shot(page, '08-known-greeting');
  });

  test('a returning device skips identify', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sb_lang', 'he');
      localStorage.setItem(
        'sb_mock_public_session',
        JSON.stringify({
          slug: 'demo-salon',
          phone: '0501111111',
          verified: true,
          hasCustomer: true,
          firstName: 'נועה',
          birthday: { day: 2, month: 3 },
          attempts: 0,
          dead: false,
        })
      );
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await openBook(page);
    await page.locator('.book-service-card').first().click();
    await expect(page.locator('#identify-phone')).toHaveCount(0);
    await expect(page.getByText('בחרי תאריך שנוח לך')).toBeVisible();
    await shot(page, '09-returning-date');
  });

  test('a blocked client sees only the unavailable message', async ({ page }) => {
    await prepare(page);
    await openBook(page);
    await page.locator('.book-service-card').first().click();
    await page.locator('#identify-phone').fill('0500000000');
    await page.locator('.identify-submit').click();
    await expect(page.getByRole('heading', { name: BLOCKED })).toBeVisible();
    await expect(page.locator('#identify-code')).toHaveCount(0);
    await shot(page, '10-blocked');
  });

  test('five wrong codes kill the code', async ({ page }) => {
    await prepare(page);
    await openBook(page);
    await page.locator('.book-service-card').first().click();
    await page.locator('#identify-phone').fill('0502222222');
    await page.locator('.identify-submit').click();
    await expect(page.locator('#identify-code')).toBeVisible();
    for (let i = 0; i < 5; i++) {
      await page.locator('#identify-code').fill('000000');
      await page.locator('.identify-submit').first().click();
    }
    await expect(page.getByRole('alert')).toContainText('הקוד כבר לא בתוקף');
  });

  test('header is menu and name; side menu is my appointments', async ({ page }) => {
    await prepare(page);
    await openBook(page);
    const header = page.getByRole('banner');
    await expect(header.getByRole('link')).toHaveCount(0);
    const menuBtn = header.getByRole('button', { name: 'פתיחת תפריט' });
    const title = page.locator('.public-nav-topbar-title');
    const heBtn = await menuBtn.boundingBox();
    const heTitle = await title.boundingBox();
    expect(heBtn && heTitle && heBtn.x).toBeGreaterThan((heTitle?.x ?? 0) + (heTitle?.width ?? 0) / 2);
    await menuBtn.click();
    await expect(page.getByRole('link', { name: 'התורים שלי' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'תורים קרובים' })).toHaveCount(0);
    await shot(page, '12-menu');

    await page.addInitScript(() => localStorage.setItem('sb_lang', 'en'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.book-service-card').first()).toBeVisible({ timeout: 30_000 });
    const enBtn = page.getByRole('banner').getByRole('button', { name: 'Open menu' });
    const enBtnBox = await enBtn.boundingBox();
    const enTitle = await title.boundingBox();
    expect(enBtnBox && enTitle && enBtnBox.x).toBeLessThan(enTitle.x);
    await enBtn.click();
    await expect(page.getByRole('link', { name: 'My appointments' })).toBeVisible();
  });

  test('verified client opens the edit drawer and completes its actions', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sb_lang', 'he');
      localStorage.setItem(
        'sb_mock_public_session',
        JSON.stringify({
          slug: 'demo-salon',
          phone: '0501111111',
          verified: true,
          hasCustomer: true,
          firstName: 'נועה',
          birthday: { day: 2, month: 3 },
          attempts: 0,
          dead: false,
        })
      );
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
    const edit = page.getByRole('button', { name: 'עריכה' });
    await expect(edit).toBeVisible({ timeout: 30_000 });
    await edit.click();
    const drawer = page.locator('.public-apt-details-drawer, .public-apt-details-dialog').first();
    await expect(drawer.getByText('פרטי תור')).toBeVisible();
    await expect(drawer.getByRole('button', { name: 'קבעי מועד אחר' })).toBeVisible();
    await expect(drawer.locator('#publicAptCancelReason')).toBeVisible();
    await shot(page, '13-home-card');

    await drawer.getByRole('button', { name: 'קבעי מועד אחר' }).click();
    await expect(page.getByText('בחרי תאריך שנוח לך')).toBeVisible();

    await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
    await expect(edit).toBeVisible({ timeout: 30_000 });
    await edit.click();
    await drawer.locator('#publicAptCancelReason').fill('לא יכולה להגיע');
    await drawer.getByRole('button', { name: 'לחצי כאן לביטול התור' }).click();
    await expect(page.locator('.public-apt-card')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'קביעת תור' }).first()).toBeVisible();
  });

  test('verified client reschedules from the home card into one appointment', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sb_lang', 'he');
      localStorage.setItem(
        'sb_mock_public_session',
        JSON.stringify({
          slug: 'demo-salon',
          phone: '0501111111',
          verified: true,
          hasCustomer: true,
          firstName: 'נועה',
          birthday: { day: 2, month: 3 },
          attempts: 0,
          dead: false,
        })
      );
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
    const edit = page.getByRole('button', { name: 'עריכה' });
    await expect(edit).toBeVisible({ timeout: 30_000 });
    await edit.click();
    const drawer = page.locator('.public-apt-details-drawer, .public-apt-details-dialog').first();
    await drawer.getByRole('button', { name: 'קבעי מועד אחר' }).click();
    await expect(page).toHaveURL(/reschedule=apt-upcoming/);
    await expect(page.getByText('בחרי תאריך שנוח לך')).toBeVisible();
    await page.locator('span.p-datepicker-day:not(.p-disabled)').nth(2).click();
    await page.getByRole('option', { name: '09:00' }).click();
    const move = page.locator('.book-reschedule-move');
    await expect(move).toContainText('העברת התור מ-');
    await expect(move).toContainText('11:00');
    await expect(move).toContainText('09:00');
    const hold = page.locator('app-hold-to-confirm-button');
    const box = await hold.boundingBox();
    if (!box) throw new Error('hold button missing');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(2300);
    await page.mouse.up();
    await expect(page).toHaveURL(/\/b\/demo-salon\/?$/);
    await expect(page.locator('.public-apt-card')).toHaveCount(1);
    await expect(page.locator('.public-apt-card')).toContainText('09:00');
  });

  test('an unverified session shows no appointment and no name', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sb_lang', 'he');
      localStorage.setItem('sb_mock_identity_mode', 'phone');
      localStorage.setItem(
        'sb_mock_public_session',
        JSON.stringify({
          slug: 'demo-salon',
          phone: '0501111111',
          verified: false,
          hasCustomer: true,
          firstName: 'נועה',
          birthday: { day: 2, month: 3 },
          attempts: 0,
          dead: false,
        })
      );
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'קביעת תור' }).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.pl-greeting__title')).toHaveText('שלום, ברוכות הבאות');
    await expect(page.locator('.public-apt-card')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'ביטול תור' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'שינוי מועד' })).toHaveCount(0);
  });

  test('phone mode does not greet and hides my appointments', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sb_lang', 'he');
      localStorage.setItem('sb_mock_identity_mode', 'phone');
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await openBook(page);
    await expect(page.getByRole('link', { name: 'התורים שלי' })).toHaveCount(0);
    await page.locator('.book-service-card').first().click();
    await page.locator('#identify-phone').fill('0501111111');
    await page.locator('.identify-submit').click();
    await expect(page.getByText('בחרי תאריך שנוח לך')).toBeVisible();
    await expect(page.getByTestId('identify-greeting')).toHaveCount(0);
    await shot(page, '11-phone-mode-date');
  });
});
