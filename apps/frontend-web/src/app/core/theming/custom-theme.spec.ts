import { contrastRatio, failsContrast } from './contrast-color';
import { deriveCustomTheme, failsOnSurface, themeToVars, type CustomThemeColors, type ThemeMode } from './custom-theme';
import { resolvePublicThemeVars } from './resolve-business-theme-vars';

const AA = 4.5;

/** Small seeded PRNG so a failing input is the same on every run. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hex(next: () => number): string {
  return `#${Math.floor(next() * 0xffffff).toString(16).padStart(6, '0')}`;
}

const EXTREMES: CustomThemeColors[] = [
  { primary: '#000000', secondary: '#ffffff', background: '#ffffff' },
  { primary: '#ffffff', secondary: '#000000', background: '#000000' },
  { primary: '#777777', secondary: '#808080', background: '#7a7a7a' },
  { primary: '#ffff00', secondary: '#ffff00', background: '#ffff00' },
  { primary: '#ff0000', secondary: '#00ff00', background: '#0000ff' },
  { primary: '#2e2e2e', secondary: '#2e2e2e', background: '#2e2e2e' },
  { primary: '#bdbdbd', secondary: '#9e9e9e', background: '#aeaeae' },
];

function inputs(): CustomThemeColors[] {
  const next = random(20261019);
  const generated = Array.from({ length: 300 }, () => ({
    primary: hex(next),
    secondary: hex(next),
    background: hex(next),
  }));
  return [...EXTREMES, ...generated];
}

function ratio(a: string, b: string): number {
  return contrastRatio(a, b) ?? 0;
}

describe('deriveCustomTheme', () => {
  for (const mode of ['light', 'dark'] as ThemeMode[]) {
    it(`reaches 4.5:1 for text on color, ink on tint and page text, in ${mode} mode, for any input`, () => {
      const failures: string[] = [];
      const check = (label: string, value: number, colors: CustomThemeColors) => {
        if (value < AA) failures.push(`${label} ${value.toFixed(2)} for ${JSON.stringify(colors)}`);
      };
      for (const colors of inputs()) {
        const theme = deriveCustomTheme(colors, mode);
        const { app, card } = theme.surfaces;
        for (const [name, family] of [['primary', theme.primary], ['secondary', theme.secondary]] as const) {
          check(`${name} text on fill`, ratio(family.on, family.base), colors);
          check(`${name} text on hover`, ratio(family.on, family.hover), colors);
          check(`${name} ink on tint`, ratio(family.ink, family.subtle), colors);
          check(`${name} ink on page`, ratio(family.ink, app), colors);
          check(`${name} ink on card`, ratio(family.ink, card), colors);
        }
        for (const [name, color] of [
          ['text', theme.surfaces.textPrimary],
          ['secondary text', theme.surfaces.textSecondary],
          ['muted text', theme.surfaces.textMuted],
          ['placeholder', theme.surfaces.textPlaceholder],
        ] as const) {
          check(`${name} on page`, ratio(color, app), colors);
          check(`${name} on card`, ratio(color, card), colors);
        }
      }
      expect(failures.slice(0, 5)).toEqual([]);
    });
  }

  it('uses the chosen colors as they are in light mode', () => {
    const colors = { primary: '#1D4ED8', secondary: '#F59E0B', background: '#F8FAFC' };
    const theme = deriveCustomTheme(colors, 'light');
    expect(theme.primary.base).toBe('#1D4ED8');
    expect(theme.secondary.base).toBe('#F59E0B');
    expect(theme.surfaces.app).toBe('#F8FAFC');
  });

  it('derives a dark variant from the same colors: near-black page, lifted brand colors', () => {
    const colors = { primary: '#1D4ED8', secondary: '#7C2D12', background: '#FFFFFF' };
    const light = deriveCustomTheme(colors, 'light');
    const dark = deriveCustomTheme(colors, 'dark');
    // A white page input still gives a dark page in dark mode.
    expect(ratio(dark.surfaces.app, '#000000')).toBeLessThan(1.5);
    expect(ratio(dark.surfaces.app, light.surfaces.app)).toBeGreaterThan(15);
    // A deep brand color is lifted so it reads on that page, and stays the same hue family.
    expect(dark.primary.base).not.toBe(colors.primary);
    expect(ratio(dark.primary.base, dark.surfaces.app)).toBeGreaterThanOrEqual(AA);
    expect(ratio(dark.secondary.base, dark.surfaces.app)).toBeGreaterThanOrEqual(AA);
    // Light text on the dark page.
    expect(ratio(dark.surfaces.textPrimary, dark.surfaces.app)).toBeGreaterThanOrEqual(7);
  });

  it('exposes every token the public site reads, all as 6-digit hex', () => {
    const vars = themeToVars(deriveCustomTheme({ primary: '#0D9488', secondary: '#E11D48', background: '#F0FDFA' }, 'light'));
    for (const token of [
      '--color-primary', '--color-primary-hover', '--color-primary-subtle', '--color-primary-muted',
      '--color-primary-ink', '--on-primary', '--color-secondary', '--color-secondary-hover',
      '--color-secondary-subtle', '--color-secondary-ink', '--on-secondary', '--bg-app', '--bg-card',
      '--bg-sidebar', '--text-primary', '--text-secondary', '--text-muted', '--text-placeholder',
      '--border-color', '--border-color-strong',
    ]) {
      expect(vars[token]).withContext(token).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('resolvePublicThemeVars', () => {
  it('turns a preset into its tokens, plus a derived secondary', () => {
    const pink = resolvePublicThemeVars({ preset: 'prime-pink' }, 'light');
    expect(pink['--color-primary']).toBe('#F35271');
    expect(pink['--color-primary-subtle']).toBe('#fef1f4');
    expect(pink['--on-primary']).toBe('#000000');
    expect(pink['--color-secondary']).toBe('#FF9DBC');
    expect(ratio(pink['--on-secondary'], pink['--color-secondary'])).toBeGreaterThanOrEqual(AA);
    expect(ratio(pink['--color-secondary-ink'], pink['--color-secondary-subtle'])).toBeGreaterThanOrEqual(AA);

    const mint = resolvePublicThemeVars({ preset: 'prime-mint' }, 'dark');
    expect(mint['--color-primary']).toBe('#A8C5B0');
    expect(mint['--color-secondary-ink']).toBeTruthy();
    // A preset leaves the page chrome to the site's built-in tokens.
    expect(pink['--bg-app']).toBeUndefined();
  });

  it('turns custom colors into the full token set, for both modes', () => {
    const colors = { primary: '#1D4ED8', secondary: '#F59E0B', background: '#F8FAFC' };
    const light = resolvePublicThemeVars({ preset: 'custom', colors }, 'light');
    const dark = resolvePublicThemeVars({ preset: 'custom', colors }, 'dark');
    expect(light['--color-primary']).toBe('#1D4ED8');
    expect(light['--bg-app']).toBe('#F8FAFC');
    expect(ratio(light['--on-primary'], light['--color-primary'])).toBeGreaterThanOrEqual(AA);
    expect(ratio(light['--on-secondary'], light['--color-secondary'])).toBeGreaterThanOrEqual(AA);
    expect(dark['--bg-app']).not.toBe(light['--bg-app']);
    expect(ratio(dark['--on-primary'], dark['--color-primary'])).toBeGreaterThanOrEqual(AA);
    expect(light['--intro-stage-bg']).toBeTruthy();
  });

  it('falls back to the default preset when custom colors are missing or not hex', () => {
    const fallback = resolvePublicThemeVars({ preset: 'prime-pink' }, 'light');
    expect(resolvePublicThemeVars({ preset: 'custom' }, 'light')).toEqual(fallback);
    expect(resolvePublicThemeVars({ preset: 'custom', colors: { primary: 'red', secondary: '#fff', background: '#ffffff' } }, 'light')).toEqual(fallback);
    expect(resolvePublicThemeVars({ preset: 'does-not-exist' }, 'light')).toEqual(fallback);
    expect(resolvePublicThemeVars(null, 'light')).toEqual(fallback);
  });

  it('reads colors only for "custom": a preset ignores the stored colors', () => {
    const colors = { primary: '#1D4ED8', secondary: '#F59E0B', background: '#F8FAFC' };
    expect(resolvePublicThemeVars({ preset: 'prime-mint', colors }, 'light')).toEqual(
      resolvePublicThemeVars({ preset: 'prime-mint' }, 'light')
    );
  });
});

describe('failsOnSurface', () => {
  it('flags a color that is too faint to read as text on its page', () => {
    expect(failsOnSurface('#FFFF00', '#FFFFFF')).toBeTrue();
    expect(failsOnSurface('#1D4ED8', '#FFFFFF')).toBeFalse();
    expect(failsOnSurface('#1D4ED8', '#FFFFFF')).toBe(failsContrast('#1D4ED8', '#FFFFFF'));
  });
});
