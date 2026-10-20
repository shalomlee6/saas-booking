import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { LanguageService } from '../../../../../core/i18n/language.service';
import { SettingsResetService, type ResetStatus } from './settings-reset.service';
import { SettingsUndoBannerComponent } from './settings-undo-banner.component';

describe('SettingsUndoBannerComponent', () => {
  let fixture: ComponentFixture<SettingsUndoBannerComponent>;
  let status: ReturnType<typeof signal<ResetStatus>>;
  let restore: jasmine.Spy;
  let refresh: jasmine.Spy;

  const root = () => fixture.nativeElement as HTMLElement;
  const button = () => root().querySelector('button') as HTMLButtonElement | null;

  beforeEach(async () => {
    status = signal<ResetStatus>({ available: false });
    restore = jasmine.createSpy('restore').and.returnValue(of(undefined));
    refresh = jasmine.createSpy('refresh');
    await TestBed.configureTestingModule({
      imports: [SettingsUndoBannerComponent],
      providers: [MessageService, { provide: SettingsResetService, useValue: { status, restore, refresh } }],
    }).compileComponents();
    TestBed.inject(LanguageService).setLanguage('en');
    fixture = TestBed.createComponent(SettingsUndoBannerComponent);
    fixture.detectChanges();
  });

  it('shows nothing until a reset left a snapshot', () => {
    expect(button()).toBeNull();
    status.set({ available: true, scope: 'all' });
    fixture.detectChanges();
    expect(button()?.textContent?.trim()).toBe('Restore previous settings');
    expect(root().querySelector('[role="status"]')).not.toBeNull();
  });

  it('restores the snapshot when asked', () => {
    status.set({ available: true, scope: 'all' });
    fixture.detectChanges();
    button()?.click();
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it('re-checks the status when the snapshot is no longer valid', () => {
    restore.and.returnValue(throwError(() => new Error('stale')));
    status.set({ available: true, scope: 'booking' });
    fixture.detectChanges();
    button()?.click();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
