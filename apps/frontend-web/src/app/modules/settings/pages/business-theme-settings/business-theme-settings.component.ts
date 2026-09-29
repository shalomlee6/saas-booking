import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/api/api.service';
import { ThemeService } from '../../../../core/config/theme.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { LanguageService, type AppLanguage } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-business-theme-settings',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './business-theme-settings.component.html',
  styleUrl: './business-theme-settings.component.scss',
})
export class BusinessThemeSettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  readonly language = inject(LanguageService);

  readonly form: FormGroup;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    const business = this.auth.business();
    this.form = this.fb.group({
      themeMode: [business?.ui?.themeMode ?? 'light'],
      primaryColor: [business?.ui?.primaryColor ?? '#F35271'],
      sidebarColor: [business?.ui?.sidebarColor ?? '#0F172A'],
    });
  }

  setLanguage(lang: AppLanguage): void {
    this.language.setLanguage(lang);
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    const value = this.form.getRawValue();
    this.api.patch<{ ui: unknown }>('business/ui', value).subscribe({
      next: (res) => {
        this.theme.applyBusinessUi(res.ui as any);
        this.saving.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || this.language.t('settings.saveError'));
        this.saving.set(false);
      },
    });
  }
}
