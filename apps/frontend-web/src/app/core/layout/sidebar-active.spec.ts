import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter, type Route, type Routes } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { routes as appRoutes } from '../../app.routes';
import { APPOINTMENTS_ROUTES } from '../../modules/appointments/appointments.routes';
import { AppointmentsApiService } from '../../modules/appointments/services/appointments-api.service';
import { CUSTOMERS_ROUTES } from '../../modules/customers/customers.routes';
import { DASHBOARD_ROUTES } from '../../modules/dashboard/dashboard.routes';
import { GrowthBrainService } from '../../modules/dashboard/services/growth-brain.service';
import { AdminApiService } from '../../modules/admin/services/admin-api.service';
import { SERVICES_ROUTES } from '../../modules/services/services.routes';
import { SETTINGS_ROUTES } from '../../modules/settings/settings.routes';
import { AuthService } from '../auth/auth.service';
import { ThemeService } from '../config/theme.service';
import { LanguageService } from '../i18n/language.service';
import { LayoutComponent } from './layout.component';
import { sidebarItemForUrl, type SidebarItemId } from './sidebar-active';

/** The routes behind each top-level owner path, exactly as the app registers them. */
const OWNER_ROUTE_FILES: Record<string, Routes> = {
  dashboard: DASHBOARD_ROUTES,
  appointments: APPOINTMENTS_ROUTES,
  services: SERVICES_ROUTES,
  customers: CUSTOMERS_ROUTES,
  settings: SETTINGS_ROUTES,
};

/** Every concrete URL a route tree can be entered at (route params filled in, redirects included). */
function urlsOf(routes: Routes, prefix: string): string[] {
  const urls: string[] = [];
  for (const route of routes) {
    if (route.path === '**') continue;
    const segment = (route.path ?? '').replace(/:[A-Za-z]+/g, 'abc123');
    const url = [prefix, segment].filter(Boolean).join('/');
    if (route.children) {
      urls.push(prefix || '/', ...urlsOf(route.children, url));
    } else {
      urls.push(url || '/');
    }
  }
  return urls;
}

/** The owner portal's top-level paths, read from the app's own route table. */
function ownerTopLevelPaths(): string[] {
  const find = (routes: Routes): Route | undefined => {
    for (const route of routes) {
      if (route.children?.some((child) => child.path === 'dashboard')) return route;
      const nested = route.children ? find(route.children) : undefined;
      if (nested) return nested;
    }
    return undefined;
  };
  return (find(appRoutes)?.children ?? [])
    .map((route) => route.path ?? '')
    .filter((path) => path !== '');
}

const OWNER_URLS = Array.from(
  new Set([
    '/',
    '/preview/customer-site',
    ...Object.entries(OWNER_ROUTE_FILES).flatMap(([path, routes]) => urlsOf(routes, `/${path}`)),
  ])
).map((url) => url.replace(/\/+$/, '') || '/');

describe('sidebarItemForUrl', () => {
  const cases: [string, SidebarItemId][] = [
    ['/', 'dashboard'],
    ['/dashboard', 'dashboard'],
    ['/appointments', 'appointments'],
    ['/appointments/new', 'appointments'],
    ['/appointments/abc/edit', 'appointments'],
    ['/services/new', 'services'],
    ['/customers/abc', 'customers'],
    ['/settings', 'settings'],
    ['/settings/', 'settings'],
    ['/settings/design', 'settings'],
    ['/settings/hours', 'settings'],
    ['/settings/booking', 'settings'],
    ['/settings/reliability', 'settings'],
    ['/settings/customers', 'settings'],
    ['/settings/policy', 'settings'],
    ['/settings/theme', 'settings'],
    ['/settings/working-hours', 'settings'],
    ['/settings/landing', 'landing'],
    ['/settings/landing?tab=gallery', 'landing'],
    ['/settings/account', 'account'],
    ['/settings/account#password', 'account'],
    ['/preview/customer-site', 'preview'],
  ];

  for (const [url, item] of cases) {
    it(`${url} belongs to ${item}`, () => {
      expect(sidebarItemForUrl(url)).toBe(item);
    });
  }

  it('does not claim URLs outside the owner portal', () => {
    expect(sidebarItemForUrl('/b/demo-salon')).toBeNull();
    expect(sidebarItemForUrl('/super-admin/users')).toBeNull();
  });
});

