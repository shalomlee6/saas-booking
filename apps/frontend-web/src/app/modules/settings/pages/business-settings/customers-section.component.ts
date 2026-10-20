import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../../../core/api/api.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { SettingsSaveBarComponent } from './settings-save-bar.component';
import { SettingsResetService } from './reset/settings-reset.service';
import { SettingsSectionResetComponent } from './reset/settings-section-reset.component';

type BirthdayField = 'required' | 'optional' | 'hidden';

@Component({
  selector: 'app-customers-settings-section',
  standalone: true,
  imports: [FormsModule, TranslatePipe, SettingsSaveBarComponent, SettingsSectionResetComponent],
  templateUrl: './customers-section.component.html',
  styleUrl: './settings-section.scss',
})
export class CustomersSettingsSectionComponent {
  private readonly api = inject(ApiService);
  private readonly messages = inject(MessageService);
  private readonly reset = inject(SettingsResetService);
  readonly language = inject(LanguageService);
  readonly birthdayField = signal<BirthdayField>('required');
  private readonly saved = signal<BirthdayField>('required');
  readonly dirty = computed(() => this.birthdayField() !== this.saved());
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    // Loads on open, and again after a factory reset or a restore.
    effect(() => {
      this.reset.version();
      untracked(() => this.load());
    });
  }

  private load(): void {
    this.api.get<{ birthdayField: BirthdayField }>('customers/birthday-field').subscribe({
      next: (body) => {
        this.birthdayField.set(body.birthdayField);
        this.saved.set(body.birthdayField);
        this.error.set(null);
      },
      error: () => this.error.set(this.language.t('settings.loadFailed')),
    });
  }

  save(): void {
    this.saving.set(true);
    const sent = this.birthdayField();
    this.api.put('customers/birthday-field', { birthdayField: sent }).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(sent);
        this.reset.refresh();
        this.messages.add({ severity: 'success', summary: this.language.t('settings.saved') });
      },
      error: () => {
        this.saving.set(false);
        this.messages.add({ severity: 'error', summary: this.language.t('settings.saveError') });
      },
    });
  }
}
