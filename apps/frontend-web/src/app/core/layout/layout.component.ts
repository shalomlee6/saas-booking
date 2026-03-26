import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../config/theme.service';
import { AuthService } from '../auth/auth.service';
import { AdminApiService } from '../../modules/admin/services/admin-api.service';
import { DOCUMENT } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';

const BREAKPOINT_PX = 768;

/** Stable object references for routerLinkActiveOptions — avoids recreating objects on every CD cycle. */
const LINK_OPTS_EXACT = { exact: true } as const;
const LINK_OPTS_PREFIX = { exact: false } as const;

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastModule, ButtonModule],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent implements OnInit, OnDestroy {
  private readonly doc = inject(DOCUMENT);
  readonly themeService = inject(ThemeService);
  readonly auth = inject(AuthService);
  private readonly adminApi = inject(AdminApiService);
  private readonly router = inject(Router);

  readonly user = this.auth.user;
  readonly business = this.auth.business;
  readonly isSuperAdmin = computed(() => this.auth.isSuperAdmin());
  readonly isImpersonating = this.auth.isImpersonating;
  readonly activeBusinessName = computed(() => this.auth.activeBusinessName());

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
    if (this.isMobile()) {
      return this.isMobileMenuOpen() ? 'Close menu' : 'Open menu';
    }
    return this.isSidebarCollapsed() ? 'Expand sidebar' : 'Collapse sidebar';
  });

  /** Icon for menu toggle: pi-bars when sidebar closed, pi-times when open. */
  readonly menuToggleIcon = computed<string>(() => {
    const open = this.isMobile() ? this.isMobileMenuOpen() : !this.isSidebarCollapsed();
    return open ? 'pi pi-times' : 'pi pi-bars';
  });

  /** Sidebar: Services nav link. */
  readonly servicesNavLink = computed<string>(() =>
    this.isSuperAdmin() && !this.isImpersonating() ? '/services' : '/services'
  );

  /** Sidebar: Customers label. */
  readonly customersNavLabel = computed<string>(() =>
    this.isSuperAdmin() && !this.isImpersonating() ? 'Businesses' : 'Customers'
  );

  /** Sidebar: Customers nav link. */
  readonly customersNavLink = computed<string>(() =>
    this.isSuperAdmin() && !this.isImpersonating() ? '/admin/business-customers' : '/customers'
  );

  /** Stable routerLinkActiveOptions for the customers nav item. */
  readonly customersNavLinkActiveOptions = computed(() =>
    this.customersNavLink() === '/admin/business-customers' ? LINK_OPTS_EXACT : LINK_OPTS_PREFIX
  );

  /** URL for the public customer site (open in new tab). */
  readonly customerSiteUrl = computed<string>(() => {
    const slug = this.auth.business()?.slug;
    return slug ? `/b/${encodeURIComponent(slug)}/login` : '#';
  });

  toggleTheme(): void {
    const next = this.themeService.currentMode() === 'light' ? 'dark' : 'light';
    this.themeService.setModeAndReapply(next);
  }

  exitImpersonation(): void {
    const auth = this.auth;
    const router = this.router;
    const finish = () => {
      auth.stopImpersonation();
      auth.init().subscribe(() => {
        router.navigate([auth.isSuperAdmin() ? '/admin/business-customers' : '/dashboard']);
      });
    };
    this.adminApi.stopImpersonation().subscribe({ next: finish, error: finish });
  }
}
