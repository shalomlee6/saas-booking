import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import type { SettingsDefaults } from '../../../../core/config/settings-defaults';
import { ThemeService } from '../../../../core/config/theme.service';
import { AdminApiService } from '../../services/admin-api.service';
import { BusinessUiEditorComponent } from './business-ui-editor.component';

const DEFAULTS = {
  ui: { themeMode: 'light', primaryColor: '#3787F6', sidebarColor: '#0F172A' },
  theme: {
    preset: 'prime-pink',
    defaultMode: 'light',
    colors: { primary: '#F35271', secondary: '#FF9DBC', background: '#FFFFFF' },
  },
} as unknown as SettingsDefaults;

describe('BusinessUiEditorComponent (super-admin "Edit Business UI")', () => {
  let fixture: ComponentFixture<BusinessUiEditorComponent>;
  let updateBusinessUi: jasmine.Spy;
  let navigate: jasmine.Spy;

  const root = () => fixture.nativeElement as HTMLElement;
  const field = (id: string) => root().querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function open(business: Record<string, unknown>): Promise<void> {
    updateBusinessUi = jasmine.createSpy('updateBusinessUi').and.returnValue(of({ ui: {} }));
    await TestBed.configureTestingModule({
      imports: [BusinessUiEditorComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', 'b1']]) } } },
        { provide: AdminApiService, useValue: { listBusinesses: () => of([business]), updateBusinessUi } },
        { provide: ThemeService, useValue: { applyBusinessUi: () => undefined } },
        { provide: AuthService, useValue: { settingsDefaults: signal(DEFAULTS), user: () => ({ businessId: 'other' }) } },
      ],
    }).compileComponents();
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(BusinessUiEditorComponent);
    await settle();
  }

  it('labels the three theme fields apart: owner portal mode, public site theme, public site mode', async () => {
    await open({ _id: 'b1', name: 'Biz', ui: {}, settings: { theme: {} } });
    const labels = [...root().querySelectorAll('label')].map((label) => label.textContent?.trim());
    expect(labels).toContain('Owner portal mode');
    expect(labels).toContain('Public site theme');
    expect(labels).toContain('Public site mode');
    expect(labels.filter((label) => label === 'Theme').length).toBe(0);
    expect(labels.filter((label) => label === 'Default mode').length).toBe(0);
  });

  it('fills missing values from the server defaults, not from a copy of its own', async () => {
    await open({ _id: 'b1', name: 'Biz', ui: {}, settings: { theme: {} } });
    expect(field('primaryColor').value).toBe('#3787F6');
    expect(field('sidebarColor').value).toBe('#0F172A');
    expect(field('publicThemePreset').value).toBe('prime-pink');
    expect(field('themeMode').value).toBe('light');
    expect((field('primaryColor') as HTMLInputElement).placeholder).toBe('#3787F6');
  });

  it('reads the same stored public theme the owner edits, including a custom one', async () => {
    await open({
      _id: 'b1',
      name: 'Biz',
      ui: { themeMode: 'dark', primaryColor: '#111111', sidebarColor: '#222222' },
      settings: {
        theme: { preset: 'custom', defaultMode: 'dark', colors: { primary: '#1D4ED8', secondary: '#F59E0B', background: '#F8FAFC' } },
      },
    });
    expect(field('publicThemePreset').value).toBe('custom');
    expect(field('publicThemeMode').value).toBe('dark');
    expect(field('publicPrimary').value).toBe('#1D4ED8');
    expect(field('publicSecondary').value).toBe('#F59E0B');
    expect(field('publicBackground').value).toBe('#F8FAFC');
  });

  it('hides the custom colors for a preset and sends only preset and mode', async () => {
    await open({ _id: 'b1', name: 'Biz', ui: {}, settings: { theme: { preset: 'prime-mint', defaultMode: 'light' } } });
    expect(root().querySelector('#publicPrimary')).toBeNull();
    root().querySelector('form')?.dispatchEvent(new Event('submit'));
    await settle();
    const body = updateBusinessUi.calls.mostRecent().args[1];
    expect(body.publicTheme).toEqual({ preset: 'prime-mint', defaultMode: 'light' });
    expect(navigate).toHaveBeenCalled();
  });

  it('sends the custom colors with the same shape the owner sends', async () => {
    await open({
      _id: 'b1',
      name: 'Biz',
      ui: {},
      settings: { theme: { preset: 'custom', defaultMode: 'light', colors: { primary: '#1D4ED8', secondary: '#F59E0B', background: '#F8FAFC' } } },
    });
    root().querySelector('form')?.dispatchEvent(new Event('submit'));
    await settle();
    const body = updateBusinessUi.calls.mostRecent().args[1];
    expect(body.publicTheme).toEqual({
      preset: 'custom',
      defaultMode: 'light',
      colors: { primary: '#1D4ED8', secondary: '#F59E0B', background: '#F8FAFC' },
    });
  });
});
