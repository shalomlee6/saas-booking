# Test info

- Name: Accessibility — axe-core scans >> /b/demo-salon (public booking) has no axe violations
- Location: E:\saas-booking\apps\frontend-web\e2e\accessibility.spec.ts:65:7

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 0
Received length: 1
Received array:  [{"description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds", "help": "Elements must meet minimum color contrast ratio thresholds", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/color-contrast?application=playwright", "id": "color-contrast", "impact": "serious", "nodes": [{"all": [], "any": [{"data": {"bgColor": "#f35271", "contrastRatio": 3.35, "expectedContrastRatio": "4.5:1", "fgColor": "#ffffff", "fontSize": "12.8pt (17px)", "fontWeight": "bold", "messageKey": null}, "id": "color-contrast", "impact": "serious", "message": "Element has insufficient color contrast of 3.35 (foreground color: #ffffff, background color: #f35271, font size: 12.8pt (17px), font weight: bold). Expected contrast ratio of 4.5:1", "relatedNodes": [{"html": "<header _ngcontent-ng-c1958490502=\"\" role=\"banner\" class=\"public-nav-topbar\">", "target": ["header"]}]}], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.35 (foreground color: #ffffff, background color: #f35271, font size: 12.8pt (17px), font weight: bold). Expected contrast ratio of 4.5:1", "html": "<span _ngcontent-ng-c1958490502=\"\" class=\"public-nav-topbar-title\">boki</span>", "impact": "serious", "none": [], "target": [".public-nav-topbar-title"]}, {"all": [], "any": [{"data": {"bgColor": "#f35271", "contrastRatio": 3.35, "expectedContrastRatio": "4.5:1", "fgColor": "#ffffff", "fontSize": "11.3pt (15px)", "fontWeight": "normal", "messageKey": null}, "id": "color-contrast", "impact": "serious", "message": "Element has insufficient color contrast of 3.35 (foreground color: #ffffff, background color: #f35271, font size: 11.3pt (15px), font weight: normal). Expected contrast ratio of 4.5:1", "relatedNodes": [{"html": "<button pripple=\"\" class=\"p-ripple p-button p-component pl-hero-intro__cta\" type=\"button\" data-pc-name=\"button\" pc2=\"\" data-pc-section=\"root\" autofocus=\"true\" pc3=\"\" pc4=\"\">", "target": [".pl-hero-intro__cta"]}]}], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.35 (foreground color: #ffffff, background color: #f35271, font size: 11.3pt (15px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<span class=\"p-button-label ng-star-inserted\" aria-hidden=\"false\" data-pc-section=\"label\">קביעת תור</span>", "impact": "serious", "none": [], "target": [".pl-hero-intro__cta > .p-button-label[aria-hidden=\"false\"][data-pc-section=\"label\"]"]}, {"all": [], "any": [{"data": {"bgColor": "#f5f5f7", "contrastRatio": 4.44, "expectedContrastRatio": "4.5:1", "fgColor": "#6b7280", "fontSize": "10.5pt (14px)", "fontWeight": "normal", "messageKey": null}, "id": "color-contrast", "impact": "serious", "message": "Element has insufficient color contrast of 4.44 (foreground color: #6b7280, background color: #f5f5f7, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1", "relatedNodes": [{"html": "<div _ngcontent-ng-c3665309191=\"\" plreveal=\"\" plrevealstagger=\"\" class=\"pl-section pl-section--base ng-star-inserted\">", "target": [".pl-section--base.pl-section[plrevealstagger=\"\"]:nth-child(3)"]}]}], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 4.44 (foreground color: #6b7280, background color: #f5f5f7, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<p _ngcontent-ng-c2302230153=\"\" class=\"pl-gal__empty-line ng-star-inserted\">תמונות בקרוב ✨</p>", "impact": "serious", "none": [], "target": [".pl-gal__empty-line"]}], "tags": ["cat.color", "wcag2aa", "wcag143", "TTv5", "TT13.c", "EN-301-549", "EN-9.1.4.3", "ACT", "RGAAv4", "RGAA-3.2.1"]}]
    at E:\saas-booking\apps\frontend-web\e2e\accessibility.spec.ts:70:32
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
   90 |
   91 |   test('/customers (owner portal) has no axe violations', async ({ page, context }) => {
   92 |     await context.clearCookies();
   93 |     await page.addInitScript(() => {
   94 |       try {
   95 |         localStorage.clear();
   96 |         sessionStorage.removeItem('sb_session_exp_ms');
   97 |       } catch {
   98 |         /* ignore */
   99 |       }
  100 |     });
  101 |
  102 |     await loginAsOwner(page);
  103 |     await page.goto('/customers', { waitUntil: 'domcontentloaded' });
  104 |     await page.waitForSelector('#main-content', { timeout: 30_000 });
  105 |     await page.waitForSelector('.customers-page', { timeout: 30_000 });
  106 |
  107 |     const results = await runAxe(page, '/customers');
  108 |     expect(results.violations).toHaveLength(0);
  109 |   });
  110 |
  111 |   test('/services (owner portal) has no axe violations', async ({ page, context }) => {
  112 |     await context.clearCookies();
  113 |     await page.addInitScript(() => {
  114 |       try {
  115 |         localStorage.clear();
  116 |         sessionStorage.removeItem('sb_session_exp_ms');
  117 |       } catch {
  118 |         /* ignore */
  119 |       }
  120 |     });
  121 |
  122 |     await loginAsOwner(page);
  123 |     await page.goto('/services', { waitUntil: 'domcontentloaded' });
  124 |     await page.waitForSelector('#main-content', { timeout: 30_000 });
  125 |     await page.waitForSelector('.services-page', { timeout: 30_000 });
  126 |     await page.getByTestId('dm-search').waitFor({ timeout: 30_000 });
  127 |
  128 |     const results = await runAxe(page, '/services');
  129 |     expect(results.violations).toHaveLength(0);
  130 |   });
  131 |
  132 |   test('/appointments?view=list (owner portal) has no axe violations', async ({ page, context }) => {
  133 |     await context.clearCookies();
  134 |     await page.addInitScript(() => {
  135 |       try {
  136 |         localStorage.clear();
  137 |         sessionStorage.removeItem('sb_session_exp_ms');
  138 |       } catch {
  139 |         /* ignore */
  140 |       }
  141 |     });
  142 |
  143 |     await loginAsOwner(page);
  144 |     await page.goto('/appointments?view=list', { waitUntil: 'domcontentloaded' });
  145 |     await page.waitForSelector('#main-content', { timeout: 30_000 });
  146 |     await page.waitForSelector('.appointments-list-page', { timeout: 30_000 });
  147 |     await page.getByTestId('dm-search').waitFor({ timeout: 30_000 });
  148 |
  149 |     const results = await runAxe(page, '/appointments?view=list');
  150 |     expect(results.violations).toHaveLength(0);
  151 |   });
  152 | });
  153 |
  154 | // ─── /customers states ────────────────────────────────────────────────────────
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
```