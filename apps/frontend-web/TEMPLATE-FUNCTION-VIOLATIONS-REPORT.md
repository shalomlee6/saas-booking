# Template function call violations – frontend (Angular)

**Scope:** All `*.component.html` in `apps/frontend-web/src`.  
**Rule:** Do not call component methods or non-signal functions from templates (see `dev-rules.md` and `.cursor/rules/angular-no-template-methods.mdc`).  
**Note:** Signal and computed reads (e.g. `mySignal()`, `myComputed()`) are **allowed**. This report only flags component methods and arrow functions used as “getters” in templates.

---

## 1. apps/frontend-web/src/app/modules/appointments/pages/appointments-list/appointments-list.component.html

| Line/snippet | Called | Issue | Severity | Recommended fix |
|--------------|--------|--------|----------|-----------------|
| `{{ visibleDateRangeLabel() }}` | `visibleDateRangeLabel()` | Component method in interpolation; runs every CD. | Medium | Replace with a computed signal, e.g. `readonly visibleDateRangeLabel = computed(() => { ... })`, and bind to `visibleDateRangeLabel()`. |
| `{{ dayName(day) }}` | `dayName(day)` | Method called inside `@for` over days; runs per day every CD. | **High** | Precompute: e.g. `visibleDaysWithNames = computed(() => this.getVisibleDays().map(d => ({ day: d, name: this.dayName(d) })))` and use `item.name` in template. |
| `{{ customerDisplay(a) }}` | `customerDisplay(a)` | Method inside list of appointments; runs per row every CD. | **High** | Add to view model: e.g. in `filteredItems` computed, map each item to `{ ...apt, customerDisplay: this.customerDisplay(apt) }`, then bind to `a.customerDisplay`. Or expose a computed that returns items with display fields. |
| `{{ serviceDisplay(a) }}` | `serviceDisplay(a)` | Same as above. | **High** | Same as `customerDisplay`: precompute in component (computed or view model) and bind to property. |
| `{{ customerDisplay(apt) }}`, `{{ serviceDisplay(apt) }}`, `{{ priceDisplay(apt) }}` (detail panel) | `customerDisplay`, `serviceDisplay`, `priceDisplay` | Methods in detail view (single item). | Medium | Use same view model / computed as list, or a single computed for “selected appointment display” that returns `{ customer, service, price }`. |
| `[class.calendar-header-day--today]="isToday(day)"` | `isToday(day)` | Method in binding inside `@for` (days). | **High** | Precompute a `Set` or map of “today” keys in a computed, or include `isToday: boolean` on each day in a `visibleDaysWithMeta` computed. |
| `[attr.title]="getDayWorkingTitle(day)"` | `getDayWorkingTitle(day)` | Method in binding inside `@for` (days). | **High** | Add `workingTitle` (or similar) to the same precomputed day view model used for `dayName` / `isToday`. |
| `[class]="blockStatusClass(block)"` | `blockStatusClass(block)` | Method in binding inside nested `@for` (blocks). | **High** | Precompute status class on each block in component (e.g. when building blocks in `getBlocksForDay` or in a computed that returns blocks with `statusClass`). |
| `<p-tag [severity]="statusSeverity(a.status)" />` | `statusSeverity(a.status)` | Method in binding inside list. | **High** | Add `severity` (or a display DTO with severity) to appointment view model in a computed. |
| `@for (day of getVisibleDays(); track toDateKey(day))` | `getVisibleDays()`, `toDateKey(day)` | Method used as `@for` source; function in `track`. | **High** | Replace with computed: e.g. `readonly visibleDays = computed(() => this.getVisibleDays())` and use `visibleDays()` in template. Keep `toDateKey` in track or move to a precomputed key on each day. |
| `@for (row of hourLabelsWithStyle(); track $index)` | `hourLabelsWithStyle()` | This is a **computed** — allowed. | — | No change. |
| `@for (range of getDisabledRanges(day); track range.key)` | `getDisabledRanges(day)` | Method returning array inside `@for` (days). | **High** | Precompute per-day disabled ranges in component (e.g. `visibleDaysWithDisabledRanges` computed) and bind to `day.disabledRanges`. |
| `@for (slot of getSlotsForDay(day); track slot.minutesFromMidnight)` | `getSlotsForDay(day)` | Method returning array inside `@for` (days). | **High** | Same idea: include `slots` (or `slotsForDay`) on each day in a computed view model. |
| `@for (block of getBlocksForDay(day); track block.appointment._id)` | `getBlocksForDay(day)` | Method returning array inside `@for` (days). | **High** | Include `blocks` on each day in a precomputed structure (e.g. `daysWithBlocks` computed). |
| `@for (a of filteredItems(); track a._id)` | `filteredItems()` | This is a **computed** — allowed. | — | No change. |

---

## 2. apps/frontend-web/src/app/core/layout/layout.component.html

