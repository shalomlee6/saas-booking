import { TestBed } from '@angular/core/testing';
import { PrimeNG, providePrimeNG } from 'primeng/config';
import { LanguageService } from './language.service';

describe('PrimeNG calendar locale', () => {
  it('follows the active language, with Sunday first in Hebrew', () => {
    TestBed.configureTestingModule({ providers: [providePrimeNG()] });
    const language = TestBed.inject(LanguageService);
    const prime = TestBed.inject(PrimeNG);

    language.setLanguage('he');
    TestBed.flushEffects();
    const hebrewMonths = prime.getTranslation('monthNames') as string[];
    const hebrewDays = prime.getTranslation('dayNamesMin') as string[];
    expect(hebrewMonths[9]).toBe('אוקטובר');
    expect(hebrewDays[0]).toBe('א׳');
    expect(hebrewDays[6]).toBe('ש׳');
    expect(prime.getTranslation('firstDayOfWeek')).toBe(0);
    expect(document.documentElement.dir).toBe('rtl');

    language.setLanguage('en');
    TestBed.flushEffects();
    const englishMonths = prime.getTranslation('monthNames') as string[];
    const englishDays = prime.getTranslation('dayNamesMin') as string[];
    expect(englishMonths[9]).toBe('October');
    expect(englishDays[0]).toBe('Su');
    expect(englishDays[1]).toBe('Mo');
    expect(prime.getTranslation('firstDayOfWeek')).toBe(0);
    expect(document.documentElement.dir).toBe('ltr');
  });
});
