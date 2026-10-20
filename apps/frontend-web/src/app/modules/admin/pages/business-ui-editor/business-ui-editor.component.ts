import { Component, Signal, computed, inject, signal, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AdminApiService } from '../../services/admin-api.service';
import { ThemeService } from '../../../../core/config/theme.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { THEME_PRESET_LIST } from '../../../../core/theming/theme-presets';
import { CUSTOM_THEME_PRESET_ID } from '../../../../core/theming/resolve-business-theme-vars';

@Component({
  selector: 'app-business-ui-editor',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './business-ui-editor.component.html',
  styleUrl: './business-ui-editor.component.scss',
})
export class BusinessUiEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly adminApi = inject(AdminApiService);
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);

  readonly form: FormGroup;
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly businessId = signal<string | null>(null);
  readonly businessName = signal<string>('');
  readonly themePresets = THEME_PRESET_LIST;
  /** Placeholders come from the server defaults too. */
  readonly uiDefaults = this.auth.settingsDefaults()?.ui;

  /** True while the public site theme is "custom": the three colors apply and are shown. */
  readonly isCustomPublicTheme = computed(() => this.publicPreset() === CUSTOM_THEME_PRESET_ID);

  constructor() {
    // Every starting value comes from the server's defaults (/auth/me), never from a copy kept here.
    const ui = this.auth.settingsDefaults()?.ui;
    const theme = this.auth.settingsDefaults()?.theme;
    this.form = this.fb.group({
      themeMode: [ui?.themeMode ?? ''],
      primaryColor: [ui?.primaryColor ?? ''],
      sidebarColor: [ui?.sidebarColor ?? ''],
      publicThemePreset: [theme?.preset ?? ''],
      publicThemeMode: [theme?.defaultMode ?? ''],
      publicPrimary: [theme?.colors.primary ?? ''],
      publicSecondary: [theme?.colors.secondary ?? ''],
      publicBackground: [theme?.colors.background ?? ''],
    });
    this.publicPreset = toSignal(this.form.controls['publicThemePreset'].valueChanges, {
      initialValue: this.form.controls['publicThemePreset'].value as string,
    });
  }

  private readonly publicPreset: Signal<string>;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/super-admin/businesses']);
      return;
    }
    this.businessId.set(id);
    this.loading.set(true);
    this.adminApi.listBusinesses().subscribe({
      next: (list) => {
        const b = list.find((x) => x._id === id);
        if (b) {
          this.businessName.set(b.name);
          const defaults = this.auth.settingsDefaults();
          const stored = b.settings?.theme;
          this.form.patchValue({
            themeMode: b.ui?.themeMode ?? defaults?.ui.themeMode,
            primaryColor: b.ui?.primaryColor ?? defaults?.ui.primaryColor,
            sidebarColor: b.ui?.sidebarColor ?? defaults?.ui.sidebarColor,
            publicThemePreset: stored?.preset ?? defaults?.theme.preset,
            publicThemeMode: stored?.defaultMode ?? defaults?.theme.defaultMode,
            publicPrimary: stored?.colors?.primary ?? defaults?.theme.colors.primary,
            publicSecondary: stored?.colors?.secondary ?? defaults?.theme.colors.secondary,
            publicBackground: stored?.colors?.background ?? defaults?.theme.colors.background,
          });
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load business');
        this.loading.set(false);
      },
    });
  }

  save(): void {
    const id = this.businessId();
    if (!id || this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    const value = this.form.getRawValue();
    const body = {
      themeMode: value.themeMode,
      primaryColor: value.primaryColor,
      sidebarColor: value.sidebarColor,
      // The same object the owner edits (settings -> design -> client site), validated the same way.
      publicTheme: {
        preset: value.publicThemePreset,
        defaultMode: value.publicThemeMode,
        ...(value.publicThemePreset === CUSTOM_THEME_PRESET_ID
          ? {
              colors: {
                primary: value.publicPrimary,
                secondary: value.publicSecondary,
                background: value.publicBackground,
              },
            }
          : {}),
      },
    };
    this.adminApi.updateBusinessUi(id, body).subscribe({
      next: (res) => {
        this.saving.set(false);
        const currentBusinessId = this.auth.user()?.businessId;
        if (currentBusinessId === id) {
          this.theme.applyBusinessUi(res.ui);
        }
        this.router.navigate(['/super-admin/businesses']);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Failed to save');
        this.saving.set(false);
      },
    });
  }
}
