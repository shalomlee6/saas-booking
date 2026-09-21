import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  HostListener,
  effect,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, filter, map, of, startWith } from 'rxjs';
import { Store } from '@ngrx/store';
import { ThemeService } from '../config/theme.service';
import { AuthService } from '../auth/auth.service';
import { AdminApiService } from '../../modules/admin/services/admin-api.service';
import { GrowthBrainService } from '../../modules/dashboard/services/growth-brain.service';
import { AppointmentsApiService } from '../../modules/appointments/services/appointments-api.service';
import * as AppointmentsActions from '../../modules/appointments/state/appointments.actions';
import { DOCUMENT } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { LanguageService } from '../i18n/language.service';
import { TranslatePipe } from '../i18n/translate.pipe';

const BREAKPOINT_PX = 768;

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
  if (path.startsWith('/preview')) return 'navigation.previewSite';
  return '';
}

/** Stable object references for routerLinkActiveOptions — avoids recreating objects on every CD cycle. */
const LINK_OPTS_EXACT = { exact: true } as const;
const LINK_OPTS_PREFIX = { exact: false } as const;

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastModule, ButtonModule, TranslatePipe],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent implements OnInit, OnDestroy {
  private readonly doc = inject(DOCUMENT);
  private readonly title = inject(Title);
  readonly themeService = inject(ThemeService);
  readonly auth = inject(AuthService);
  readonly language = inject(LanguageService);
  private readonly adminApi = inject(AdminApiService);
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly growthBrain = inject(GrowthBrainService);
  private readonly appointmentsApi = inject(AppointmentsApiService);

  private readonly _titleSync = effect(() => {
    const name = this.auth.business()?.name?.trim();
    this.title.setTitle(name ? `${name} · boki` : 'boki');
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
  /** True when viewport width < 1024px. */
  readonly isMobile = signal(false);

  private resizeListener = (): void => {
    const w = this.doc.defaultView?.innerWidth ?? 0;
    this.isMobile.set(w < BREAKPOINT_PX);
    if (w >= BREAKPOINT_PX) this.isMobileMenuOpen.set(false);
  };

  ngOnInit(): void {
    this.resizeListener();
    this.doc.defaultView?.addEventListener('resize', this.resizeListener);
  }

  ngOnDestroy(): void {
    this.doc.defaultView?.removeEventListener('resize', this.resizeListener);
    this.doc.body.classList.remove('layout-drawer-open');
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isMobile() && this.isMobileMenuOpen()) {
      this.isMobileMenuOpen.set(false);
      this.doc.body.classList.remove('layout-drawer-open');
    }
  }

  toggleSidebar(): void {
    if (this.isMobile()) {
      const open = !this.isMobileMenuOpen();
      this.isMobileMenuOpen.set(open);
      this.doc.body.classList.toggle('layout-drawer-open', open);
    } else {
      this.isSidebarCollapsed.update((v) => !v);
    }
  }

  closeMobileMenu(): void {
    if (this.isMobileMenuOpen()) {
      this.isMobileMenuOpen.set(false);
      this.doc.body.classList.remove('layout-drawer-open');
    }
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
    return slug ? `/b/${encodeURIComponent(slug)}/login` : '#';
  });

  readonly linkOptsExact = LINK_OPTS_EXACT;
  readonly linkOptsPrefix = LINK_OPTS_PREFIX;

  toggleTheme(): void {
    const next = this.themeService.currentMode() === 'light' ? 'dark' : 'light';
    this.themeService.setModeAndReapply(next);
  }

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
      auth.init().subscribe(() => {
        router.navigate([auth.isSuperAdmin() ? '/super-admin/businesses' : '/dashboard']);
      });
    };
    this.adminApi.stopImpersonation().subscribe({ next: finish, error: finish });
  }
}
