import { Component, inject } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../config/theme.service';
import { AuthService } from '../auth/auth.service';
import {
  clearImpersonationToken,
  AdminApiService,
} from '../../modules/admin/services/admin-api.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {
  readonly themeService = inject(ThemeService);
  readonly auth = inject(AuthService);
  private readonly adminApi = inject(AdminApiService);
  private readonly router = inject(Router);

  readonly user = this.auth.user;
  readonly business = this.auth.business;
  readonly isSuperAdmin = () => this.auth.isSuperAdmin();
  readonly isImpersonating = () => this.auth.isImpersonating();

  /** Sidebar: Services only when impersonating or business owner; super_admin not impersonating -> /admin/business-customers */
  readonly servicesNavLink = (): string =>
    this.auth.isSuperAdmin() && !this.auth.isImpersonating() ? '/admin/business-customers' : '/services';

  /** Sidebar: "Businesses" + /admin/business-customers when super_admin and not impersonating; else "Customers" + /customers */
  readonly customersNavLabel = (): string =>
    this.auth.isSuperAdmin() && !this.auth.isImpersonating() ? 'Businesses' : 'Customers';

  readonly customersNavLink = (): string =>
    this.auth.isSuperAdmin() && !this.auth.isImpersonating() ? '/admin/business-customers' : '/customers';

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