| Line/snippet | Called | Issue | Severity | Recommended fix |
|--------------|--------|--------|----------|-----------------|
| `[class.layout--impersonating]="isImpersonating()"` | `isImpersonating()` | Arrow function used as getter; runs every CD. | Medium | Prefer a signal on the component or from auth, e.g. `readonly isImpersonating = toSignal(this.auth.isImpersonating$, { initialValue: false })` if auth exposes observable, or a signal updated when impersonation changes. |
| `[class.layout--sidebar-collapsed]="!isMobile() && isSidebarCollapsed()"` | `isMobile()`, `isSidebarCollapsed()` | These are **signals** — allowed. | — | No change. |
| `[routerLink]="servicesNavLink()"` | `servicesNavLink()` | Arrow function used as getter. | Medium | Replace with computed: `readonly servicesNavLink = computed(() => ...)`. |
| `[routerLink]="customersNavLink()"`, `customersNavLink() === '/admin/...'` | `customersNavLink()` | Same. | Medium | Same: `readonly customersNavLink = computed(() => ...)`. |
| `[title]="customersNavLabel()"`, `{{ customersNavLabel() }}` | `customersNavLabel()` | Same. | Medium | `readonly customersNavLabel = computed(() => ...)`. |
| `[icon]="menuToggleIcon()"` | `menuToggleIcon()` | Method (getter) in binding. | Medium | `readonly menuToggleIcon = computed(() => ...)`. |
| `[href]="customerSiteUrl()"` | `customerSiteUrl()` | Arrow function used as getter. | Medium | `readonly customerSiteUrl = computed(() => ...)`. |
| `@if (!isSuperAdmin() && user()?.businessId)` | `isSuperAdmin()` | Arrow function. | Medium | Signal or computed from auth (e.g. `isSuperAdmin` as signal/computed). |
| `@if (isImpersonating())`, etc. | `isImpersonating()` | Same as above. | Medium | As above. |
| `@if (auth.activeBusinessName(); as bizName)` | `auth.activeBusinessName()` | Service method in template. | Medium | Expose as signal/computed in layout (e.g. `readonly activeBusinessName = toSignal(auth.activeBusinessName$, ...)` or equivalent). |
| `themeService.currentMode()` (in binding/aria-label) | `themeService.currentMode()` | If this is a **signal** on the service, it’s allowed. If it’s a plain method, treat as Medium. | Low/Medium | Prefer theme service exposing `currentMode` as a signal and binding to `themeService.currentMode()`. |

---

## 3. apps/frontend-web/src/app/modules/settings/pages/working-hours-edit/working-hours-edit.component.html

| Line/snippet | Called | Issue | Severity | Recommended fix |
|--------------|--------|--------|----------|-----------------|
| `{{ dayLabel() }}` | `dayLabel()` | This is a **computed** — allowed. | — | No change. |
| `@for (k of otherDays(); track k)` | `otherDays()` | This is a **computed** — allowed. | — | No change. |
| `{{ k.charAt(0).toUpperCase() + k.slice(1) }}` | `k.charAt`, `k.slice` | Inline string methods in template (formatting). | Low | Precompute labels in component: e.g. `otherDaysWithLabels = computed(() => this.otherDays().map(k => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1) })))` and use `item.label`. Or use a pure pipe. |
| `@for (item of displaySlots(); track item.index)` | `displaySlots()` | This is a **computed** — allowed. | — | No change. |

---

## 4. apps/frontend-web/src/app/modules/dashboard/pages/dashboard/dashboard.component.html

| Line/snippet | Called | Issue | Severity | Recommended fix |
|--------------|--------|--------|----------|-----------------|
| `@for (a of list.slice(0, 10); track a._id)` | `list.slice(0, 10)` | Array method in template; runs every CD when list is defined. | Low | In component: expose a computed or signal that holds the first 10 appointments (e.g. from the same source as `appointments$`), e.g. `readonly topAppointments = computed(() => this.appointmentsSlice().slice(0, 10))` where `appointmentsSlice` is derived from the observable, then `@for (a of topAppointments(); track a._id)`. |

---

## 5. Other component templates

- **working-hours-list.component.html** — Uses only signals and computeds (`editDayHeader()`, `overrideHeader()`, `minuteOptionsList()`, `editDayGeneralError()`, `editDayErrorsByIndex()`, `hasEditDayErrorsSignal()`, `overrideConflictWarningText()`, `overrideRangeVms()`, etc.). **No violations** (all are signal/computed reads).
- **customer-book-page.component.html** — Uses `business()`, `services()`, `selectedService()`, `slots()`, `canShowSlots()`, etc.; these are signals/computeds. **No violations** identified.
- **customer-login, working-hours-settings, business-theme-settings, services-list, service-form, customers-list, customer-form, login, appointment-form, business-ui-editor, business-customers, appointment-create-overlay** — Template calls are either signal/computed reads (e.g. `error()`, `loading()`, `saving()`) or event handlers. **No violations** identified for this rule.

---

## Summary

| File | High | Medium | Low |
|------|------|--------|-----|
| appointments-list.component.html | 12 | 2 | 0 |
| layout.component.html | 0 | 8+ | 1 |
| working-hours-edit.component.html | 0 | 0 | 1 |
| dashboard.component.html | 0 | 0 | 1 |

**Total:** 12 High, 10+ Medium, 2 Low (approximate).

---

## Next step

No code has been changed. After review, you can approve fixes:

1. **High severity only** (appointments-list: precomputed view models and computeds for day/slot/block/display data).
2. **High + Medium** (above + layout: convert arrow functions and service usage to signals/computeds; optionally working-hours-edit and dashboard).
3. **Specific files only** (e.g. “only appointments-list” or “only layout”).

Reply with the chosen option (or list specific files) to proceed with safe, incremental refactors.
