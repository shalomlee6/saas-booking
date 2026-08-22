import {
  collectProductRowIssues,
  isBlankProductRow,
  productRowIssue,
  toLandingProductsPayload,
  type LandingProductRowValue,
} from './landing-product-rows.util';

describe('landing product row validation', () => {
  const blank: LandingProductRowValue = { name: '', description: '', price: 0 };
  const named: LandingProductRowValue = { name: 'לק ג׳ל', description: '', price: 120 };

  it('treats a fresh empty product row as blank, not invalid', () => {
    expect(isBlankProductRow(blank)).toBeTrue();
    expect(productRowIssue(blank, 0)).toBeNull();
  });

  it('does not block save when a blank row sits next to valid products', () => {
    const rows = [named, blank];
    expect(collectProductRowIssues(rows)).toEqual([]);
    expect(toLandingProductsPayload(rows)).toEqual([
      { name: 'לק ג׳ל', description: '', price: 120 },
    ]);
  });

  it('flags a half-filled row (description/price without a name)', () => {
    const partial: LandingProductRowValue = {
      name: '',
      description: 'טיפול חדש',
      price: 80,
    };
    expect(isBlankProductRow(partial)).toBeFalse();
    expect(productRowIssue(partial, 1)).toContain('חסר שם');
    expect(collectProductRowIssues([named, partial]).length).toBe(1);
  });

  it('flags a negative price on a named product', () => {
    expect(productRowIssue({ name: 'שמן', description: '', price: -1 }, 0)).toContain('מחיר');
  });

  it('lets unrelated landing fields save: blank rows are dropped, valid rows kept', () => {
    const payload = toLandingProductsPayload([blank, named, { name: '  ', description: '', price: 0 }]);
    expect(payload).toEqual([{ name: 'לק ג׳ל', description: '', price: 120 }]);
    expect(collectProductRowIssues([blank, named])).toEqual([]);
  });
});
