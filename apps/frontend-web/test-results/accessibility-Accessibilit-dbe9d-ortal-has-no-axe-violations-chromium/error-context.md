# Test info

- Name: Accessibility — axe-core scans >> /dashboard (owner portal) has no axe violations
- Location: E:\saas-booking\apps\frontend-web\e2e\accessibility.spec.ts:73:7

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 0
Received length: 5
Received array:  [{"description": "Ensure ARIA attributes are not prohibited for an element's role", "help": "Elements must only use permitted ARIA attributes", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/aria-prohibited-attr?application=playwright", "id": "aria-prohibited-attr", "impact": "serious", "nodes": [{"all": [], "any": [], "failureSummary": "Fix all of the following:
  aria-label attribute cannot be used on a p-button with no valid role attribute.", "html": "<p-button _ngcontent-ng-c516763754=\"\" severity=\"secondary\" styleclass=\"layout-topbar-menu-btn\" aria-label=\"Collapse sidebar\" aria-controls=\"layout-sidebar-nav\" pc3=\"\" data-pc-section=\"host\">", "impact": "serious", "none": [[Object]], "target": ["p-button"]}], "tags": ["cat.aria", "wcag2a", "wcag412", "EN-301-549", "EN-9.4.1.2", "RGAAv4", "RGAA-7.1.1"]}, {"description": "Ensure all ARIA attributes have valid values", "help": "ARIA attributes must conform to valid values", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/aria-valid-attr-value?application=playwright", "id": "aria-valid-attr-value", "impact": "critical", "nodes": [{"all": [[Object]], "any": [], "failureSummary": "Fix all of the following:
  Invalid ARIA attribute value: aria-controls=\"layout-sidebar-nav\"", "html": "<p-button _ngcontent-ng-c516763754=\"\" severity=\"secondary\" styleclass=\"layout-topbar-menu-btn\" aria-label=\"Collapse sidebar\" aria-controls=\"layout-sidebar-nav\" pc3=\"\" data-pc-section=\"host\">", "impact": "critical", "none": [], "target": ["p-button"]}], "tags": ["cat.aria", "wcag2a", "wcag412", "EN-301-549", "EN-9.4.1.2", "RGAAv4", "RGAA-7.1.1"]}, {"description": "Ensure buttons have discernible text", "help": "Buttons must have discernible text", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/button-name?application=playwright", "id": "button-name", "impact": "critical", "nodes": [{"all": [], "any": [[Object], [Object], [Object], [Object], [Object], [Object], [Object]], "failureSummary": "Fix any of the following:
  Element does not have inner text that is visible to screen readers
  aria-label attribute does not exist or is empty
  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty
  Element has no title attribute
  Element does not have an implicit (wrapped) <label>
  Element does not have an explicit <label>
  Element's default semantics were not overridden with role=\"none\" or role=\"presentation\"", "html": "<button pripple=\"\" class=\"p-ripple layout-topbar-menu-btn p-button p-button-icon-only p-button-secondary p-button-text p-component\" type=\"button\" data-pc-name=\"button\" pc3=\"\" data-pc-section=\"root\" autofocus=\"true\" pc4=\"\" pc5=\"\">", "impact": "critical", "none": [], "target": [".p-ripple"]}], "tags": ["cat.name-role-value", "wcag2a", "wcag412", "section508", "section508.22.a", "TTv5", "TT6.a", "EN-301-549", "EN-9.4.1.2", "ACT", …]}, {"description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds", "help": "Elements must meet minimum color contrast ratio thresholds", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/color-contrast?application=playwright", "id": "color-contrast", "impact": "serious", "nodes": [{"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 2.53 (foreground color: #9ca3af, background color: #ffffff, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<span _ngcontent-ng-c516763754=\"\" aria-hidden=\"true\" class=\"layout-sidebar-section-label\">תפריט</span>", "impact": "serious", "none": [], "target": [".layout-sidebar-section-label[aria-hidden=\"true\"]:nth-child(1)"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.47 (foreground color: #e8446a, background color: #fff0f3, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<span _ngcontent-ng-c516763754=\"\" class=\"layout-sidebar-link-text\">Dashboard</span>", "impact": "serious", "none": [], "target": [".layout-sidebar-link-active > .layout-sidebar-link-text"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 2.53 (foreground color: #9ca3af, background color: #ffffff, font size: 8.3pt (11px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<span _ngcontent-ng-c516763754=\"\" aria-hidden=\"true\" class=\"layout-sidebar-section-label ng-star-inserted\">הגדרות</span>", "impact": "serious", "none": [], "target": [".layout-sidebar-section-label[aria-hidden=\"true\"]:nth-child(6)"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 4.44 (foreground color: #6b7280, background color: #f5f5f7, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<div _ngcontent-ng-c198607768=\"\" class=\"dashboard-empty ng-star-inserted\"> לא ניתן לטעון נתוני דשבורד. <button _ngcontent-ng-c198607768=\"\" type=\"button\" class=\"dashboard-link\">נסי שוב</button></div>", "impact": "serious", "none": [], "target": [".dashboard-stats > .dashboard-empty"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.37 (foreground color: #e8446a, background color: #f0f0f0, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<button _ngcontent-ng-c198607768=\"\" type=\"button\" class=\"dashboard-link\">נסי שוב</button>", "impact": "serious", "none": [], "target": [".dashboard-stats > .dashboard-empty > .dashboard-link"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.84 (foreground color: #ffffff, background color: #e8446a, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<button _ngcontent-ng-c198607768=\"\" type=\"button\" class=\"dashboard-pill dashboard-pill-active\"> חודש </button>", "impact": "serious", "none": [], "target": [".dashboard-pill-active"]}, {"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.37 (foreground color: #e8446a, background color: #f0f0f0, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<button _ngcontent-ng-c198607768=\"\" type=\"button\" class=\"dashboard-link\">נסי שוב</button>", "impact": "serious", "none": [], "target": ["p > .dashboard-link"]}], "tags": ["cat.color", "wcag2aa", "wcag143", "TTv5", "TT13.c", "EN-301-549", "EN-9.1.4.3", "ACT", "RGAAv4", "RGAA-3.2.1"]}, {"description": "Ensure all page content is contained by landmarks", "help": "All page content should be contained by landmarks", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/region?application=playwright", "id": "region", "impact": "moderate", "nodes": [{"all": [], "any": [[Object]], "failureSummary": "Fix any of the following:
  Some page content is not contained by landmarks", "html": "<span _ngcontent-ng-c516763754=\"\" class=\"layout-sidebar-logo-text\">SaaS Booking</span>", "impact": "moderate", "none": [], "target": [".layout-sidebar-logo-text"]}], "tags": ["cat.keyboard", "best-practice", "RGAAv4", "RGAA-9.2.1"]}]
    at E:\saas-booking\apps\frontend-web\e2e\accessibility.spec.ts:88:32
