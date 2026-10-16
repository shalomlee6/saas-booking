import { isIsraeliMobile, isRealBirthday, readyToBook } from './public-identity.rules';

describe('public identity rules', () => {
  it('skips identify only when the device already has a customer and no missing birthday', () => {
    expect(readyToBook(null)).toBe(false);
    expect(readyToBook({ verified: false, hasCustomer: false, needsBirthday: true })).toBe(false);
    expect(readyToBook({ verified: true, hasCustomer: true, needsBirthday: true })).toBe(false);
    expect(readyToBook({ verified: false, hasCustomer: true, needsBirthday: false })).toBe(true);
    expect(readyToBook({ verified: true, hasCustomer: true, needsBirthday: false, firstName: 'Noa' })).toBe(true);
  });

  it('accepts an Israeli mobile and a real day and month, including 29 February', () => {
    expect(isIsraeliMobile('0501111111')).toBe(true);
    expect(isIsraeliMobile('050111111')).toBe(false);
    expect(isIsraeliMobile('0212345678')).toBe(false);
    expect(isRealBirthday(29, 2)).toBe(true);
    expect(isRealBirthday(31, 4)).toBe(false);
    expect(isRealBirthday(15, 8)).toBe(true);
  });
});
