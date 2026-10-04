# Test info

- Name: Accessibility — axe-core scans >> /dashboard (owner portal) has no axe violations
- Location: E:\saas-booking\apps\frontend-web\e2e\accessibility.spec.ts:73:7

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 0
Received length: 1
Received array:  [{"description": "Ensure elements with an ARIA role that require child roles contain them", "help": "Certain ARIA roles must contain particular children", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/aria-required-children?application=playwright", "id": "aria-required-children", "impact": "critical", "nodes": [{"all": [], "any": [{"data": {"messageKey": "unallowed", "values": "button[tabindex]"}, "id": "aria-required-children", "impact": "critical", "message": "Element has children which are not allowed: button[tabindex]", "relatedNodes": [{"html": "<button _ngcontent-ng-c4121073975=\"\" type=\"button\" class=\"dashboard-pill\"> שבוע </button>", "target": [".dashboard-pill:nth-child(1)"]}, {"html": "<button _ngcontent-ng-c4121073975=\"\" type=\"button\" class=\"dashboard-pill dashboard-pill-active\"> חודש </button>", "target": [".dashboard-pill-active"]}, {"html": "<button _ngcontent-ng-c4121073975=\"\" type=\"button\" class=\"dashboard-pill\"> שנה </button>", "target": [".dashboard-pill:nth-child(3)"]}]}], "failureSummary": "Fix any of the following:
  Element has children which are not allowed: button[tabindex]", "html": "<div _ngcontent-ng-c4121073975=\"\" role=\"tablist\" class=\"dashboard-period-filter\" aria-label=\"טווח נתונים\">", "impact": "critical", "none": [], "target": [".dashboard-period-filter"]}], "tags": ["cat.aria", "wcag2a", "wcag131", "EN-301-549", "EN-9.1.3.1", "RGAAv4", "RGAA-9.3.1"]}]
    at E:\saas-booking\apps\frontend-web\e2e\accessibility.spec.ts:88:32
```

# Page snapshot

```yaml
- complementary "תפריט":
  - text: boki
  - button "תפריט" [expanded]: 
  - navigation "תפריט":
    - link "לוח בקרה":
      - /url: /dashboard
    - link "תורים 4":
      - /url: /appointments
    - link "שירותים":
      - /url: /services
    - link "לקוחות":
      - /url: /customers
    - link "עיצוב":
      - /url: /settings/theme
    - link "דף נחיתה":
      - /url: /settings/landing
    - link "שעות פעילות":
      - /url: /settings/working-hours
    - link "תצוגה מקדימה":
      - /url: /preview/customer-site
    - link "חשבון":
      - /url: /settings/account
  - text: owner@example.com
  - button "התנתקות"
- banner:
  - heading "לוח בקרה" [level=1]
  - text: יום ראשון · 4 באוק׳ 2026
  - link "אתר הלקוחות":
    - /url: /b/demo-salon/login
  - link "תורים":
    - /url: /appointments
  - link "הגדרות":
    - /url: /settings/theme
  - link "תור חדש":
    - /url: /appointments/new
- main:
  - heading "ערב טוב ✨" [level=1]
  - paragraph: אין תורים היום.
  - tablist "טווח נתונים":
    - button "שבוע"
    - button "חודש"
    - button "שנה"
  - text: לא ניתן לטעון נתוני דשבורד.
  - button "נסי שוב"
  - text: התורים של היום 0
  - link "לכל התורים":
    - /url: /appointments
  - paragraph: אין תורים היום.
  - text: הכנסות לפי יום
  - paragraph:
    - text: לא ניתן לטעון נתוני גרף.
    - button "נסי שוב"
  - text: לקוחות מובילות
  - link "לכל הלקוחות":
    - /url: /customers
  - paragraph: לא ניתן לטעון לקוחות מובילות.
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
   70 |     expect(results.violations).toHaveLength(0);
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
>  88 |     expect(results.violations).toHaveLength(0);
      |                                ^ Error: expect(received).toHaveLength(expected)
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
  131 | });
  132 |
  133 | // ─── /customers states ────────────────────────────────────────────────────────
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
```