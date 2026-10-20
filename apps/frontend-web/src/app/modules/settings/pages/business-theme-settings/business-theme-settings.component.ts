import { Component, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import type { Observable } from 'rxjs';
import { ApiService } from '../../../../core/api/api.service';
import { ThemeService, type BusinessUi } from '../../../../core/config/theme.service';
import { failsContrast, onContrastColor } from '../../../../core/theming/contrast-color';
import { AuthService } from '../../../../core/auth/auth.service';
import { LanguageService, type AppLanguage } from '../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { SettingsSaveBarComponent } from '../business-settings/settings-save-bar.component';
import { PublicThemeEditorComponent } from './public-theme/public-theme-editor.component';
import { SettingsResetService } from '../business-settings/reset/settings-reset.service';
import { SettingsSectionResetComponent } from '../business-settings/reset/settings-section-reset.component';

type ColorField = 'primaryColor' | 'sidebarColor';

interface ThemeFormValue {
  themeMode: 'light' | 'dark';
  primaryColor: string;
  sidebarColor: string;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

@Component({
  selector: 'app-business-theme-settings',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TabsModule,
    TranslatePipe,
    SettingsSaveBarComponent,
    SettingsSectionResetComponent,
    PublicThemeEditorComponent,
  ],
  templateUrl: './business-theme-settings.component.html',
  styleUrls: ['../business-settings/settings-section.scss', './business-theme-settings.component.scss'],
})
export class BusinessThemeSettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  readonly language = inject(LanguageService);
  private readonly reset = inject(SettingsResetService);

  /** The server's defaults (from /auth/me): the only place a fallback value comes from. */
  readonly uiDefaults = this.auth.settingsDefaults()?.ui;
  private readonly initial: ThemeFormValue = {
    // The mode literal is only reached if /auth/me carried no defaults, which it always does.
    themeMode: this.auth.business()?.ui?.themeMode ?? this.uiDefaults?.themeMode ?? 'light',
    primaryColor: this.auth.business()?.ui?.primaryColor ?? this.uiDefaults?.primaryColor ?? '',
    sidebarColor: this.auth.business()?.ui?.sidebarColor ?? this.uiDefaults?.sidebarColor ?? '',
  };
  readonly form: FormGroup = this.fb.group({
    themeMode: [this.initial.themeMode],
    primaryColor: [this.initial.primaryColor],
    sidebarColor: [this.initial.sidebarColor],
  });
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  /** The design page has two editors: the management system (this form) and the client site. */
  readonly tab = signal<'backoffice' | 'client'>('backoffice');
  readonly primaryPresets = ['#4F46E5', '#0D9488', '#E11D48', '#B45309', '#047857', '#7C3AED'];
  readonly sidebarPresets = ['#0F172A', '#1E293B', '#312E81', '#134E4A', '#4C1D95', '#18181B'];

  private readonly saved = signal<ThemeFormValue>(this.initial);
  private readonly value: Signal<ThemeFormValue> = toSignal(this.form.valueChanges as Observable<ThemeFormValue>, {
    initialValue: this.initial,
  });

  readonly dirty = computed(() => JSON.stringify(this.value()) !== JSON.stringify(this.saved()));
  readonly primarySwatch = computed(() => this.swatch(this.value().primaryColor, this.uiDefaults?.primaryColor ?? ''));
  readonly sidebarSwatch = computed(() => this.swatch(this.value().sidebarColor, this.uiDefaults?.sidebarColor ?? ''));
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

  constructor() {
    // After a factory reset or a restore the admin theme has changed on the server: show it here.
    effect(() => {
      this.reset.version();
      untracked(() => this.showSavedUi());
    });
  }

  private showSavedUi(): void {
    const ui = this.auth.business()?.ui;
    const next: ThemeFormValue = {
      themeMode: ui?.themeMode ?? this.initial.themeMode,
      primaryColor: ui?.primaryColor ?? this.initial.primaryColor,
      sidebarColor: ui?.sidebarColor ?? this.initial.sidebarColor,
    };
    this.saved.set(next);
    this.form.reset(next);
  }

  onTab(value: string | number | undefined): void {
    this.tab.set(value === 'client' ? 'client' : 'backoffice');
  }

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
        this.reset.refresh();
      },
      error: (err) => {
        this.error.set(err?.error?.message || this.language.t('settings.saveError'));
        this.saving.set(false);
      },
    });
  }
}
