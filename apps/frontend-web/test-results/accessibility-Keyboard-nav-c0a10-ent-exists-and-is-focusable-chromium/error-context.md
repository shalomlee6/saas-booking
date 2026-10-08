# Test info

- Name: Keyboard navigation — public booking >> skip link target #main-content exists and is focusable
- Location: E:\saas-booking\apps\frontend-web\e2e\accessibility.spec.ts:333:7

# Error details

```
Error: Timed out 5000ms waiting for expect(locator).toHaveAttribute(expected)

Locator: locator('a.skip-link').first()
Expected string: "#main-content"
Received: <element(s) not found>
Call log:
  - expect.toHaveAttribute with timeout 5000ms
  - waiting for locator('a.skip-link').first()

    at E:\saas-booking\apps\frontend-web\e2e\accessibility.spec.ts:339:28
```

# Page snapshot

```yaml
- banner:
  - button "פתיחת תפריט"
  - text: boki
- main:
  - heading "Demo Salon" [level=1]
  - region:
    - list:
      - listitem:
        - button "1"
      - listitem:
        - button "2"
  - paragraph: CHEN BEAUTY
  - paragraph: יופי מקצועי, תוצאות מושלמות
  - button " קביעת תור"
  - heading "שלום, ברוכות הבאות" [level=2]
  - paragraph: בואי נקבע תור בקלות ובמהירות
  - region "התור הקרוב שלך":
    - heading "התור הקרוב שלך" [level=2]
    - paragraph: אין לך תורים קרובים
    - paragraph: קבעי עכשיו טיפול מפנק!
    - button " קביעת תור"
  - region "השירותים שלנו":
    - heading "השירותים שלנו" [level=2]
    - list:
      - listitem:
        - heading "מניקור" [level=3]
        - paragraph: 30 דקות
        - paragraph: ‏50 ₪
        - button " הזמיני"
      - listitem:
        - heading "פדיקור" [level=3]
        - paragraph: 45 דקות
        - paragraph: ‏70 ₪
        - button " הזמיני"
      - listitem:
        - heading "ציפורניים" [level=3]
        - paragraph: 60 דקות
        - paragraph: ‏90 ₪
        - button " הזמיני"
  - region "העבודות שלנו":
    - heading "העבודות שלנו" [level=2]
    - paragraph: תמונות בקרוב ✨
  - region "הטיפולים המומלצים":
    - heading "הטיפולים המומלצים" [level=2]
    - list:
      - listitem:
        - heading "לק ג׳ל פרימיום" [level=3]
        - paragraph: עמידות ארוכה וברק מושלם
        - paragraph: ‏180 ₪
  - region "מה הלקוחות אומרות":
    - heading "מה הלקוחות אומרות" [level=2]
    - list:
      - listitem:
        - paragraph: "\"שירות מקסים ומקצועי, חזרתי שוב!\""
        - paragraph: מיכל·1 במרץ 2026
  - region "קביעת תור":
    - heading "מוכנה לטיפול הבא שלך?" [level=2]
    - paragraph: קביעת תור פשוטה, מהירה ובלחיצה אחת
    - button " קביעי תור עכשיו"
    - 'link "התקשרי: 050-1234567"':
      - /url: tel:0501234567
```

# Test source

