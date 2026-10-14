import type { Translation } from 'primeng/api';
import { TRANSLATIONS } from './translations';

type AppLanguage = keyof typeof TRANSLATIONS;

function list(lang: AppLanguage, key: string): string[] {
  return TRANSLATIONS[lang].calendar[key].split(',');
}

/** PrimeNG calendar strings for the active app language. Sunday is day 0. */
export function primeNgCalendarTranslation(lang: AppLanguage): Translation {
  const calendar = TRANSLATIONS[lang].calendar;
  return {
    dayNames: list(lang, 'dayNames'),
    dayNamesShort: list(lang, 'dayNamesShort'),
    dayNamesMin: list(lang, 'dayNamesMin'),
    monthNames: list(lang, 'monthNames'),
    monthNamesShort: list(lang, 'monthNamesShort'),
    firstDayOfWeek: Number(calendar['firstDayOfWeek']),
    today: calendar['today'],
    clear: calendar['clear'],
    prevMonth: calendar['prevMonth'],
    nextMonth: calendar['nextMonth'],
    chooseMonth: calendar['chooseMonth'],
    chooseYear: calendar['chooseYear'],
  };
}
