const HEX = /^#[0-9a-fA-F]{6}$/;

function channel(hex: string, index: number): number {
  const value = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
}

/** WCAG contrast ratio, or null when either color is not a 6-digit hex. */
export function contrastRatio(foreground: string, background: string): number | null {
  if (!HEX.test(foreground) || !HEX.test(background)) return null;
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export function failsContrast(foreground: string, background: string, minimum = 4.5): boolean {
  const ratio = contrastRatio(foreground, background);
  return ratio == null || ratio < minimum;
}

const DARK = '#111827';
const LIGHT = '#ffffff';
const BLACK = '#000000';

/**
 * Dark or light text that reaches 4.5:1 on `background`.
 * Near-black and white cover every sRGB fill; pure black is the fallback
 * when near-black is just short of the ratio.
 */
export function onContrastColor(background: string): string {
  const ranked = [DARK, LIGHT, BLACK]
    .map((color) => ({ color, ratio: contrastRatio(color, background) ?? 0 }))
    .sort((a, b) => b.ratio - a.ratio);
  return (ranked.find((item) => item.ratio >= 4.5) ?? ranked[0]).color;
}
