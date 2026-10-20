import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { ApiService } from '../../../../../core/api/api.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import type { SettingsDefaults } from '../../../../../core/config/settings-defaults';
import { LanguageService } from '../../../../../core/i18n/language.service';
import { SettingsResetService } from '../../business-settings/reset/settings-reset.service';
import { PublicThemeEditorComponent } from './public-theme-editor.component';

const DEFAULTS = {
  theme: {
    preset: 'prime-pink',
    defaultMode: 'light',
    colors: { primary: '#F35271', secondary: '#FF9DBC', accent: '#6CD6CD', background: '#FFFFFF', text: '#111827' },
  },
} as unknown as SettingsDefaults;

describe('PublicThemeEditorComponent', () => {
  let fixture: ComponentFixture<PublicThemeEditorComponent>;
  let stored: ReturnType<typeof signal<Record<string, unknown> | null>>;
  let put: jasmine.Spy;
  let version: ReturnType<typeof signal<number>>;
  let init: jasmine.Spy;

  const root = () => fixture.nativeElement as HTMLElement;
  const shell = () => root().querySelector('.preview-shell') as HTMLElement;
  const token = (name: string) => shell().style.getPropertyValue(name).trim().toLowerCase();
  const saveButton = () => root().querySelector('app-settings-save-bar button') as HTMLButtonElement;

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function choose(name: string): Promise<void> {
    const radio = [...root().querySelectorAll<HTMLInputElement>('input[name="clientTheme"]')].find(
      (input) => input.closest('label')?.textContent?.includes(name)
    ) as HTMLInputElement;
    radio.click();
    await settle();
  }

  async function typeColor(id: string, value: string): Promise<void> {
    const input = root().querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  beforeEach(async () => {
    stored = signal<Record<string, unknown> | null>({
      preset: 'prime-pink',
      defaultMode: 'light',
      colors: { primary: '#F35271', secondary: '#FF9DBC', accent: '#6CD6CD', background: '#FFFFFF', text: '#111827' },
    });
    put = jasmine.createSpy('put').and.returnValue(of({}));
    version = signal(0);
    init = jasmine.createSpy('init').and.returnValue(of(undefined));
    await TestBed.configureTestingModule({
      imports: [PublicThemeEditorComponent],
      providers: [
        provideNoopAnimations(),
        MessageService,
        { provide: ApiService, useValue: { put } },
        {
          provide: AuthService,
          useValue: {
            businessSettings: () => ({ theme: stored() }),
            settingsDefaults: () => DEFAULTS,
            init,
          },
        },
        { provide: SettingsResetService, useValue: { version, refresh: () => undefined } },
      ],
    }).compileComponents();
    TestBed.inject(LanguageService).setLanguage('en');
    fixture = TestBed.createComponent(PublicThemeEditorComponent);
    await settle();
  });

  it('offers Prime Pink, Prime Mint and Custom, with the stored theme selected', () => {
    const options = [...root().querySelectorAll('input[name="clientTheme"]')] as HTMLInputElement[];
    expect(options.map((o) => o.closest('label')?.textContent?.trim())).toEqual(['Prime Pink', 'Prime Mint', 'Custom']);
    expect(options.filter((o) => o.checked).length).toBe(1);
    expect(options[0].checked).toBeTrue();
    expect(root().querySelector('app-color-field')).toBeNull();
  });

  it('starts on a stored custom theme with its three colors', async () => {
    stored.set({ preset: 'custom', defaultMode: 'dark', colors: { primary: '#1D4ED8', secondary: '#F59E0B', background: '#F8FAFC' } });
    version.update((v) => v + 1);
    await settle();
    expect((root().querySelector('#clientPrimary') as HTMLInputElement).value).toBe('#1D4ED8');
    expect((root().querySelector('#clientSecondary') as HTMLInputElement).value).toBe('#F59E0B');
    expect((root().querySelector('#clientBackground') as HTMLInputElement).value).toBe('#F8FAFC');
    // A dark default previews the dark variant: the same blue, lifted until it reads on a dark page.
    expect(shell().classList.contains('theme-dark')).toBeTrue();
    expect(token('--color-primary')).not.toBe('#1d4ed8');
    expect((root().querySelector('input[name="clientDefaultMode"][value="dark"]') as HTMLInputElement).checked).toBeTrue();
  });

  it('shows the custom colors only for Custom, with picker, hex field and swatches', async () => {
    await choose('Custom');
    const fields = root().querySelectorAll('app-color-field');
    expect(fields.length).toBe(3);
    for (const field of fields) {
      expect(field.querySelector('input[type="color"]')).not.toBeNull();
      expect(field.querySelector('input[type="text"]')).not.toBeNull();
      expect(field.querySelectorAll('.theme-preset').length).toBeGreaterThanOrEqual(5);
    }
    await choose('Prime Mint');
    expect(root().querySelector('app-color-field')).toBeNull();
  });

  it('updates the preview at once, while typing, before anything is saved', async () => {
    await choose('Custom');
    await typeColor('clientPrimary', '#1D4ED8');
    expect(token('--color-primary')).toBe('#1d4ed8');
    expect(token('--on-primary')).toBe('#ffffff');
    await typeColor('clientSecondary', '#F59E0B');
    expect(token('--color-secondary')).toBe('#f59e0b');
    await typeColor('clientBackground', '#F8FAFC');
    expect(token('--bg-app')).toBe('#f8fafc');
    expect(put).not.toHaveBeenCalled();
  });

  it('keeps the last good preview while a hex is half typed, and refuses to save it', async () => {
    await choose('Custom');
    await typeColor('clientPrimary', '#1D4ED8');
    await typeColor('clientPrimary', '#1D4E');
    expect(token('--color-primary')).toBe('#1d4ed8');
    expect(root().querySelector('#clientPrimary')?.getAttribute('aria-invalid')).toBe('true');
    expect(saveButton().disabled).toBeTrue();
  });

  it('previews dark mode, derived from the same colors, without touching the saved default', async () => {
    await choose('Custom');
    await typeColor('clientPrimary', '#1D4ED8');
    const light = token('--bg-app');
    (root().querySelector('input[name="previewMode"][value="dark"]') as HTMLInputElement).click();
    await settle();
    expect(shell().classList.contains('theme-dark')).toBeTrue();
    expect(token('--bg-app')).not.toBe(light);
    expect((root().querySelector('input[name="clientDefaultMode"][value="light"]') as HTMLInputElement).checked).toBeTrue();
  });

  it('warns when a custom color is too faint to read as text on the page', async () => {
    await choose('Custom');
    await typeColor('clientPrimary', '#FFFF00');
    expect(root().querySelector('#clientPrimary-warning')?.textContent).toContain('too light');
    await typeColor('clientPrimary', '#1D4ED8');
    expect(root().querySelector('#clientPrimary-warning')).toBeNull();
  });

  it('keeps the preview tokens inside the preview: nothing leaks to the page or the owner UI', async () => {
    const before = getComputedStyle(document.documentElement).getPropertyValue('--color-primary');
    const hostBefore = getComputedStyle(root()).getPropertyValue('--color-primary');
    await choose('Custom');
    await typeColor('clientPrimary', '#1D4ED8');
    await typeColor('clientBackground', '#101010');
    expect(token('--color-primary')).toBe('#1d4ed8');
    expect(getComputedStyle(document.documentElement).getPropertyValue('--color-primary')).toBe(before);
    expect(getComputedStyle(root()).getPropertyValue('--color-primary')).toBe(hostBefore);
    expect(document.documentElement.style.getPropertyValue('--bg-app')).toBe('');
    expect(document.body.style.getPropertyValue('--color-primary')).toBe('');
    // Only the frame carries the tokens, and it is not a second page to tab through.
    expect(shell().hasAttribute('inert')).toBeTrue();
    expect(shell().getAttribute('aria-hidden')).toBe('true');
    expect(root().querySelectorAll('[style*="--color-primary"]').length).toBe(1);
  });

  it('renders the real public components in the preview', () => {
    for (const selector of [
      'app-public-topbar',
      'app-public-landing-next-appointment',
      'app-public-appointment-card',
      'app-public-landing-booking-cta',
      'app-public-landing-services',
      'app-public-time-slots',
    ]) {
      expect(shell().querySelector(selector)).withContext(selector).not.toBeNull();
    }
    expect(shell().querySelector('.p-tag')).not.toBeNull();
    expect(shell().querySelectorAll('.book-slot-btn').length).toBeGreaterThanOrEqual(4);
    expect(shell().querySelector('.pl-svc__card')).not.toBeNull();
  });

  it('saves the whole theme and applies it to the site at once', async () => {
    expect(saveButton().disabled).toBeTrue();
    await choose('Custom');
    await typeColor('clientPrimary', '#1D4ED8');
    (root().querySelector('input[name="clientDefaultMode"][value="dark"]') as HTMLInputElement).click();
    await settle();
    expect(saveButton().disabled).toBeFalse();

    root().querySelector('form')?.dispatchEvent(new Event('submit'));
    await settle();
    expect(put).toHaveBeenCalledOnceWith('settings/me/public-theme', {
      preset: 'custom',
      defaultMode: 'dark',
      colors: { primary: '#1D4ED8', secondary: '#FF9DBC', background: '#FFFFFF' },
    });
    expect(init).toHaveBeenCalled();
    expect(saveButton().disabled).toBeTrue();
  });

  it('sends only the preset and mode for a preset theme', async () => {
    await choose('Prime Mint');
    root().querySelector('form')?.dispatchEvent(new Event('submit'));
    await settle();
    const body = put.calls.mostRecent().args[1] as Record<string, unknown>;
    expect(body['preset']).toBe('prime-mint');
    expect(body['defaultMode']).toBe('light');
  });

  it('reloads the stored theme after a factory reset or a restore', async () => {
    await choose('Custom');
    await typeColor('clientPrimary', '#1D4ED8');
    stored.set({ preset: 'prime-pink', defaultMode: 'light', colors: DEFAULTS.theme.colors });
    version.update((v) => v + 1);
    await settle();
    expect((root().querySelectorAll('input[name="clientTheme"]')[0] as HTMLInputElement).checked).toBeTrue();
    expect(saveButton().disabled).toBeTrue();
  });
});