```ts
  239 |   });
  240 |
  241 |   test('/customers with active filters and no results has no axe violations', async ({ page }) => {
  242 |     await openCustomers(page, 'he', 1280);
  243 |     await page.getByTestId('dm-open-filters').click();
  244 |     await page.getByTestId('dm-filter-customerType').getByRole('button').nth(1).click();
  245 |     await page.getByTestId('dm-drawer-apply').click();
  246 |     await page.getByTestId('dm-search').fill('zzzz-no-match');
  247 |     await expect(page.getByTestId('dm-no-results')).toBeVisible({ timeout: 10_000 });
  248 |     await page.waitForTimeout(400);
  249 |     const results = await runAxe(page, '/customers no results');
  250 |     expect(results.violations).toHaveLength(0);
  251 |   });
  252 | });
  253 |
  254 | // ─── /appointments/new states ─────────────────────────────────────────────────
  255 |
  256 | test.describe('Accessibility — /appointments/new states', () => {
  257 |   test.setTimeout(180_000);
  258 |
  259 |   async function openForm(page: import('@playwright/test').Page, lang: 'he' | 'en', width: number) {
  260 |     await page.context().clearCookies();
  261 |     await loginAsOwner(page);
  262 |     await page.evaluate((value) => localStorage.setItem('sb_lang', value), lang);
  263 |     await page.setViewportSize({ width, height: width >= 1024 ? 800 : 1024 });
  264 |     await page.goto('/appointments/new', { waitUntil: 'domcontentloaded' });
  265 |     await page.locator('#customer-ac').waitFor({ timeout: 30_000 });
  266 |     await page.waitForTimeout(400);
  267 |   }
  268 |
  269 |   for (const [lang, width] of [
  270 |     ['he', 1280],
  271 |     ['he', 768],
  272 |     ['he', 390],
  273 |     ['en', 1280],
  274 |   ] as const) {
  275 |     test(`/appointments/new (${lang}, ${width}px) has no axe violations`, async ({ page }) => {
  276 |       await openForm(page, lang, width);
  277 |       const results = await runAxe(page, `/appointments/new ${lang} ${width}`);
  278 |       expect(results.violations).toHaveLength(0);
  279 |     });
  280 |   }
  281 |
  282 |   test('/appointments/new dark mode has no axe violations', async ({ page }) => {
  283 |     await openForm(page, 'he', 1280);
  284 |     await page.evaluate(() => {
  285 |       document.documentElement.classList.add('theme-dark');
  286 |       document.querySelector('.layout')?.classList.add('theme-dark');
  287 |     });
  288 |     await page.waitForTimeout(400);
  289 |     const results = await runAxe(page, '/appointments/new dark');
  290 |     expect(results.violations).toHaveLength(0);
  291 |   });
  292 |
  293 |   test('/appointments/new with validation errors has no axe violations', async ({ page }) => {
  294 |     await openForm(page, 'he', 1280);
  295 |     await page.locator('#customer-ac').focus();
  296 |     for (let i = 0; i < 14; i++) await page.keyboard.press('Tab');
  297 |     await expect(page.locator('.apt-field-error').first()).toBeVisible();
  298 |     const results = await runAxe(page, '/appointments/new errors');
  299 |     expect(results.violations).toHaveLength(0);
  300 |   });
  301 |
  302 |   test('/appointments/new with the customer suggestions open has no axe violations', async ({ page }) => {
  303 |     await openForm(page, 'he', 1280);
  304 |     await page.locator('.p-autocomplete-dropdown').click();
  305 |     await page.locator('.p-autocomplete-option').first().waitFor();
  306 |     // PrimeNG's suggestions popup is a combobox listbox: focus stays on the input
  307 |     // (aria-activedescendant), so its scroll container is deliberately not focusable.
  308 |     const results = await new AxeBuilder({ page }).disableRules(['scrollable-region-focusable']).analyze();
  309 |     expect(results.violations).toHaveLength(0);
  310 |   });
  311 | });
  312 |
  313 | // ─── Keyboard navigation — public booking ─────────────────────────────────────
  314 |
  315 | test.describe('Keyboard navigation — public booking', () => {
  316 |   test.setTimeout(60_000);
  317 |
  318 |   test('skip link is the first Tab stop on /b/demo-salon', async ({ page }) => {
  319 |     await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
  320 |     await page.waitForSelector('#main-content', { timeout: 60_000 });
  321 |
  322 |     await page.keyboard.press('Tab');
  323 |
  324 |     const focused = await page.evaluate(() => {
  325 |       const el = document.activeElement as HTMLAnchorElement | null;
  326 |       return { tag: el?.tagName?.toLowerCase(), href: el?.getAttribute('href') ?? '' };
  327 |     });
  328 |
  329 |     expect(focused.tag).toBe('a');
  330 |     expect(focused.href).toContain('#main-content');
  331 |   });
  332 |
  333 |   test('skip link target #main-content exists and is focusable', async ({ page }) => {
  334 |     await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
  335 |     await page.waitForSelector('#main-content', { timeout: 60_000 });
  336 |
  337 |     // The skip link must point to #main-content
  338 |     const skipLink = page.locator('a.skip-link').first();
> 339 |     await expect(skipLink).toHaveAttribute('href', '#main-content');
      |                            ^ Error: Timed out 5000ms waiting for expect(locator).toHaveAttribute(expected)
  340 |
  341 |     // The target must exist in the DOM and carry tabindex="-1" so it
  342 |     // is programmatically focusable even though it is not interactive.
  343 |     const mainContent = page.locator('#main-content').first();
  344 |     await expect(mainContent).toBeAttached();
  345 |     const tabindex = await mainContent.getAttribute('tabindex');
  346 |     expect(tabindex).toBe('-1');
  347 |   });
  348 |
  349 |   test('booking CTA button inside #main-content is keyboard-focusable', async ({ page }) => {
  350 |     await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
  351 |     // Wait until at least one button exists inside the main landmark
  352 |     await page.waitForFunction(
  353 |       () => {
  354 |         const main = document.getElementById('main-content');
  355 |         return !!main && main.querySelectorAll('button:not([disabled])').length > 0;
  356 |       },
  357 |       { timeout: 60_000 },
  358 |     );
  359 |
  360 |     // The hero CTA button ("קביעת תור") must be in the DOM and focusable
  361 |     const ctaBtn = page.locator('#main-content button').filter({ hasText: 'קביעת תור' }).first();
  362 |     await expect(ctaBtn).toBeVisible({ timeout: 10_000 });
  363 |
  364 |     // Programmatically focus the button to confirm it accepts keyboard focus
  365 |     await ctaBtn.focus();
  366 |     const focusedTag = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase() ?? '');
  367 |     expect(focusedTag).toBe('button');
  368 |
  369 |     // The button must not carry tabindex="-1" (which would remove it from tab order)
  370 |     const tabindex = await ctaBtn.getAttribute('tabindex');
  371 |     expect(tabindex).not.toBe('-1');
  372 |   });
  373 |
  374 |   test(':focus-visible outline is visible on the booking CTA button', async ({ page }) => {
  375 |     await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
  376 |     await page.waitForFunction(
  377 |       () => {
  378 |         const main = document.getElementById('main-content');
  379 |         return !!main && main.querySelectorAll('button:not([disabled])').length > 0;
  380 |       },
  381 |       { timeout: 60_000 },
  382 |     );
  383 |
  384 |     const ctaBtn = page.locator('#main-content button').filter({ hasText: 'קביעת תור' }).first();
  385 |     await expect(ctaBtn).toBeVisible({ timeout: 10_000 });
  386 |
  387 |     // Focus via keyboard simulation (Tab sequence) to trigger :focus-visible
  388 |     await ctaBtn.focus();
  389 |
  390 |     const { outlineWidth, outlineStyle } = await page.evaluate(() => {
  391 |       const el = document.activeElement as HTMLElement | null;
  392 |       if (!el) return { outlineWidth: '0px', outlineStyle: 'none' };
  393 |       const s = window.getComputedStyle(el);
  394 |       return { outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle };
  395 |     });
  396 |
  397 |     // A non-zero outline confirms the :focus-visible ring in styles.scss is applied
  398 |     expect(outlineStyle).not.toBe('none');
  399 |     expect(outlineWidth).not.toBe('0px');
  400 |   });
  401 |
  402 |   test('booking/CTA button on /b/demo-salon is reachable via keyboard', async ({ page }) => {
  403 |     await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
  404 |     await page.waitForSelector('#main-content', { timeout: 60_000 });
  405 |
  406 |     // The landing page has at least one "book" / CTA button.
  407 |     // Locate it by role and confirm it is in the DOM and tabbable.
  408 |     const bookBtn = page
  409 |       .getByRole('button', { name: /קביעת תור|הזמנה|הזמן/i })
  410 |       .or(page.getByRole('link', { name: /קביעת תור|הזמנה|הזמן/i }))
  411 |       .first();
  412 |
  413 |     await expect(bookBtn).toBeVisible({ timeout: 10_000 });
  414 |
  415 |     // Confirm it has no tabindex=-1 (i.e. is reachable from keyboard)
  416 |     const tabindex = await bookBtn.getAttribute('tabindex');
  417 |     expect(tabindex).not.toBe('-1');
  418 |   });
  419 | });
  420 |
```