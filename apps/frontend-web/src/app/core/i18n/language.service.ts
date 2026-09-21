import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { TRANSLATIONS } from './translations';

export type AppLanguage = 'he' | 'en';

const STORAGE_KEY = 'sb_lang';

function resolveInitialLanguage(): AppLanguage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'he' || stored === 'en') return stored;
  } catch {
    /* localStorage unavailable (private mode, SSR, etc.) — fall through to default */
  }
  return 'he';
}

function getByPath(obj: unknown, path: string): string | undefined {
  const result = path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
  return typeof result === 'string' ? result : undefined;
}

/**
 * Single source of truth for the app's language + direction. Hebrew is the default for
 * new users; the choice persists in localStorage (same pattern as ThemeService's `sb_theme`)
 * and survives a refresh. Changing the language updates `<html lang/dir>` immediately,
 * which is what flips the entire application shell between RTL and LTR — no page-level
 * `dir` overrides exist anywhere else.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly doc = inject(DOCUMENT);

  readonly language = signal<AppLanguage>(resolveInitialLanguage());

  constructor() {
    effect(() => this.applyDocumentAttributes(this.language()));
  }

  get isRtl(): boolean {
    return this.language() === 'he';
  }

  /** For Angular pipes (`| date:format:tz:locale`) — Angular ships 'en-US' by default; 'he' is registered explicitly in app.config.ts. */
  readonly pipeLocale = computed(() => (this.language() === 'he' ? 'he' : 'en-US'));

  /** For direct `Intl.*` usage where a full BCP-47 tag is expected. */
  readonly intlLocale = computed(() => (this.language() === 'he' ? 'he-IL' : 'en-US'));

  setLanguage(lang: AppLanguage): void {
    if (lang === this.language()) return;
    this.language.set(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* best-effort persistence only */
    }
  }

  private applyDocumentAttributes(lang: AppLanguage): void {
    const html = this.doc.documentElement;
    html.lang = lang;
    html.dir = lang === 'he' ? 'rtl' : 'ltr';
  }

  /**
   * Looks up a dot-path key (e.g. "navigation.dashboard") in the current language.
   * Falls back to Hebrew, then to the raw key itself, so a missing translation is
   * visible/debuggable rather than silently blank.
   */
  /** Labels for `friendlyOwnerAppointmentError` in the active language. */
  get ownerAppointmentErrorLabels() {
    return {
      slotTaken: this.t('appointments.errSlotTaken'),
      closedDay: this.t('appointments.errClosedDay'),
      outsideHours: this.t('appointments.errOutsideHours'),
      fallback: this.t('appointments.errFallback'),
    };
  }

  t(key: string, params?: Record<string, string | number>): string {
    const value =
      getByPath(TRANSLATIONS[this.language()], key) ?? getByPath(TRANSLATIONS.he, key) ?? key;
    if (!params) return value;
    return Object.entries(params).reduce(
      (acc, [k, v]) => acc.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(v)),
      value
    );
  }
}
