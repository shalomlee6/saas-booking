# Test info

- Name: Accessibility — axe-core scans >> /b/demo-salon (public booking) has no axe violations
- Location: E:\saas-booking\apps\frontend-web\e2e\accessibility.spec.ts:65:7

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 0
Received length: 1
Received array:  [{"description": "Ensure that the page, or at least one of its frames contains a level-one heading", "help": "Page should contain a level-one heading", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/page-has-heading-one?application=playwright", "id": "page-has-heading-one", "impact": "moderate", "nodes": [{"all": [{"data": null, "id": "page-has-heading-one", "impact": "moderate", "message": "Page must have a level-one heading", "relatedNodes": []}], "any": [], "failureSummary": "Fix all of the following:
  Page must have a level-one heading", "html": "<html lang=\"he\">", "impact": "moderate", "none": [], "target": ["html"]}], "tags": ["cat.semantics", "best-practice"]}]
    at E:\saas-booking\apps\frontend-web\e2e\accessibility.spec.ts:70:32
```

# Page snapshot

```yaml
- link "דלג לתוכן הראשי":
  - /url: "#main-content"
- main:
  - heading "CHEN BEAUTY" [level=1]
  - paragraph: יופי מקצועי, תוצאות מושלמות
  - button " קביעת תור"
  - heading "שלום, ברוכות הבאות" [level=2]
  - paragraph: בואי נקבע תור בקלות ובמהירות
  - region "התור הקרוב שלך":
    - heading "התור הקרוב שלך" [level=2]
    - paragraph: אין לך תור קרוב
    - paragraph: קבעי עכשיו טיפול מפנק!
    - button " קביעת תור"
  - region "השירותים שלנו":
    - heading "השירותים שלנו" [level=2]
    - list:
      - listitem:
        - heading "מניקור" [level=3]
        - paragraph: 30 דקות
        - paragraph: ₪50
        - button " הזמיני"
      - listitem:
        - heading "פדיקור" [level=3]
        - paragraph: 45 דקות
        - paragraph: ₪70
        - button " הזמיני"
      - listitem:
        - heading "ציפורניים" [level=3]
        - paragraph: 60 דקות
        - paragraph: ₪90
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
        - paragraph: ₪180
  - region "מה הלקוחות אומרות":
    - heading "מה הלקוחות אומרות" [level=2]
    - list:
      - listitem:
        - paragraph: "\"שירות מקסים ומקצועי, חזרתי שוב!\""
        - paragraph: מיכל·
  - region "קביעת תור":
    - heading "מוכנה לטיפול הבא שלך?" [level=2]
    - paragraph: קביעת תור פשוטה, מהירה ובלחיצה אחת
    - button " קביעי תור עכשיו"
    - 'link "התקשרי: 050-1234567"':
      - /url: tel:0501234567
