import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../../../../core/auth/auth.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { SettingsResetService, type ResetStatus } from './reset/settings-reset.service';
import { BusinessSettingsShellComponent } from './business-settings-shell.component';

@Component({ standalone: true, template: '<p class="stub">section</p>' })
class StubSectionComponent {}

describe('BusinessSettingsShellComponent', () => {
  let harness: RouterTestingHarness;
  let router: Router;
  let role: ReturnType<typeof signal<string>>;
  let resetStatus: ReturnType<typeof signal<ResetStatus>>;
  let refresh: jasmine.Spy;

  function root(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  async function open(url: string): Promise<void> {
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  beforeEach(async () => {
    role = signal('owner');
    resetStatus = signal<ResetStatus>({ available: false });
    refresh = jasmine.createSpy('refresh');
    await TestBed.configureTestingModule({
      imports: [BusinessSettingsShellComponent],
      providers: [
        provideNoopAnimations(),
        MessageService,
        provideRouter([
          {
            path: 'settings',
            component: BusinessSettingsShellComponent,
            children: ['design', 'hours', 'booking', 'reliability', 'customers', 'policy'].map((path) => ({
              path,
              component: StubSectionComponent,
            })),
          },
        ]),
        {
          provide: AuthService,
          useValue: {
            user: () => ({ role: role() }),
            isSuperAdmin: () => false,
            isImpersonating: () => false,
          },
        },
        {
          provide: SettingsResetService,
          useValue: { status: resetStatus, refresh, restore: () => undefined, version: signal(0) },
        },
      ],
    }).compileComponents();
    TestBed.inject(LanguageService).setLanguage('en');
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  it('lists the six sections with a description each, under one h1', async () => {
    await open('/settings/design');
    expect(root().querySelectorAll('h1').length).toBe(1);
    const links = [...root().querySelectorAll('.settings-nav-link')];
    expect(links.length).toBe(6);
    for (const link of links) {
      expect(link.querySelector('.settings-nav-label')?.textContent?.trim()).toBeTruthy();
      expect(link.querySelector('.settings-nav-hint')?.textContent?.trim()).toBeTruthy();
    }
  });

  it('marks the open section as the current page and titles the detail from it', async () => {
    await open('/settings/booking');
    const active = root().querySelectorAll('.settings-nav-link-active');
    expect(active.length).toBe(1);
    expect(active[0].getAttribute('aria-current')).toBe('page');
    expect(active[0].getAttribute('href')).toBe('/settings/booking');
    expect(root().querySelector('.settings-detail-title')?.textContent?.trim()).toBe('Online booking');
    expect(root().querySelector('.settings-detail-lead')?.textContent?.trim()).toBeTruthy();
  });

  it('puts the factory reset area at the bottom, after the open section', async () => {
    await open('/settings/booking');
    const zone = root().querySelector('.settings-danger app-settings-danger-zone');
    expect(zone).not.toBeNull();
    expect(zone?.querySelector('.danger-zone-title')?.textContent?.trim()).toBe('Factory reset');
    const detail = root().querySelector('.settings-detail') as HTMLElement;
    expect(detail.compareDocumentPosition(zone as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(refresh).toHaveBeenCalled();
  });

  it('offers the previous settings only while a snapshot exists', async () => {
    await open('/settings/design');
    expect(root().querySelector('app-settings-undo-banner button')).toBeNull();
    resetStatus.set({ available: true, scope: 'all' });
    harness.detectChanges();
    expect(root().querySelector('app-settings-undo-banner button')?.textContent?.trim()).toBe('Restore previous settings');
  });

  it('shows no reset area to anyone but the owner, and does not ask for a snapshot', async () => {
    role.set('staff');
    await open('/settings/design');
    expect(root().querySelector('app-settings-danger-zone')).toBeNull();
    expect(root().querySelector('app-settings-undo-banner')).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('lands on the first section instead of showing an empty hub', async () => {
    await open('/settings');
    expect(router.url).toBe('/settings/design');
  });
});
