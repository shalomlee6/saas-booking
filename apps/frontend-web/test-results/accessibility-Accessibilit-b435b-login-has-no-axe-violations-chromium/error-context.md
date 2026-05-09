# Test info

- Name: Accessibility — axe-core scans >> /auth/login has no axe violations
- Location: E:\saas-booking\apps\frontend-web\e2e\accessibility.spec.ts:49:7

# Error details

```
Error: expect(received).toHaveLength(expected)

Expected length: 0
Received length: 4
Received array:  [{"description": "Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds", "help": "Elements must meet minimum color contrast ratio thresholds", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/color-contrast?application=playwright", "id": "color-contrast", "impact": "serious", "nodes": [{"all": [], "any": [{"data": {"bgColor": "#ffffff", "contrastRatio": 3.84, "expectedContrastRatio": "4.5:1", "fgColor": "#e8446a", "fontSize": "10.5pt (14px)", "fontWeight": "normal", "messageKey": null}, "id": "color-contrast", "impact": "serious", "message": "Element has insufficient color contrast of 3.84 (foreground color: #e8446a, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1", "relatedNodes": [{"html": "<div _ngcontent-ng-c179002441=\"\" class=\"login-card\">", "target": [".login-card"]}]}], "failureSummary": "Fix any of the following:
  Element has insufficient color contrast of 3.84 (foreground color: #e8446a, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1", "html": "<a _ngcontent-ng-c179002441=\"\" routerlink=\"/auth/register\" class=\"login-form-register-link\" href=\"/auth/register\">Create one</a>", "impact": "serious", "none": [], "target": [".login-form-register-link"]}], "tags": ["cat.color", "wcag2aa", "wcag143", "TTv5", "TT13.c", "EN-301-549", "EN-9.1.4.3", "ACT", "RGAAv4", "RGAA-3.2.1"]}, {"description": "Ensure the document has a main landmark", "help": "Document should have one main landmark", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/landmark-one-main?application=playwright", "id": "landmark-one-main", "impact": "moderate", "nodes": [{"all": [{"data": null, "id": "page-has-main", "impact": "moderate", "message": "Document does not have a main landmark", "relatedNodes": []}], "any": [], "failureSummary": "Fix all of the following:
  Document does not have a main landmark", "html": "<html lang=\"en\">", "impact": "moderate", "none": [], "target": ["html"]}], "tags": ["cat.semantics", "best-practice"]}, {"description": "Ensure all page content is contained by landmarks", "help": "All page content should be contained by landmarks", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/region?application=playwright", "id": "region", "impact": "moderate", "nodes": [{"all": [], "any": [{"data": {"isIframe": false}, "id": "region", "impact": "moderate", "message": "Some page content is not contained by landmarks", "relatedNodes": []}], "failureSummary": "Fix any of the following:
  Some page content is not contained by landmarks", "html": "<a href=\"#main-content\" class=\"skip-link\">דלג לתוכן הראשי</a>", "impact": "moderate", "none": [], "target": [".skip-link"]}, {"all": [], "any": [{"data": {"isIframe": false}, "id": "region", "impact": "moderate", "message": "Some page content is not contained by landmarks", "relatedNodes": []}], "failureSummary": "Fix any of the following:
  Some page content is not contained by landmarks", "html": "<div _ngcontent-ng-c179002441=\"\" class=\"login-form-field\">", "impact": "moderate", "none": [], "target": [".login-form-field:nth-child(1)"]}, {"all": [], "any": [{"data": {"isIframe": false}, "id": "region", "impact": "moderate", "message": "Some page content is not contained by landmarks", "relatedNodes": []}], "failureSummary": "Fix any of the following:
  Some page content is not contained by landmarks", "html": "<div _ngcontent-ng-c179002441=\"\" class=\"login-form-field\">", "impact": "moderate", "none": [], "target": [".login-form-field:nth-child(2)"]}, {"all": [], "any": [{"data": {"isIframe": false}, "id": "region", "impact": "moderate", "message": "Some page content is not contained by landmarks", "relatedNodes": []}], "failureSummary": "Fix any of the following:
  Some page content is not contained by landmarks", "html": "<p _ngcontent-ng-c179002441=\"\" class=\"login-form-register-hint\"> No account? <a _ngcontent-ng-c179002441=\"\" routerlink=\"/auth/register\" class=\"login-form-register-link\" href=\"/auth/register\">Create one</a></p>", "impact": "moderate", "none": [], "target": [".login-form-register-hint"]}], "tags": ["cat.keyboard", "best-practice", "RGAAv4", "RGAA-9.2.1"]}, {"description": "Ensure all skip links have a focusable target", "help": "The skip-link target should exist and be focusable", "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/skip-link?application=playwright", "id": "skip-link", "impact": "moderate", "nodes": [{"all": [], "any": [{"data": null, "id": "skip-link", "impact": "moderate", "message": "No skip link target", "relatedNodes": []}], "failureSummary": "Fix any of the following:
  No skip link target", "html": "<a href=\"#main-content\" class=\"skip-link\">דלג לתוכן הראשי</a>", "impact": "moderate", "none": [], "target": [".skip-link"]}], "tags": ["cat.keyboard", "best-practice", "RGAAv4", "RGAA-12.7.1"]}]
    at E:\saas-booking\apps\frontend-web\e2e\accessibility.spec.ts:54:32
```

# Page snapshot

```yaml
- link "דלג לתוכן הראשי":
  - /url: "#main-content"
- banner:
  - heading "Welcome back" [level=1]
  - paragraph: Sign in to your account
- text: Email
- textbox "Email"
- text: Password
- textbox "Password"
- button "Login" [disabled]
- button "Forgot password — not available yet" [disabled]: Forgot password?
- paragraph:
  - text: No account?
  - link "Create one":
    - /url: /auth/register
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
>  54 |     expect(results.violations).toHaveLength(0);
      |                                ^ Error: expect(received).toHaveLength(expected)
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
```