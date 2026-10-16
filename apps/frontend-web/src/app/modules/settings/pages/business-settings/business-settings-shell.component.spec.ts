import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { LanguageService } from '../../../../core/i18n/language.service';
import { BusinessSettingsShellComponent } from './business-settings-shell.component';

@Component({ standalone: true, template: '<p class="stub">section</p>' })
class StubSectionComponent {}

describe('BusinessSettingsShellComponent', () => {
  let harness: RouterTestingHarness;
  let router: Router;

  function root(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  async function open(url: string): Promise<void> {
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BusinessSettingsShellComponent],
      providers: [
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

  it('lands on the first section instead of showing an empty hub', async () => {
    await open('/settings');
    expect(router.url).toBe('/settings/design');
  });
});
