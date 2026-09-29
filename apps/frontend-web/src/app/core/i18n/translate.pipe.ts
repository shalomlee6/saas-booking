import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from './language.service';

/**
 * `{{ 'navigation.dashboard' | translate }}` or `{{ 'a.b' | translate:{ n: count } }}`.
 * Impure so it re-evaluates on every change-detection cycle — the app uses zone.js, so
 * switching language (which triggers CD via a normal signal/event) refreshes every
 * translated string immediately without needing each component to react individually.
 */
@Pipe({ name: 'translate', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly lang = inject(LanguageService);

  transform(key: string | null | undefined, params?: Record<string, string | number>): string {
    if (!key) return '';
    return this.lang.t(key, params);
  }
}
