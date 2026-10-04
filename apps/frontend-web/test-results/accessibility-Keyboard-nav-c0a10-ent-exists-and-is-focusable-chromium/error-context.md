# Test info

- Name: Keyboard navigation — public booking >> skip link target #main-content exists and is focusable
- Location: E:\saas-booking\apps\frontend-web\e2e\accessibility.spec.ts:228:7

# Error details

```
Error: Timed out 5000ms waiting for expect(locator).toHaveAttribute(expected)

Locator: locator('a.skip-link').first()
Expected string: "#main-content"
Received: <element(s) not found>
Call log:
  - expect.toHaveAttribute with timeout 5000ms
  - waiting for locator('a.skip-link').first()

    at E:\saas-booking\apps\frontend-web\e2e\accessibility.spec.ts:234:28
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
  134 |
  135 | test.describe('Accessibility — /customers states', () => {
  136 |   test.setTimeout(180_000);
  137 |
  138 |   async function openCustomers(page: import('@playwright/test').Page, lang: 'he' | 'en', width: number) {
  139 |     await page.context().clearCookies();
  140 |     await loginAsOwner(page);
  141 |     await page.evaluate((value) => localStorage.setItem('sb_lang', value), lang);
  142 |     await page.setViewportSize({ width, height: width >= 640 ? 800 : 844 });
  143 |     await page.goto('/customers', { waitUntil: 'domcontentloaded' });
  144 |     await page.getByTestId('dm-search').waitFor({ timeout: 30_000 });
  145 |     await expect(
  146 |       width >= 640 ? page.locator('tbody tr').first() : page.locator('.data-table-card').first()
  147 |     ).toBeVisible({ timeout: 30_000 });
  148 |     await page.waitForTimeout(400);
  149 |   }
  150 |
  151 |   async function setDark(page: import('@playwright/test').Page, dark: boolean) {
  152 |     await page.evaluate((isDark) => {
  153 |       document.documentElement.classList.toggle('theme-dark', isDark);
  154 |       document.querySelector('.layout')?.classList.toggle('theme-dark', isDark);
  155 |     }, dark);
  156 |     await page.waitForTimeout(400);
  157 |   }
  158 |
  159 |   for (const [lang, width] of [
  160 |     ['he', 390],
  161 |     ['en', 1280],
  162 |     ['en', 390],
  163 |   ] as const) {
  164 |     test(`/customers (${lang}, ${width}px) has no axe violations`, async ({ page }) => {
  165 |       await openCustomers(page, lang, width);
  166 |       const results = await runAxe(page, `/customers ${lang} ${width}`);
  167 |       expect(results.violations).toHaveLength(0);
  168 |     });
  169 |   }
  170 |
  171 |   test('/customers dark mode has no axe violations', async ({ page }) => {
  172 |     await openCustomers(page, 'he', 1280);
  173 |     await setDark(page, true);
  174 |     const results = await runAxe(page, '/customers dark');
  175 |     expect(results.violations).toHaveLength(0);
  176 |   });
  177 |
  178 |   test('/customers with the columns menu open has no axe violations', async ({ page }) => {
  179 |     await openCustomers(page, 'he', 1280);
  180 |     await page.getByTestId('dm-columns').click();
  181 |     await page.waitForTimeout(200);
  182 |     const results = await runAxe(page, '/customers columns menu');
  183 |     expect(results.violations).toHaveLength(0);
  184 |   });
  185 |
  186 |   test('/customers with the filters drawer open has no axe violations', async ({ page }) => {
  187 |     await openCustomers(page, 'he', 1280);
  188 |     await page.getByTestId('dm-open-filters').click();
  189 |     await page.getByTestId('dm-drawer-apply').waitFor();
  190 |     await page.waitForTimeout(600);
  191 |     const results = await runAxe(page, '/customers filters drawer');
  192 |     expect(results.violations).toHaveLength(0);
  193 |   });
  194 |
  195 |   test('/customers with active filters and no results has no axe violations', async ({ page }) => {
  196 |     await openCustomers(page, 'he', 1280);
  197 |     await page.getByTestId('dm-open-filters').click();
  198 |     await page.getByTestId('dm-filter-customerType').getByRole('button').nth(1).click();
  199 |     await page.getByTestId('dm-drawer-apply').click();
  200 |     await page.getByTestId('dm-search').fill('zzzz-no-match');
  201 |     await expect(page.getByTestId('dm-no-results')).toBeVisible({ timeout: 10_000 });
  202 |     await page.waitForTimeout(400);
  203 |     const results = await runAxe(page, '/customers no results');
  204 |     expect(results.violations).toHaveLength(0);
  205 |   });
  206 | });
  207 |
  208 | // ─── Keyboard navigation — public booking ─────────────────────────────────────
  209 |
  210 | test.describe('Keyboard navigation — public booking', () => {
  211 |   test.setTimeout(60_000);
  212 |
  213 |   test('skip link is the first Tab stop on /b/demo-salon', async ({ page }) => {
  214 |     await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
  215 |     await page.waitForSelector('#main-content', { timeout: 60_000 });
  216 |
  217 |     await page.keyboard.press('Tab');
  218 |
  219 |     const focused = await page.evaluate(() => {
  220 |       const el = document.activeElement as HTMLAnchorElement | null;
  221 |       return { tag: el?.tagName?.toLowerCase(), href: el?.getAttribute('href') ?? '' };
  222 |     });
  223 |
  224 |     expect(focused.tag).toBe('a');
  225 |     expect(focused.href).toContain('#main-content');
  226 |   });
  227 |
  228 |   test('skip link target #main-content exists and is focusable', async ({ page }) => {
  229 |     await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
  230 |     await page.waitForSelector('#main-content', { timeout: 60_000 });
  231 |
  232 |     // The skip link must point to #main-content
  233 |     const skipLink = page.locator('a.skip-link').first();
> 234 |     await expect(skipLink).toHaveAttribute('href', '#main-content');
      |                            ^ Error: Timed out 5000ms waiting for expect(locator).toHaveAttribute(expected)
  235 |
  236 |     // The target must exist in the DOM and carry tabindex="-1" so it
  237 |     // is programmatically focusable even though it is not interactive.
  238 |     const mainContent = page.locator('#main-content').first();
  239 |     await expect(mainContent).toBeAttached();
  240 |     const tabindex = await mainContent.getAttribute('tabindex');
  241 |     expect(tabindex).toBe('-1');
  242 |   });
  243 |
  244 |   test('booking CTA button inside #main-content is keyboard-focusable', async ({ page }) => {
  245 |     await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
  246 |     // Wait until at least one button exists inside the main landmark
  247 |     await page.waitForFunction(
  248 |       () => {
  249 |         const main = document.getElementById('main-content');
  250 |         return !!main && main.querySelectorAll('button:not([disabled])').length > 0;
  251 |       },
  252 |       { timeout: 60_000 },
  253 |     );
  254 |
  255 |     // The hero CTA button ("קביעת תור") must be in the DOM and focusable
  256 |     const ctaBtn = page.locator('#main-content button').filter({ hasText: 'קביעת תור' }).first();
  257 |     await expect(ctaBtn).toBeVisible({ timeout: 10_000 });
  258 |
  259 |     // Programmatically focus the button to confirm it accepts keyboard focus
  260 |     await ctaBtn.focus();
  261 |     const focusedTag = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase() ?? '');
  262 |     expect(focusedTag).toBe('button');
  263 |
  264 |     // The button must not carry tabindex="-1" (which would remove it from tab order)
  265 |     const tabindex = await ctaBtn.getAttribute('tabindex');
  266 |     expect(tabindex).not.toBe('-1');
  267 |   });
  268 |
  269 |   test(':focus-visible outline is visible on the booking CTA button', async ({ page }) => {
  270 |     await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
  271 |     await page.waitForFunction(
  272 |       () => {
  273 |         const main = document.getElementById('main-content');
  274 |         return !!main && main.querySelectorAll('button:not([disabled])').length > 0;
  275 |       },
  276 |       { timeout: 60_000 },
  277 |     );
  278 |
  279 |     const ctaBtn = page.locator('#main-content button').filter({ hasText: 'קביעת תור' }).first();
  280 |     await expect(ctaBtn).toBeVisible({ timeout: 10_000 });
  281 |
  282 |     // Focus via keyboard simulation (Tab sequence) to trigger :focus-visible
  283 |     await ctaBtn.focus();
  284 |
  285 |     const { outlineWidth, outlineStyle } = await page.evaluate(() => {
  286 |       const el = document.activeElement as HTMLElement | null;
  287 |       if (!el) return { outlineWidth: '0px', outlineStyle: 'none' };
  288 |       const s = window.getComputedStyle(el);
  289 |       return { outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle };
  290 |     });
  291 |
  292 |     // A non-zero outline confirms the :focus-visible ring in styles.scss is applied
  293 |     expect(outlineStyle).not.toBe('none');
  294 |     expect(outlineWidth).not.toBe('0px');
  295 |   });
  296 |
  297 |   test('booking/CTA button on /b/demo-salon is reachable via keyboard', async ({ page }) => {
  298 |     await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
  299 |     await page.waitForSelector('#main-content', { timeout: 60_000 });
  300 |
  301 |     // The landing page has at least one "book" / CTA button.
  302 |     // Locate it by role and confirm it is in the DOM and tabbable.
  303 |     const bookBtn = page
  304 |       .getByRole('button', { name: /קביעת תור|הזמנה|הזמן/i })
  305 |       .or(page.getByRole('link', { name: /קביעת תור|הזמנה|הזמן/i }))
  306 |       .first();
  307 |
  308 |     await expect(bookBtn).toBeVisible({ timeout: 10_000 });
  309 |
  310 |     // Confirm it has no tabindex=-1 (i.e. is reachable from keyboard)
  311 |     const tabindex = await bookBtn.getAttribute('tabindex');
  312 |     expect(tabindex).not.toBe('-1');
  313 |   });
  314 | });
  315 |
```