import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../config/theme.service';
import { AuthService } from '../auth/auth.service';
import {
  clearImpersonationToken,
  AdminApiService,
} from '../../modules/admin/services/admin-api.service';
import { DOCUMENT } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';

const BREAKPOINT_PX = 1024;

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
  readonly isSuperAdmin = () => this.auth.isSuperAdmin();
  readonly isImpersonating = () => this.auth.isImpersonating();

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

  get menuAriaLabel(): string {
    if (this.isMobile()) {
      return this.isMobileMenuOpen() ? 'Close menu' : 'Open menu';
    }
    return this.isSidebarCollapsed() ? 'Expand sidebar' : 'Collapse sidebar';
  }

  /** Icon for menu toggle: pi-bars when sidebar closed, pi-times when open */
  menuToggleIcon(): string {
    const open = this.isMobile() ? this.isMobileMenuOpen() : !this.isSidebarCollapsed();
    return open ? 'pi pi-times' : 'pi pi-bars';
  }

  /** Sidebar: Services only when impersonating or business owner; super_admin not impersonating -> /admin/business-customers */
  readonly servicesNavLink = (): string =>
    this.auth.isSuperAdmin() && !this.auth.isImpersonating() ? '/admin/business-customers' : '/services';

  /** Sidebar: "Businesses" + /admin/business-customers when super_admin and not impersonating; else "Customers" + /customers */
  readonly customersNavLabel = (): string =>
    this.auth.isSuperAdmin() && !this.auth.isImpersonating() ? 'Businesses' : 'Customers';

  readonly customersNavLink = (): string =>
    this.auth.isSuperAdmin() && !this.auth.isImpersonating() ? '/admin/business-customers' : '/customers';

  /** URL for the public customer site (open in new tab). Uses current business slug. */
  readonly customerSiteUrl = (): string => {
    const slug = this.auth.business()?.slug;
    return slug ? `/b/${encodeURIComponent(slug)}/login` : '#';
  };

  toggleTheme(): void {
    const next = this.themeService.currentMode() === 'light' ? 'dark' : 'light';
    this.themeService.setModeAndReapply(next);
  }

  exitImpersonation(): void {
    const auth = this.auth;
    const router = this.router;
    this.adminApi.stopImpersonation().subscribe({
      next: () => {
        clearImpersonationToken();
        auth.init().subscribe(() => {
          router.navigate([auth.isSuperAdmin() ? '/admin/business-customers' : '/dashboard']);
        });
      },
      error: () => {
        clearImpersonationToken();
        auth.init().subscribe(() => {
          router.navigate([auth.isSuperAdmin() ? '/admin/business-customers' : '/dashboard']);
        });
      },
    });
  }
}
