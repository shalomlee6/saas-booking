import { contrastRatio, failsContrast, onContrastColor } from './contrast-color';

describe('onContrastColor', () => {
  it('picks dark text for the default pink so the header clears 4.5:1', () => {
    const text = onContrastColor('#F35271');
    expect(text).toBe('#000000');
    expect(contrastRatio(text, '#F35271')!).toBeGreaterThanOrEqual(4.5);
  });

  it('picks light text on a dark fill', () => {
    expect(onContrastColor('#111827')).toBe('#ffffff');
  });

  it('picks dark text for a pale mint', () => {
    const text = onContrastColor('#A8C5B0');
    expect(failsContrast(text, '#A8C5B0')).toBe(false);
  });
});
