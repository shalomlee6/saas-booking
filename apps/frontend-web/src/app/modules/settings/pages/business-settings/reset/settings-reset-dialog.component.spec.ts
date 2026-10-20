import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { Subject, of, throwError } from 'rxjs';
import { LanguageService } from '../../../../../core/i18n/language.service';
import { SettingsResetDialogComponent } from './settings-reset-dialog.component';
import { SettingsResetService, type ResetScope } from './settings-reset.service';

describe('SettingsResetDialogComponent', () => {
  let fixture: ComponentFixture<SettingsResetDialogComponent>;
  let reset: jasmine.Spy;

  // The dialog renders into <body>, outside the fixture.
  const dialog = () => document.querySelector('.settings-reset-dialog') as HTMLElement | null;
  const confirmButton = () => dialog()?.querySelector('.reset-btn-danger') as HTMLButtonElement;
  const typedInput = () => dialog()?.querySelector('#settings-reset-confirm') as HTMLInputElement | null;

  async function open(scope: ResetScope): Promise<void> {
    fixture.componentRef.setInput('scope', scope);
    fixture.componentRef.setInput('visible', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function type(value: string): Promise<void> {
    const input = typedInput() as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    reset = jasmine.createSpy('reset').and.returnValue(of({}));
    await TestBed.configureTestingModule({
      imports: [SettingsResetDialogComponent],
      providers: [provideNoopAnimations(), MessageService, { provide: SettingsResetService, useValue: { reset } }],
    }).compileComponents();
    TestBed.inject(LanguageService).setLanguage('en');
    fixture = TestBed.createComponent(SettingsResetDialogComponent);
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('lists everything a full reset changes, and what it keeps', async () => {
    await open('all');
    const items = [...(dialog()?.querySelectorAll('.reset-list li') ?? [])].map((li) => li.textContent?.trim());
    expect(items.length).toBe(6);
    expect(items.join(' ')).toContain('Online booking rules');
    expect(items.join(' ')).toContain('birthday');
    expect(dialog()?.querySelector('.reset-keep')?.textContent).toContain('Customers, appointments');
    expect(dialog()?.querySelector('.reset-keep')?.textContent).toContain('working hours');
  });

  it('lists only that section for a section reset, with no typing step', async () => {
    await open('design');
    const items = [...(dialog()?.querySelectorAll('.reset-list li') ?? [])];
    expect(items.length).toBe(2);
    expect(typedInput()).toBeNull();
    expect(confirmButton().disabled).toBeFalse();
  });

  it('keeps a full reset disabled until the word is typed', async () => {
    await open('all');
    expect(confirmButton().disabled).toBeTrue();
    await type('maybe');
    expect(confirmButton().disabled).toBeTrue();
    await type('איפוס');
    expect(confirmButton().disabled).toBeFalse();
    await type(' Reset ');
    expect(confirmButton().disabled).toBeFalse();
  });

  it('sends the scope and the typed word, then closes', async () => {
    await open('all');
    await type('reset');
    confirmButton().click();
    fixture.detectChanges();
    expect(reset).toHaveBeenCalledOnceWith('all', 'reset');
    expect(fixture.componentInstance.visible()).toBeFalse();
  });

  it('sends only the scope for a section', async () => {
    await open('booking');
    confirmButton().click();
    expect(reset).toHaveBeenCalledOnceWith('booking', undefined);
  });

  it('stays open and shows an error when the reset fails', async () => {
    reset.and.returnValue(throwError(() => new Error('nope')));
    await open('reliability');
    confirmButton().click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.visible()).toBeTrue();
    expect(dialog()?.querySelector('.reset-error')?.textContent).toContain('failed');
  });

  it('blocks a second click while the reset is running', async () => {
    const pending = new Subject<unknown>();
    reset.and.returnValue(pending);
    await open('customers');
    confirmButton().click();
    fixture.detectChanges();
    expect(confirmButton().disabled).toBeTrue();
    confirmButton().click();
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
