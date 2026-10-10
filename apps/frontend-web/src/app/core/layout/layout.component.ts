import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  HostListener,
  effect,
  DestroyRef,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, filter, map, of, startWith } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { AuthService } from '../auth/auth.service';
import { ThemeService } from '../config/theme.service';
import { AdminApiService } from '../../modules/admin/services/admin-api.service';
import { GrowthBrainService } from '../../modules/dashboard/services/growth-brain.service';
import { AppointmentsApiService } from '../../modules/appointments/services/appointments-api.service';
import * as AppointmentsActions from '../../modules/appointments/state/appointments.actions';
import { DOCUMENT, NgStyle } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { LanguageService } from '../i18n/language.service';
import { TranslatePipe } from '../i18n/translate.pipe';

/** Matches `$breakpoint` in layout.component.scss. Below this, the sidebar is a drawer. */
export const LAYOUT_SIDEBAR_BREAKPOINT_PX = 1024;

/** Translation-key namespace for the topbar's page title, derived from the current route. */
function pageTitleKeyFromUrl(url: string): string {
  const path = url.split('?')[0] || '/';
  if (path === '/' || path.startsWith('/dashboard')) return 'navigation.dashboard';
  if (path.startsWith('/appointments')) return 'navigation.appointments';
  if (path.startsWith('/services')) return 'navigation.services';
  if (path.startsWith('/customers')) return 'navigation.customers';
  if (path.startsWith('/settings/theme')) return 'navigation.theme';
  if (path.startsWith('/settings/landing')) return 'navigation.landingPage';
  if (path.startsWith('/settings/working-hours')) return 'navigation.workingHours';
  if (path.startsWith('/settings/account')) return 'navigation.account';
  if (path.startsWith('/preview')) return 'navigation.previewSite';
  return '';
}

