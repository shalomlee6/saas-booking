import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageService } from '../../../../core/i18n/language.service';
import { SettingsSaveBarComponent } from './settings-save-bar.component';

describe('SettingsSaveBarComponent', () => {
  let fixture: ComponentFixture<SettingsSaveBarComponent>;

  function root(): HTMLElement {
    return fixture.nativeElement;
  }

  function render(dirty: boolean, saving = false): void {
    fixture.componentRef.setInput('dirty', dirty);
    fixture.componentRef.setInput('saving', saving);
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SettingsSaveBarComponent] });
    TestBed.inject(LanguageService).setLanguage('en');
    fixture = TestBed.createComponent(SettingsSaveBarComponent);
  });

  it('says everything is saved and disables the button while clean', () => {
    render(false);
    const button = root().querySelector('button') as HTMLButtonElement;
    expect(root().querySelector('[role="status"]')?.textContent).toContain('All changes saved');
    expect(button.disabled).toBeTrue();
    expect(button.type).toBe('submit');
  });

  it('flags unsaved changes and enables the button once dirty', () => {
    render(true);
    const button = root().querySelector('button') as HTMLButtonElement;
    expect(root().querySelector('[role="status"]')?.textContent).toContain('You have unsaved changes');
    expect(button.disabled).toBeFalse();
    expect(button.textContent?.trim()).toBe('Save changes');
  });

  it('disables the button and shows progress while saving', () => {
    render(true, true);
    const button = root().querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBeTrue();
    expect(button.textContent?.trim()).not.toBe('Save changes');
  });
});