```

# Page snapshot

```yaml
- link "דלג לתוכן הראשי":
  - /url: "#main-content"
- text: SaaS Booking
- complementary "ניווט ראשי":
  - navigation "תפריט":
    - link "Dashboard":
      - /url: /dashboard
    - link "Appointments":
      - /url: /appointments
    - link "Services":
      - /url: /services
    - link "Customers":
      - /url: /customers
    - link "Theme":
      - /url: /settings/theme
    - link "דף נחיתה":
      - /url: /settings/landing
    - link "Working hours":
      - /url: /settings/working-hours
    - link "Preview site":
      - /url: /preview/customer-site
- button "Logout"
- banner:
  - button ""
  - heading "Dashboard" [level=1]
  - link "Open customer site in new tab":
    - /url: /b/demo-salon/login
    - text: Customer site
  - text: Demo Salon owner@example.com
- main:
  - heading "לוח בקרה" [level=1]
  - text: לא ניתן לטעון נתוני דשבורד.
  - button "נסי שוב"
  - button "שבוע"
  - button "חודש"
  - button "שנה"
  - heading "הכנסות לפי יום בשבוע" [level=2]
  - paragraph: טוען…
  - heading "הכנסות לפי שירות" [level=2]
  - paragraph: טוען…
  - heading "לקוחות מובילים" [level=2]
  - paragraph:
    - text: לא ניתן לטעון לקוחות מובילים.
    - button "נסי שוב"
  - heading "תורים (עדכון אוטומטי)" [level=2]
  - table:
    - rowgroup:
      - row "שעה לקוח שירות סטטוס":
        - cell "שעה"
        - cell "לקוח"
        - cell "שירות"
        - cell "סטטוס"
    - rowgroup:
      - row "12:00 – 13:30 confirmed":
        - cell "12:00 – 13:30"
        - cell
        - cell
        - cell "confirmed"
      - row "15:00 – 15:50 pending":
        - cell "15:00 – 15:50"
        - cell
        - cell
        - cell "pending"
      - row "10:00 – 10:30 confirmed":
        - cell "10:00 – 10:30"
        - cell
        - cell
        - cell "confirmed"
      - row "13:00 – 15:00 confirmed":
        - cell "13:00 – 15:00"
        - cell
        - cell
        - cell "confirmed"
      - row "11:30 – 12:15 confirmed":
        - cell "11:30 – 12:15"
        - cell
        - cell
        - cell "confirmed"
      - row "12:00 – 12:30 confirmed":
        - cell "12:00 – 12:30"
        - cell
        - cell
        - cell "confirmed"
      - row "13:00 – 13:50 pending":
        - cell "13:00 – 13:50"
        - cell
        - cell
        - cell "pending"
      - row "15:00 – 16:30 confirmed":
        - cell "15:00 – 16:30"
        - cell
        - cell
        - cell "confirmed"
      - row "11:00 – 11:45 confirmed":
        - cell "11:00 – 11:45"
        - cell
        - cell
        - cell "confirmed"
      - row "17:00 – 17:45 confirmed":
        - cell "17:00 – 17:45"
        - cell
        - cell
        - cell "confirmed"
  - link "לכל התורים":
    - /url: /appointments
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
  171 |       if (!el) return { outlineWidth: '0px', outlineStyle: 'none' };
  172 |       const s = window.getComputedStyle(el);
  173 |       return { outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle };
  174 |     });
  175 |
  176 |     // A non-zero outline confirms the :focus-visible ring in styles.scss is applied
  177 |     expect(outlineStyle).not.toBe('none');
  178 |     expect(outlineWidth).not.toBe('0px');
  179 |   });
  180 |
  181 |   test('booking/CTA button on /b/demo-salon is reachable via keyboard', async ({ page }) => {
  182 |     await page.goto('/b/demo-salon', { waitUntil: 'domcontentloaded' });
  183 |     await page.waitForSelector('#main-content', { timeout: 60_000 });
  184 |
  185 |     // The landing page has at least one "book" / CTA button.
  186 |     // Locate it by role and confirm it is in the DOM and tabbable.
  187 |     const bookBtn = page
  188 |       .getByRole('button', { name: /קביעת תור|הזמנה|הזמן/i })
```