@Component({ standalone: true, template: '<p class="page-stub"></p>' })
class StubPageComponent {}

describe('owner sidebar highlights exactly one item', () => {
  let fixture: ComponentFixture<LayoutComponent>;
  let router: Router;

  const root = () => fixture.nativeElement as HTMLElement;
  const activeLinks = () => [...root().querySelectorAll('.layout-sidebar-link-active')];
  const currentPageLinks = () => [...root().querySelectorAll('.layout-sidebar a[aria-current="page"]')];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        provideNoopAnimations(),
        MessageService,
        provideRouter([{ path: '**', component: StubPageComponent }]),
        {
          provide: AuthService,
          useValue: {
            user: signal({ email: 'owner@example.com', role: 'owner' }),
            business: signal({ name: 'Demo', slug: 'demo-salon' }),
            isSuperAdmin: () => false,
            isImpersonating: signal(false),
            activeBusinessName: signal('Demo'),
            businessTimezone: signal('Asia/Jerusalem'),
            logout: () => undefined,
          },
        },
        { provide: ThemeService, useValue: { mode: signal('light'), cssVars: signal({}) } },
        { provide: AppointmentsApiService, useValue: { appointments$: of([]) } },
        { provide: AdminApiService, useValue: {} },
        { provide: GrowthBrainService, useValue: {} },
        { provide: Store, useValue: { dispatch: () => undefined, select: () => of([]) } },
      ],
    }).compileComponents();
    TestBed.inject(LanguageService).setLanguage('en');
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(LayoutComponent);
    fixture.detectChanges();
  });

  async function visit(url: string): Promise<void> {
    await router.navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('covers every owner route the app registers', () => {
    // A new owner route that is missing here has no sidebar rule and no test.
    expect(ownerTopLevelPaths().sort()).toEqual([...Object.keys(OWNER_ROUTE_FILES), 'preview/customer-site'].sort());
    expect(OWNER_URLS).toContain('/settings/landing');
    expect(OWNER_URLS).toContain('/settings/account');
    expect(OWNER_URLS).toContain('/appointments/abc123/edit');
    expect(OWNER_URLS.length).toBeGreaterThan(20);
  });

  it('has exactly one active item and one current page on every owner route', async () => {
    for (const url of OWNER_URLS) {
      await visit(url);
      const active = activeLinks().map((link) => link.getAttribute('href'));
      expect(active.length).withContext(`${url} active: ${active.join(', ')}`).toBe(1);
      expect(currentPageLinks().length).withContext(`${url} aria-current`).toBe(1);
      expect(currentPageLinks()[0]).withContext(url).toBe(activeLinks()[0]);
      expect(sidebarItemForUrl(url)).withContext(url).not.toBeNull();
    }
  });

  it('keeps Settings off the landing and account pages, and each of them on its own', async () => {
    const hrefOfActive = async (url: string) => {
      await visit(url);
      return activeLinks().map((link) => link.getAttribute('href'));
    };
    expect(await hrefOfActive('/settings/landing')).toEqual(['/settings/landing']);
    expect(await hrefOfActive('/settings/account')).toEqual(['/settings/account']);
    expect(await hrefOfActive('/settings/booking')).toEqual(['/settings']);
    expect(await hrefOfActive('/settings/theme')).toEqual(['/settings']);
    expect(await hrefOfActive('/settings')).toEqual(['/settings']);
  });

  it('titles the account and landing pages with their own names', async () => {
    const title = () => root().querySelector('.layout-topbar-title')?.textContent?.trim();
    await visit('/settings/account');
    expect(title()).toBe('Account');
    await visit('/settings/landing');
    expect(title()).toBe('Landing Page');
    await visit('/settings/design');
    expect(title()).toBe('Settings');
  });
});
