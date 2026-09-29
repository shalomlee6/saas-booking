import { Pipe, PipeTransform } from '@angular/core';

/** Same reasoning as SaCurrencyPipe: the app's global LOCALE_ID is 'he', so
 *  Angular's built-in `date` pipe renders Hebrew month names/formats even
 *  inside the English super-admin panel. These fixed en-US formatters are
 *  used instead wherever this module displays a date or timestamp. */
const DATE_FORMATS = {
  short: new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }),
  medium: new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }),
  mediumDate: new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }),
} as const;

export type SaDateFormat = keyof typeof DATE_FORMATS;

@Pipe({ name: 'saDate', standalone: true })
export class SaDatePipe implements PipeTransform {
  transform(value: string | Date | null | undefined, format: SaDateFormat = 'medium'): string {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return DATE_FORMATS[format].format(d);
  }
}