/** Stable object references for routerLinkActiveOptions — avoids recreating objects on every CD cycle. */
const LINK_OPTS_EXACT = { exact: true } as const;
const LINK_OPTS_PREFIX = { exact: false } as const;

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastModule, ButtonModule, TranslatePipe, NgStyle],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent implements OnInit, OnDestroy {
  private readonly doc = inject(DOCUMENT);
  private readonly title = inject(Title);
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly language = inject(LanguageService);
  private readonly adminApi = inject(AdminApiService);
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly growthBrain = inject(GrowthBrainService);
  private readonly appointmentsApi = inject(AppointmentsApiService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _titleSync = effect(() => {
    const name = this.auth.business()?.name?.trim();
    this.title.setTitle(name ? `${name} · boki` : 'boki');
  });

  /**
   * Two separate PrimeNG problems, one fix. `app.config.ts` sets PrimeNG's
   * `darkModeSelector: '.theme-dark'`, and PrimeNG's generated stylesheet
   * always declares `:root, :host { ... }` for its base tokens — `:root`
   * means `<html>` specifically, nothing else. That causes two failures for
   * a shell scoped to `.layout.theme-dark` (a mid-tree div, not html):
   *
   * 1. Overlay components (select/datepicker panels, dialogs, drawers,
   *    toasts) portal straight to `<body>`, outside `.layout` — its CSS
   *    vars never reach them at all.
   * 2. Plain inline fields (`p-inputnumber`, `pTextarea`, …) DO sit inside
   *    `.layout`, but some of PrimeNG's own component tokens (e.g.
   *    `--p-inputtext-background`) are declared ONLY on `:root`, as
   *    `var(--p-form-field-background)` — and per how CSS custom properties
   *    inherit, that `var()` is substituted once, using `<html>`'s own
   *    cascade, at the point `:root` is declared. The resolved (light)
   *    value is what then inherits everywhere — `.layout` having its own
   *    dark `--p-form-field-background` further down the tree cannot
   *    reopen that substitution. Verified empirically: adding `.theme-dark`
   *    to `.layout` alone left these inputs white; only adding it to
   *    `<html>` (matching `:root`) resolves them dark.
   *
   * So this targets `document.documentElement`, not `document.body` —
   * `<html>` is an ancestor of both `.layout` and anything body-portaled,
   * so one class fixes both cases at once.
   *
   * Scoped here (component lifecycle), not in `ThemeService` (app-root
   * singleton): a singleton's effect has no way to know when `.layout` has
   * been unmounted — navigating to the super-admin panel or the public site
   * would leave a stale `html.theme-dark` behind, wrongly darkening THEIR
   * PrimeNG chrome too. `onCleanup` removes the class both on every re-run
   * and when this component is destroyed, so leaving `.layout` by any route
   * always leaves `<html>` clean for whatever mounts next.
   */
  private readonly _pnDarkSync = effect((onCleanup) => {
    const dark = this.theme.mode() === 'dark';
    this.doc.documentElement.classList.toggle('theme-dark', dark);
    onCleanup(() => this.doc.documentElement.classList.remove('theme-dark'));
  });

  readonly user = this.auth.user;
  readonly business = this.auth.business;
  readonly isSuperAdmin = computed(() => this.auth.isSuperAdmin());
  readonly isImpersonating = this.auth.isImpersonating;
  readonly activeBusinessName = this.auth.activeBusinessName;

  /** Current route path (no query string), used to derive the topbar title/date. */
  private readonly currentPath = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split('?')[0] || '/'),
      startWith(this.router.url.split('?')[0] || '/')
    ),
    { initialValue: this.router.url.split('?')[0] || '/' }
  );

  /** Translation key for the topbar H1; empty string falls back to the "boki" wordmark. */
  private readonly pageTitleKey = computed(() => pageTitleKeyFromUrl(this.currentPath()));
  readonly pageTitle = computed(() =>
    this.pageTitleKey() ? this.language.t(this.pageTitleKey()) : 'boki'
  );

  /** The mockup's date subtitle only makes sense on the dashboard's "today" view. */
  readonly showDateSubtitle = computed(() => {
    const p = this.currentPath();
    return p === '/' || p.startsWith('/dashboard');
  });

  /** Business-timezone- and language-aware "יום שלישי · 18 באוג׳ 2026" / "Tue, Aug 18, 2026" label. */
  readonly dateLabel = computed(() => {
    const now = new Date();
    const tz = this.auth.businessTimezone();
    // Reads `language()` so this recomputes on language switch.
    const locale = this.language.intlLocale();
    const weekdayFmt = new Intl.DateTimeFormat(locale, { timeZone: tz, weekday: 'long' });
    const dateFmt = new Intl.DateTimeFormat(locale, { timeZone: tz, day: 'numeric', month: 'short', year: 'numeric' });
    return `${weekdayFmt.format(now)} · ${dateFmt.format(now)}`;
  });

  /** Count of pending (awaiting owner confirmation) appointments, for the sidebar badge + topbar bell dot. */
  readonly pendingAppointmentsCount = toSignal(
    this.appointmentsApi.appointments$.pipe(
      map((list) => list.filter((a) => (a.status ?? '').toLowerCase() === 'pending').length),
      catchError(() => of(0))
    ),
    { initialValue: 0 }
  );

  /** Best-effort initials from the logged-in user's email (no display-name field exists on User). */
  readonly userInitials = computed(() => {
    const local = (this.auth.user()?.email ?? '').split('@')[0] ?? '';
    return local.slice(0, 2).toUpperCase() || '—';
  });

  /** Mobile: drawer open/close. Desktop: unused. */
  readonly isMobileMenuOpen = signal(false);
  /** Desktop: sidebar collapsed (72px). Mobile: unused. */
  readonly isSidebarCollapsed = signal(false);
  /** True when the sidebar is off-canvas and the topbar menu button is shown. */
  readonly isMobile = signal(false);

  private resizeListener = (): void => {
    const w = this.doc.defaultView?.innerWidth ?? 0;
    this.isMobile.set(w < LAYOUT_SIDEBAR_BREAKPOINT_PX);
    if (w >= LAYOUT_SIDEBAR_BREAKPOINT_PX) {
      this.isMobileMenuOpen.set(false);
      this.doc.body.classList.remove('layout-drawer-open');
    }
  };

  ngOnInit(): void {
    this.resizeListener();
    this.doc.defaultView?.addEventListener('resize', this.resizeListener);
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.closeMobileMenu());
  }

  ngOnDestroy(): void {
    this.doc.defaultView?.removeEventListener('resize', this.resizeListener);
    this.doc.body.classList.remove('layout-drawer-open');
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isMobile() && this.isMobileMenuOpen()) this.closeMobileMenu();
  }

  @HostListener('document:keydown', ['$event'])
  onDrawerTab(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.isMobile() || !this.isMobileMenuOpen()) return;
    const root = this.doc.querySelector('.layout-sidebar');
    if (!root) return;
    const items = focusableIn(root);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = this.doc.activeElement;
    if (event.shiftKey && (active === first || !root.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !root.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  toggleSidebar(): void {
    if (this.isMobile()) {
      if (this.isMobileMenuOpen()) this.closeMobileMenu();
      else this.openMobileMenu();
    } else {
      this.isSidebarCollapsed.update((v) => !v);
    }
  }

  openMobileMenu(): void {
    this.isMobileMenuOpen.set(true);
    this.doc.body.classList.add('layout-drawer-open');
    queueMicrotask(() => focusableIn(this.doc.querySelector('.layout-sidebar'))[0]?.focus());
  }

  closeMobileMenu(): void {
    if (!this.isMobileMenuOpen()) return;
    this.isMobileMenuOpen.set(false);
    this.doc.body.classList.remove('layout-drawer-open');
    queueMicrotask(() => {
      const button = this.doc.querySelector<HTMLElement>('.layout-topbar-menu-btn');
      button?.focus();
    });
  }

  onSidebarNavigate(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('a')) this.closeMobileMenu();
  }

  readonly menuAriaLabel = computed<string>(() => {
    // Reuses navigation.menu ("Menu"/"תפריט") rather than a bespoke open/close pair —
    // aria-expanded already communicates open/closed state to assistive tech.
    return this.language.t('navigation.menu');
  });

  /** Icon for menu toggle: pi-bars when sidebar closed, pi-times when open. */
  readonly menuToggleIcon = computed<string>(() => {
    const open = this.isMobile() ? this.isMobileMenuOpen() : !this.isSidebarCollapsed();
    return open ? 'pi pi-times' : 'pi pi-bars';
  });

  /** URL for the public customer site (open in new tab). */
  readonly customerSiteUrl = computed<string>(() => {
    const slug = this.auth.business()?.slug;
    return slug ? `/b/${encodeURIComponent(slug)}` : '#';
  });

  readonly linkOptsExact = LINK_OPTS_EXACT;
  readonly linkOptsPrefix = LINK_OPTS_PREFIX;

  onLogout(): void {
    this.closeMobileMenu();
    this.auth.logout();
  }

  exitImpersonation(): void {
    const auth = this.auth;
    const router = this.router;
    const finish = () => {
      auth.stopImpersonation();
      this.store.dispatch(AppointmentsActions.resetTenantState());
      this.growthBrain.invalidateTenantScope();
      // Instant visual reset (no dark-mode flash) while the follow-up /auth/me
      // below resolves the super-admin's own permanently-light state.
      this.theme.reset();
      auth.init().subscribe(() => {
        router.navigate([auth.isSuperAdmin() ? '/super-admin/businesses' : '/dashboard']);
      });
    };
    this.adminApi.stopImpersonation().subscribe({ next: finish, error: finish });
  }
}

function focusableIn(root: Element | null): HTMLElement[] {
  if (!root) return [];
  return [...root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(
    (el) => !el.hasAttribute('disabled') && el.tabIndex >= 0
  );
}