```

# Test source

```ts
   1 | /**
   2 |  * Accessibility E2E suite — axe-core scans + keyboard navigation.
   3 |  *
   4 |  * Runs against the mock Angular server (--configuration=mock) so no real
   5 |  * backend is required.  All violations are printed verbatim to the console;
   6 |  * none are suppressed.
   7 |  */
   8 | import { test, expect } from '@playwright/test';
   9 | import AxeBuilder from '@axe-core/playwright';
   10 |
   11 | // ─── Helpers ──────────────────────────────────────────────────────────────────
   12 |
   13 | /** Login as the mock owner and wait for /dashboard. */
   14 | async function loginAsOwner(page: import('@playwright/test').Page): Promise<void> {
   15 |   await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
   16 |   await page.waitForSelector('[data-testid="login-email"]', { timeout: 60_000 });
   17 |   await page.getByTestId('login-email').fill('owner@example.com');
   18 |   await page.getByTestId('login-password').fill('password12345');
   19 |   await page.locator('button.login-form-submit').click();
   20 |   await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
   21 | }
   22 |
   23 | /** Run an axe scan and log any violations — does NOT suppress them. */
   24 | async function runAxe(page: import('@playwright/test').Page, routeLabel: string) {
   25 |   const results = await new AxeBuilder({ page }).analyze();
   26 |
   27 |   if (results.violations.length > 0) {
   28 |     console.log(`\n── Axe violations on ${routeLabel} (${results.violations.length}) ──`);
   29 |     for (const v of results.violations) {
   30 |       console.log(`  [${v.impact ?? 'unknown'}] ${v.id}: ${v.description}`);
   31 |       for (const n of v.nodes.slice(0, 3)) {
   32 |         console.log(`    HTML: ${n.html}`);
   33 |         if (n.failureSummary) console.log(`    Why: ${n.failureSummary}`);
   34 |       }
   35 |     }
   36 |     console.log('────────────────────────────────────────────────');
   37 |   }
   38 |
   39 |   return results;
   40 | }
   41 |
   42 | // ─── axe scans ────────────────────────────────────────────────────────────────
   43 |
   44 | test.describe('Accessibility — axe-core scans', () => {
   45 |   // No serial mode — every route is scanned independently so a failure on
   46 |   // one route does not prevent the others from reporting their violations.
   47 |   test.setTimeout(120_000);
   48 |
   49 |   test('/auth/login has no axe violations', async ({ page }) => {
   50 |     await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
   51 |     await page.waitForSelector('[data-testid="login-email"]', { timeout: 60_000 });
   52 |
   53 |     const results = await runAxe(page, '/auth/login');
   54 |     expect(results.violations).toHaveLength(0);
   55 |   });
   56 |
   57 |   test('/auth/register has no axe violations', async ({ page }) => {
   58 |     await page.goto('/auth/register', { waitUntil: 'domcontentloaded' });
   59 |     await page.waitForSelector('form', { timeout: 60_000 });
   60 |
   61 |     const results = await runAxe(page, '/auth/register');
   62 |     expect(results.violations).toHaveLength(0);
   63 |   });
   64 |
   65 |   test('/b/demo-salon (public booking) has no axe violations', async ({ page }) => {
   66 |     await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
   67 |     await page.waitForSelector('#main-content', { timeout: 60_000 });
   68 |
   69 |     const results = await runAxe(page, '/b/demo-salon');
>  70 |     expect(results.violations).toHaveLength(0);
      |                                ^ Error: expect(received).toHaveLength(expected)
   71 |   });
   72 |
   73 |   test('/dashboard (owner portal) has no axe violations', async ({ page, context }) => {
   74 |     await context.clearCookies();
   75 |     await page.addInitScript(() => {
   76 |       try {
   77 |         localStorage.clear();
   78 |         sessionStorage.removeItem('sb_session_exp_ms');
   79 |       } catch {
   80 |         /* ignore */
   81 |       }
   82 |     });
   83 |
   84 |     await loginAsOwner(page);
   85 |     await page.waitForSelector('#main-content', { timeout: 30_000 });
   86 |
   87 |     const results = await runAxe(page, '/dashboard');
   88 |     expect(results.violations).toHaveLength(0);
   89 |   });
   90 | });
   91 |
   92 | // ─── Keyboard navigation — public booking ─────────────────────────────────────
   93 |
   94 | test.describe('Keyboard navigation — public booking', () => {
   95 |   test.setTimeout(60_000);
   96 |
   97 |   test('skip link is the first Tab stop on /b/demo-salon', async ({ page }) => {
   98 |     await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
   99 |     await page.waitForSelector('#main-content', { timeout: 60_000 });
  100 |
  101 |     await page.keyboard.press('Tab');
  102 |
  103 |     const focused = await page.evaluate(() => {
  104 |       const el = document.activeElement as HTMLAnchorElement | null;
  105 |       return { tag: el?.tagName?.toLowerCase(), href: el?.getAttribute('href') ?? '' };
  106 |     });
  107 |
  108 |     expect(focused.tag).toBe('a');
  109 |     expect(focused.href).toContain('#main-content');
  110 |   });
  111 |
  112 |   test('skip link target #main-content exists and is focusable', async ({ page }) => {
  113 |     await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
  114 |     await page.waitForSelector('#main-content', { timeout: 60_000 });
  115 |
  116 |     // The skip link must point to #main-content
  117 |     const skipLink = page.locator('a.skip-link').first();
  118 |     await expect(skipLink).toHaveAttribute('href', '#main-content');
  119 |
  120 |     // The target must exist in the DOM and carry tabindex="-1" so it
  121 |     // is programmatically focusable even though it is not interactive.
  122 |     const mainContent = page.locator('#main-content').first();
  123 |     await expect(mainContent).toBeAttached();
  124 |     const tabindex = await mainContent.getAttribute('tabindex');
  125 |     expect(tabindex).toBe('-1');
  126 |   });
  127 |
  128 |   test('booking CTA button inside #main-content is keyboard-focusable', async ({ page }) => {
  129 |     await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
  130 |     // Wait until at least one button exists inside the main landmark
  131 |     await page.waitForFunction(
  132 |       () => {
  133 |         const main = document.getElementById('main-content');
  134 |         return !!main && main.querySelectorAll('button:not([disabled])').length > 0;
  135 |       },
  136 |       { timeout: 60_000 },
  137 |     );
  138 |
  139 |     // The hero CTA button ("קביעת תור") must be in the DOM and focusable
  140 |     const ctaBtn = page.locator('#main-content button').filter({ hasText: 'קביעת תור' }).first();
  141 |     await expect(ctaBtn).toBeVisible({ timeout: 10_000 });
  142 |
  143 |     // Programmatically focus the button to confirm it accepts keyboard focus
  144 |     await ctaBtn.focus();
  145 |     const focusedTag = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase() ?? '');
  146 |     expect(focusedTag).toBe('button');
  147 |
  148 |     // The button must not carry tabindex="-1" (which would remove it from tab order)
  149 |     const tabindex = await ctaBtn.getAttribute('tabindex');
  150 |     expect(tabindex).not.toBe('-1');
  151 |   });
  152 |
  153 |   test(':focus-visible outline is visible on the booking CTA button', async ({ page }) => {
  154 |     await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
  155 |     await page.waitForFunction(
  156 |       () => {
  157 |         const main = document.getElementById('main-content');
  158 |         return !!main && main.querySelectorAll('button:not([disabled])').length > 0;
  159 |       },
  160 |       { timeout: 60_000 },
  161 |     );
  162 |
  163 |     const ctaBtn = page.locator('#main-content button').filter({ hasText: 'קביעת תור' }).first();
  164 |     await expect(ctaBtn).toBeVisible({ timeout: 10_000 });
  165 |
  166 |     // Focus via keyboard simulation (Tab sequence) to trigger :focus-visible
  167 |     await ctaBtn.focus();
  168 |
  169 |     const { outlineWidth, outlineStyle } = await page.evaluate(() => {
  170 |       const el = document.activeElement as HTMLElement | null;
```