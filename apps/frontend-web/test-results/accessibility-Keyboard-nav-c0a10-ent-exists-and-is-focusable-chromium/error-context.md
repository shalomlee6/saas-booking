# Test info

- Name: Keyboard navigation — public booking >> skip link target #main-content exists and is focusable
- Location: E:\saas-booking\apps\frontend-web\e2e\accessibility.spec.ts:249:7

# Error details

```
Error: Timed out 5000ms waiting for expect(locator).toHaveAttribute(expected)

Locator: locator('a.skip-link').first()
Expected string: "#main-content"
Received: <element(s) not found>
Call log:
  - expect.toHaveAttribute with timeout 5000ms
  - waiting for locator('a.skip-link').first()

    at E:\saas-booking\apps\frontend-web\e2e\accessibility.spec.ts:255:28
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
  155 |
  156 | test.describe('Accessibility — /customers states', () => {
  157 |   test.setTimeout(180_000);
  158 |
  159 |   async function openCustomers(page: import('@playwright/test').Page, lang: 'he' | 'en', width: number) {
  160 |     await page.context().clearCookies();
  161 |     await loginAsOwner(page);
  162 |     await page.evaluate((value) => localStorage.setItem('sb_lang', value), lang);
  163 |     await page.setViewportSize({ width, height: width >= 640 ? 800 : 844 });
  164 |     await page.goto('/customers', { waitUntil: 'domcontentloaded' });
  165 |     await page.getByTestId('dm-search').waitFor({ timeout: 30_000 });
  166 |     await expect(
  167 |       width >= 640 ? page.locator('tbody tr').first() : page.locator('.data-table-card').first()
  168 |     ).toBeVisible({ timeout: 30_000 });
  169 |     await page.waitForTimeout(400);
  170 |   }
  171 |
  172 |   async function setDark(page: import('@playwright/test').Page, dark: boolean) {
  173 |     await page.evaluate((isDark) => {
  174 |       document.documentElement.classList.toggle('theme-dark', isDark);
  175 |       document.querySelector('.layout')?.classList.toggle('theme-dark', isDark);
  176 |     }, dark);
  177 |     await page.waitForTimeout(400);
  178 |   }
  179 |
  180 |   for (const [lang, width] of [
  181 |     ['he', 390],
  182 |     ['en', 1280],
  183 |     ['en', 390],
  184 |   ] as const) {
  185 |     test(`/customers (${lang}, ${width}px) has no axe violations`, async ({ page }) => {
  186 |       await openCustomers(page, lang, width);
  187 |       const results = await runAxe(page, `/customers ${lang} ${width}`);
  188 |       expect(results.violations).toHaveLength(0);
  189 |     });
  190 |   }
  191 |
  192 |   test('/customers dark mode has no axe violations', async ({ page }) => {
  193 |     await openCustomers(page, 'he', 1280);
  194 |     await setDark(page, true);
  195 |     const results = await runAxe(page, '/customers dark');
  196 |     expect(results.violations).toHaveLength(0);
  197 |   });
  198 |
  199 |   test('/customers with the columns menu open has no axe violations', async ({ page }) => {
  200 |     await openCustomers(page, 'he', 1280);
  201 |     await page.getByTestId('dm-columns').click();
  202 |     await page.waitForTimeout(200);
  203 |     const results = await runAxe(page, '/customers columns menu');
  204 |     expect(results.violations).toHaveLength(0);
  205 |   });
  206 |
  207 |   test('/customers with the filters drawer open has no axe violations', async ({ page }) => {
  208 |     await openCustomers(page, 'he', 1280);
  209 |     await page.getByTestId('dm-open-filters').click();
  210 |     await page.getByTestId('dm-drawer-apply').waitFor();
  211 |     await page.waitForTimeout(600);
  212 |     const results = await runAxe(page, '/customers filters drawer');
  213 |     expect(results.violations).toHaveLength(0);
  214 |   });
  215 |
  216 |   test('/customers with active filters and no results has no axe violations', async ({ page }) => {
  217 |     await openCustomers(page, 'he', 1280);
  218 |     await page.getByTestId('dm-open-filters').click();
  219 |     await page.getByTestId('dm-filter-customerType').getByRole('button').nth(1).click();
  220 |     await page.getByTestId('dm-drawer-apply').click();
  221 |     await page.getByTestId('dm-search').fill('zzzz-no-match');
  222 |     await expect(page.getByTestId('dm-no-results')).toBeVisible({ timeout: 10_000 });
  223 |     await page.waitForTimeout(400);
  224 |     const results = await runAxe(page, '/customers no results');
  225 |     expect(results.violations).toHaveLength(0);
  226 |   });
  227 | });
  228 |
  229 | // ─── Keyboard navigation — public booking ─────────────────────────────────────
  230 |
  231 | test.describe('Keyboard navigation — public booking', () => {
  232 |   test.setTimeout(60_000);
  233 |
  234 |   test('skip link is the first Tab stop on /b/demo-salon', async ({ page }) => {
  235 |     await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
  236 |     await page.waitForSelector('#main-content', { timeout: 60_000 });
  237 |
  238 |     await page.keyboard.press('Tab');
  239 |
  240 |     const focused = await page.evaluate(() => {
  241 |       const el = document.activeElement as HTMLAnchorElement | null;
  242 |       return { tag: el?.tagName?.toLowerCase(), href: el?.getAttribute('href') ?? '' };
  243 |     });
  244 |
  245 |     expect(focused.tag).toBe('a');
  246 |     expect(focused.href).toContain('#main-content');
  247 |   });
  248 |
  249 |   test('skip link target #main-content exists and is focusable', async ({ page }) => {
  250 |     await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
  251 |     await page.waitForSelector('#main-content', { timeout: 60_000 });
  252 |
  253 |     // The skip link must point to #main-content
  254 |     const skipLink = page.locator('a.skip-link').first();
> 255 |     await expect(skipLink).toHaveAttribute('href', '#main-content');
      |                            ^ Error: Timed out 5000ms waiting for expect(locator).toHaveAttribute(expected)
  256 |
  257 |     // The target must exist in the DOM and carry tabindex="-1" so it
  258 |     // is programmatically focusable even though it is not interactive.
  259 |     const mainContent = page.locator('#main-content').first();
  260 |     await expect(mainContent).toBeAttached();
  261 |     const tabindex = await mainContent.getAttribute('tabindex');
  262 |     expect(tabindex).toBe('-1');
  263 |   });
  264 |
  265 |   test('booking CTA button inside #main-content is keyboard-focusable', async ({ page }) => {
  266 |     await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
  267 |     // Wait until at least one button exists inside the main landmark
  268 |     await page.waitForFunction(
  269 |       () => {
  270 |         const main = document.getElementById('main-content');
  271 |         return !!main && main.querySelectorAll('button:not([disabled])').length > 0;
  272 |       },
  273 |       { timeout: 60_000 },
  274 |     );
  275 |
  276 |     // The hero CTA button ("קביעת תור") must be in the DOM and focusable
  277 |     const ctaBtn = page.locator('#main-content button').filter({ hasText: 'קביעת תור' }).first();
  278 |     await expect(ctaBtn).toBeVisible({ timeout: 10_000 });
  279 |
  280 |     // Programmatically focus the button to confirm it accepts keyboard focus
  281 |     await ctaBtn.focus();
  282 |     const focusedTag = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase() ?? '');
  283 |     expect(focusedTag).toBe('button');
  284 |
  285 |     // The button must not carry tabindex="-1" (which would remove it from tab order)
  286 |     const tabindex = await ctaBtn.getAttribute('tabindex');
  287 |     expect(tabindex).not.toBe('-1');
  288 |   });
  289 |
  290 |   test(':focus-visible outline is visible on the booking CTA button', async ({ page }) => {
  291 |     await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
  292 |     await page.waitForFunction(
  293 |       () => {
  294 |         const main = document.getElementById('main-content');
  295 |         return !!main && main.querySelectorAll('button:not([disabled])').length > 0;
  296 |       },
  297 |       { timeout: 60_000 },
  298 |     );
  299 |
  300 |     const ctaBtn = page.locator('#main-content button').filter({ hasText: 'קביעת תור' }).first();
  301 |     await expect(ctaBtn).toBeVisible({ timeout: 10_000 });
  302 |
  303 |     // Focus via keyboard simulation (Tab sequence) to trigger :focus-visible
  304 |     await ctaBtn.focus();
  305 |
  306 |     const { outlineWidth, outlineStyle } = await page.evaluate(() => {
  307 |       const el = document.activeElement as HTMLElement | null;
  308 |       if (!el) return { outlineWidth: '0px', outlineStyle: 'none' };
  309 |       const s = window.getComputedStyle(el);
  310 |       return { outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle };
  311 |     });
  312 |
  313 |     // A non-zero outline confirms the :focus-visible ring in styles.scss is applied
  314 |     expect(outlineStyle).not.toBe('none');
  315 |     expect(outlineWidth).not.toBe('0px');
  316 |   });
  317 |
  318 |   test('booking/CTA button on /b/demo-salon is reachable via keyboard', async ({ page }) => {
  319 |     await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
  320 |     await page.waitForSelector('#main-content', { timeout: 60_000 });
  321 |
  322 |     // The landing page has at least one "book" / CTA button.
  323 |     // Locate it by role and confirm it is in the DOM and tabbable.
  324 |     const bookBtn = page
  325 |       .getByRole('button', { name: /קביעת תור|הזמנה|הזמן/i })
  326 |       .or(page.getByRole('link', { name: /קביעת תור|הזמנה|הזמן/i }))
  327 |       .first();
  328 |
  329 |     await expect(bookBtn).toBeVisible({ timeout: 10_000 });
  330 |
  331 |     // Confirm it has no tabindex=-1 (i.e. is reachable from keyboard)
  332 |     const tabindex = await bookBtn.getAttribute('tabindex');
  333 |     expect(tabindex).not.toBe('-1');
  334 |   });
  335 | });
  336 |
```