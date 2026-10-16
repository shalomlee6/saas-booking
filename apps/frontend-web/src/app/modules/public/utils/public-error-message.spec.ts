import { TestBed } from '@angular/core/testing';
import { LanguageService } from '../../../core/i18n/language.service';
import { publicErrorTranslationKey } from './public-error-message';

describe('public error codes', () => {
  it('maps a known code to the translated sentence and ignores the server text', () => {
    TestBed.configureTestingModule({});
    const language = TestBed.inject(LanguageService);
    language.setLanguage('he');
    const err = {
      code: 'OUTSIDE_CANCELLATION_WINDOW',
      message: 'This appointment can no longer be changed online',
    };
    const text = language.t(publicErrorTranslationKey(err));
    expect(text).toBe(
      'לא ניתן לבטל או לשנות את התור באופן מקוון. לביטול או שינוי, נא ליצור קשר עם העסק.'
    );
    expect(text.includes('changed online')).toBe(false);

    language.setLanguage('en');
    expect(language.t(publicErrorTranslationKey(err))).toBe(
      "This appointment can't be cancelled or changed online. Please contact the business."
    );
  });

  it('uses the fallback key when the code is missing or unknown', () => {
    TestBed.configureTestingModule({});
    const language = TestBed.inject(LanguageService);
    language.setLanguage('en');
    expect(publicErrorTranslationKey({ message: 'raw server message' })).toBe('publicErrors.unknown');
    expect(publicErrorTranslationKey({ code: 'NOT_A_REAL_CODE', message: 'raw server message' })).toBe(
      'publicErrors.unknown'
    );
    expect(language.t('publicErrors.unknown')).toBe('Something went wrong. Please try again.');
    expect(language.t(publicErrorTranslationKey({ code: 'SLOT_TAKEN', message: 'Time slot is no longer available' }))).toBe(
      'That time was just taken. Pick another.'
    );
  });
});
