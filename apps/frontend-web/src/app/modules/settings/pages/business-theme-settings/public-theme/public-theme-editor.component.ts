import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../../../../core/api/api.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { LanguageService } from '../../../../../core/i18n/language.service';
import { TranslatePipe } from '../../../../../core/i18n/translate.pipe';
import { failsOnSurface } from '../../../../../core/theming/custom-theme';
import { resolvePublicThemeVars, CUSTOM_THEME_PRESET_ID } from '../../../../../core/theming/resolve-business-theme-vars';
import { THEME_PRESET_LIST } from '../../../../../core/theming/theme-presets';
import { SettingsResetService } from '../../business-settings/reset/settings-reset.service';
import { SettingsSaveBarComponent } from '../../business-settings/settings-save-bar.component';
import { ColorFieldComponent } from './color-field.component';
import { PublicThemePreviewComponent } from './public-theme-preview.component';

type Mode = 'light' | 'dark';

interface ThemeDraft {
  preset: string;
  defaultMode: Mode;
  colors: { primary: string; secondary: string; background: string };
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Suggested swatches. Suggestions only: any hex works. */
const PRIMARY_SWATCHES = ['#F35271', '#1D4ED8', '#0D9488', '#7C3AED', '#E11D48', '#B45309'];
const SECONDARY_SWATCHES = ['#FF9DBC', '#F59E0B', '#14B8A6', '#A78BFA', '#FB7185', '#84CC16'];
const BACKGROUND_SWATCHES = ['#FFFFFF', '#F8FAFC', '#FFF7ED', '#F0FDF4', '#FDF2F8', '#EFF6FF'];

/**
 * Owner settings → design → "client site": the public site's theme (a preset or three custom colors) and
 * its default light/dark mode, with a live preview. Saving applies to the public site at once.
 */
@Component({
  selector: 'app-public-theme-editor',
  standalone: true,
  imports: [FormsModule, TranslatePipe, ColorFieldComponent, PublicThemePreviewComponent, SettingsSaveBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../../business-settings/settings-section.scss',
  styles: `
    .client-theme-dot {
      display: inline-block;
      inline-size: 0.875rem;
      block-size: 0.875rem;
      margin-inline-end: 0.375rem;
      border-radius: 50%;
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--text-primary) 35%, transparent);
    }

    .client-theme-dot-custom {
      background: conic-gradient(#e11d48, #f59e0b, #84cc16, #14b8a6, #3b82f6, #7c3aed, #e11d48);
    }

    .client-colors-note {
      margin: 0;
      padding: 0 1.25rem 0.75rem;
      color: var(--text-muted);
      font-size: 0.8125rem;
      line-height: 1.5;
    }

    .client-preview {
      padding: 0 1.25rem 1.25rem;
    }
  `,
  templateUrl: './public-theme-editor.component.html',
})
export class PublicThemeEditorComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);
  private readonly reset = inject(SettingsResetService);
  readonly language = inject(LanguageService);

  readonly presetOptions = THEME_PRESET_LIST;
  readonly customId = CUSTOM_THEME_PRESET_ID;
  readonly primarySwatches = PRIMARY_SWATCHES;
  readonly secondarySwatches = SECONDARY_SWATCHES;
  readonly backgroundSwatches = BACKGROUND_SWATCHES;

  readonly preset = signal('');
  readonly defaultMode = signal<Mode>('light');
  readonly primary = signal('');
  readonly secondary = signal('');
  readonly background = signal('');
  readonly previewMode = signal<Mode>('light');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  private readonly saved = signal<ThemeDraft | null>(null);

  readonly isCustom = computed(() => this.preset() === CUSTOM_THEME_PRESET_ID);
  readonly draft = computed<ThemeDraft>(() => ({
    preset: this.preset(),
    defaultMode: this.defaultMode(),
    colors: { primary: this.primary(), secondary: this.secondary(), background: this.background() },
  }));
  readonly colorsValid = computed(() =>
    [this.primary(), this.secondary(), this.background()].every((color) => HEX.test(color))
  );
  readonly dirty = computed(() => JSON.stringify(this.draft()) !== JSON.stringify(this.saved()));
  /** A custom theme needs three valid colors before it can be saved. */
  readonly canSave = computed(() => !this.isCustom() || this.colorsValid());

  /** The tokens the preview (and, once saved, the real site) gets. An unfinished hex keeps the last good preview. */
  readonly previewVars = computed(() =>
    resolvePublicThemeVars(
      { preset: this.preset(), colors: this.colorsValid() ? this.draft().colors : this.lastGoodColors() },
      this.previewMode()
    )
  );
  private readonly lastGoodColors = signal<ThemeDraft['colors']>({ primary: '', secondary: '', background: '' });

  readonly primaryWarning = computed(() => this.warning(this.primary()));
  readonly secondaryWarning = computed(() => this.warning(this.secondary()));

  constructor() {
    // Loads on open, and again after a factory reset or a restore.
    effect(() => {
      this.reset.version();
      untracked(() => this.showStored());
    });
    // Keeps the preview on the last complete set of colors while a hex is half typed.
    effect(() => {
      const colors = this.draft().colors;
      if (this.colorsValid()) untracked(() => this.lastGoodColors.set(colors));
    });
    // Picking the default mode also flips the preview to it.
    effect(() => {
      const mode = this.defaultMode();
      untracked(() => this.previewMode.set(mode));
    });
  }

  /** A custom color that is too light to read as text on the page it sits on (light mode) gets the same warning the backoffice editor shows. */
  private warning(color: string): string | null {
    if (!this.isCustom() || !HEX.test(color) || !HEX.test(this.background())) return null;
    return failsOnSurface(color, this.background()) ? this.language.t('settings.primaryContrastWarning') : null;
  }

  private showStored(): void {
    const stored = this.auth.businessSettings()?.theme;
    const defaults = this.auth.settingsDefaults()?.theme;
    const next: ThemeDraft = {
      preset: stored?.preset ?? defaults?.preset ?? '',
      defaultMode: stored?.defaultMode ?? defaults?.defaultMode ?? 'light',
      colors: {
        primary: (stored?.colors?.primary ?? defaults?.colors.primary ?? '').toUpperCase(),
        secondary: (stored?.colors?.secondary ?? defaults?.colors.secondary ?? '').toUpperCase(),
        background: (stored?.colors?.background ?? defaults?.colors.background ?? '').toUpperCase(),
      },
    };
    this.apply(next);
    this.saved.set(next);
  }

  private apply(next: ThemeDraft): void {
    this.preset.set(next.preset);
    this.defaultMode.set(next.defaultMode);
    this.primary.set(next.colors.primary);
    this.secondary.set(next.colors.secondary);
    this.background.set(next.colors.background);
  }

  save(): void {
    if (this.saving() || !this.canSave() || !this.dirty()) return;
    this.saving.set(true);
    this.error.set(null);
    const draft = this.draft();
    const body = {
      preset: draft.preset,
      defaultMode: draft.defaultMode,
      ...(this.colorsValid() ? { colors: draft.colors } : {}),
    };
    this.api.put('settings/me/public-theme', body).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(draft);
        // The landing page preview and the rest of the app read the stored theme from /auth/me.
        this.auth.init().subscribe();
        this.reset.refresh();
        this.messages.add({ severity: 'success', summary: this.language.t('settings.saved') });
      },
      error: () => {
        this.saving.set(false);
        this.error.set(this.language.t('settings.saveError'));
      },
    });
  }
}
