import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { ApiService } from '../../../../core/api/api.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { BookingRulesSectionComponent } from './booking-rules-section.component';
import { SettingsResetService } from './reset/settings-reset.service';

const LOADED = {
  enabled: true,
  minLeadMinutes: 60,
  maxAdvanceDays: 60,
  bufferMinutes: 0,
  onlineDefaultStatus: 'confirmed',
  maxActiveAppointmentsPerClient: null,
  clientCanCancelOnline: true,
  cancellationWindowHours: 24,
};

describe('BookingRulesSectionComponent', () => {
  let fixture: ComponentFixture<BookingRulesSectionComponent>;
  let put: jasmine.Spy;
  let get: jasmine.Spy;
  let version: ReturnType<typeof signal<number>>;
  let refresh: jasmine.Spy;

  function root(): HTMLElement {
    return fixture.nativeElement;
  }

  function saveButton(): HTMLButtonElement {
    return root().querySelector('app-settings-save-bar button') as HTMLButtonElement;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    put = jasmine.createSpy('put').and.returnValue(of({}));
    get = jasmine.createSpy('get').and.returnValue(of({ booking: LOADED }));
    version = signal(0);
    refresh = jasmine.createSpy('refresh');
    await TestBed.configureTestingModule({
      imports: [BookingRulesSectionComponent],
      providers: [
        provideNoopAnimations(),
        MessageService,
        { provide: ApiService, useValue: { get, put } },
        { provide: SettingsResetService, useValue: { version, refresh, reset: () => of({}) } },
      ],
    }).compileComponents();
    TestBed.inject(LanguageService).setLanguage('en');
    fixture = TestBed.createComponent(BookingRulesSectionComponent);
    await settle();
  });

  it('gives every control a label and a hint', () => {
    const controls = root().querySelectorAll('select, input[type="number"], input[role="switch"]');
    expect(controls.length).toBe(7);
    for (const control of controls) {
      const id = control.getAttribute('id') as string;
      expect(root().querySelector(`label[for="${id}"]`)).withContext(id).not.toBeNull();
      expect(control.getAttribute('aria-describedby')).withContext(id).toBeTruthy();
    }
  });

  it('shows the online-booking toggle as an on switch', () => {
    const toggle = root().querySelector('#booking-enabled') as HTMLInputElement;
    expect(toggle.getAttribute('role')).toBe('switch');
    expect(toggle.checked).toBeTrue();
  });

  it('keeps Save disabled until something changes, then saves and goes clean again', async () => {
    expect(saveButton().disabled).toBeTrue();

    const buffer = root().querySelector('#booking-buffer') as HTMLSelectElement;
    buffer.value = buffer.options[2].value;
    buffer.dispatchEvent(new Event('change'));
    await settle();
    expect(saveButton().disabled).toBeFalse();
    expect(root().querySelector('[role="status"]')?.textContent).toContain('unsaved');

    root().querySelector('form')?.dispatchEvent(new Event('submit'));
    await settle();
    expect(put).toHaveBeenCalledOnceWith(
      'settings/me/booking-rules',
      jasmine.objectContaining({ bufferMinutes: 10 })
    );
    expect(saveButton().disabled).toBeTrue();
    expect(root().querySelector('[role="status"]')?.textContent).toContain('All changes saved');
  });

  it('reloads its values after a factory reset or a restore', async () => {
    expect(get).toHaveBeenCalledTimes(1);
    get.and.returnValue(of({ booking: { ...LOADED, bufferMinutes: 10, enabled: false } }));
    version.update((value) => value + 1);
    await settle();
    expect(get).toHaveBeenCalledTimes(2);
    expect((root().querySelector('#booking-buffer') as HTMLSelectElement).value).toContain('10');
    expect(saveButton().disabled).toBeTrue();
  });

  it('asks again whether a snapshot can be restored after saving', async () => {
    const buffer = root().querySelector('#booking-buffer') as HTMLSelectElement;
    buffer.value = buffer.options[2].value;
    buffer.dispatchEvent(new Event('change'));
    await settle();
    root().querySelector('form')?.dispatchEvent(new Event('submit'));
    await settle();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('has its own restore-defaults button for the booking section', () => {
    const button = root().querySelector('app-settings-section-reset button');
    expect(button?.textContent?.trim()).toBe('Restore defaults');
  });
});
