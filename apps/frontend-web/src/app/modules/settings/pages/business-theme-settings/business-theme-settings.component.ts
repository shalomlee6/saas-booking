import { Component, Signal, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import type { Observable } from 'rxjs';
import { ApiService } from '../../../../core/api/api.service';
import { ThemeService, type BusinessUi } from '../../../../core/config/theme.service';
import { failsContrast, onContrastColor } from '../../../../core/theming/contrast-color';
import { AuthService } from '../../../../core/auth/auth.service';
import { LanguageService, type AppLanguage } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { SettingsSaveBarComponent } from '../business-settings/settings-save-bar.component';

type ColorField = 'primaryColor' | 'sidebarColor';

interface ThemeFormValue {
  themeMode: 'light' | 'dark';
  primaryColor: string;
  sidebarColor: string;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;
const DEFAULT_PRIMARY = '#4F46E5';
const DEFAULT_SIDEBAR = '#0F172A';

@Component({
  selector: 'app-business-theme-settings',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, SettingsSaveBarComponent],
  templateUrl: './business-theme-settings.component.html',
  styleUrls: ['../business-settings/settings-section.scss', './business-theme-settings.component.scss'],
})
export class BusinessThemeSettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  readonly language = inject(LanguageService);

  private readonly initial: ThemeFormValue = {
    themeMode: this.auth.business()?.ui?.themeMode ?? 'light',
    primaryColor: this.auth.business()?.ui?.primaryColor ?? DEFAULT_PRIMARY,
    sidebarColor: this.auth.business()?.ui?.sidebarColor ?? DEFAULT_SIDEBAR,
  };
  readonly form: FormGroup = this.fb.group({
    themeMode: [this.initial.themeMode],
    primaryColor: [this.initial.primaryColor],
    sidebarColor: [this.initial.sidebarColor],
  });
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly primaryPresets = ['#4F46E5', '#0D9488', '#E11D48', '#B45309', '#047857', '#7C3AED'];
  readonly sidebarPresets = ['#0F172A', '#1E293B', '#312E81', '#134E4A', '#4C1D95', '#18181B'];

  private readonly saved = signal<ThemeFormValue>(this.initial);
  private readonly value: Signal<ThemeFormValue> = toSignal(this.form.valueChanges as Observable<ThemeFormValue>, {
    initialValue: this.initial,
  });

  readonly dirty = computed(() => JSON.stringify(this.value()) !== JSON.stringify(this.saved()));
  readonly primarySwatch = computed(() => this.swatch(this.value().primaryColor, DEFAULT_PRIMARY));
  readonly sidebarSwatch = computed(() => this.swatch(this.value().sidebarColor, DEFAULT_SIDEBAR));
  readonly primaryContrastFails = computed(() => {
    const { primaryColor, themeMode } = this.value();
    if (!HEX.test(primaryColor)) return false;
    return failsContrast(primaryColor, themeMode === 'dark' ? '#0d0d0f' : '#ffffff');
  });
  readonly sidebarContrastFails = computed(() => {
    const { sidebarColor } = this.value();
    if (!HEX.test(sidebarColor)) return false;
    return failsContrast('#ffffff', sidebarColor);
  });
  readonly previewPrimaryText = computed(() => onContrastColor(this.primarySwatch()));
  readonly previewSidebarText = computed(() => onContrastColor(this.sidebarSwatch()));
  readonly previewDark = computed(() => this.value().themeMode === 'dark');

  private swatch(value: string, fallback: string): string {
    return HEX.test(value) ? value : fallback;
  }

  setLanguage(lang: AppLanguage): void {
    this.language.setLanguage(lang);
  }

  setMode(mode: 'light' | 'dark'): void {
    this.form.patchValue({ themeMode: mode });
  }

  setColor(field: ColorField, value: string): void {
    this.form.patchValue({ [field]: value.toUpperCase() });
  }

  onColorInput(field: ColorField, event: Event): void {
    this.setColor(field, (event.target as HTMLInputElement).value);
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    const value = this.form.getRawValue() as ThemeFormValue;
    this.api.patch<{ ui: BusinessUi }>('business/ui', value).subscribe({
      next: (res) => {
        this.theme.applyBusinessUi(res.ui);
        this.saved.set(value);
        this.saving.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || this.language.t('settings.saveError'));
        this.saving.set(false);
      },
    });
  }
}
