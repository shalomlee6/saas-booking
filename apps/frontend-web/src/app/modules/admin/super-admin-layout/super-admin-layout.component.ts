import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  effect,
  HostListener,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../../core/auth/auth.service';
import { AdminApiService } from '../services/admin-api.service';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

const BREAKPOINT_PX = 768;

@Component({
  selector: 'app-super-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastModule, ButtonModule],
  templateUrl: './super-admin-layout.component.html',
  styleUrl: './super-admin-layout.component.scss',
})
export class SuperAdminLayoutComponent implements OnInit, OnDestroy {
  private readonly doc = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly router = inject(Router);
  private readonly adminApi = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);

  private readonly _titleSync = effect(() => {
    this.title.setTitle('SaaS Booking · Admin');
  });

  readonly user = this.auth.user;

  readonly isMobileMenuOpen = signal(false);
  readonly isSidebarCollapsed = signal(false);
  readonly isMobile = signal(false);
  readonly alertCount = signal(0);

  readonly menuToggleIcon = computed<string>(() => {
    const open = this.isMobile() ? this.isMobileMenuOpen() : !this.isSidebarCollapsed();
    return open ? 'pi pi-times' : 'pi pi-bars';
  });

  readonly menuAriaLabel = computed<string>(() => {
    if (this.isMobile()) {
      return this.isMobileMenuOpen() ? 'Close menu' : 'Open menu';
    }
    return this.isSidebarCollapsed() ? 'Expand sidebar' : 'Collapse sidebar';
  });

  private resizeListener = (): void => {
    const w = this.doc.defaultView?.innerWidth ?? 0;
    this.isMobile.set(w < BREAKPOINT_PX);
    if (w >= BREAKPOINT_PX) this.isMobileMenuOpen.set(false);
  };

  ngOnInit(): void {
    this.resizeListener();
    this.doc.defaultView?.addEventListener('resize', this.resizeListener);
    this.refreshAlertCount();
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.refreshAlertCount());
  }

  private refreshAlertCount(): void {
    this.adminApi.getAlertsCount().subscribe({
      next: (r: { count: number }) => this.alertCount.set(r.count),
      error: () => this.alertCount.set(0),
    });
  }

  ngOnDestroy(): void {
    this.doc.defaultView?.removeEventListener('resize', this.resizeListener);
    this.doc.body.classList.remove('sa-layout-drawer-open');
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isMobile() && this.isMobileMenuOpen()) {
      this.isMobileMenuOpen.set(false);
      this.doc.body.classList.remove('sa-layout-drawer-open');
    }
  }

  toggleSidebar(): void {
    if (this.isMobile()) {
      const open = !this.isMobileMenuOpen();
      this.isMobileMenuOpen.set(open);
      this.doc.body.classList.toggle('sa-layout-drawer-open', open);
    } else {
      this.isSidebarCollapsed.update((v) => !v);
    }
  }

  closeMobileMenu(): void {
    if (this.isMobileMenuOpen()) {
      this.isMobileMenuOpen.set(false);
      this.doc.body.classList.remove('sa-layout-drawer-open');
    }
  }

  onLogout(): void {
    this.closeMobileMenu();
    this.auth.logout();
  }
}
