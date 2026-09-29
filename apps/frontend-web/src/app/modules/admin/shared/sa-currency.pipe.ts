import { Pipe, PipeTransform } from '@angular/core';

/**
 * The app's global LOCALE_ID is 'he' (for the Hebrew business/customer UI),
 * so Angular's built-in `currency` pipe silently injects RTL marks (U+200F)
 * into every formatted amount — invisible but breaks copy-paste and, in some
 * fonts, visibly reorders the symbol. The super-admin panel is English/LTR
 * throughout, so every money value here is forced through one fixed
 * en-US/ILS formatter instead of inheriting the app locale.
 */
const FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 0,
});

@Pipe({ name: 'saCurrency', standalone: true })
export class SaCurrencyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return FORMATTER.format(value ?? 0);
  }
}
