import { contrastRatio, onContrastColor } from './contrast-color';

/** WCAG AA for normal text. Every derived text/surface pair below is held to this. */
export const MIN_TEXT_CONTRAST = 4.5;

const WHITE = '#ffffff';
const BLACK = '#000000';

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)) as [number, number, number];
}

function toHex(values: number[]): string {
  return `#${values.map((value) => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0')).join('')}`;
}

/** `weight` of `b` mixed into `a` (0 = a, 1 = b). Both must be 6-digit hex colors. */
export function mixHex(a: string, b: string, weight: number): string {
  const from = channels(a);
  const to = channels(b);
  return toHex(from.map((value, index) => value + (to[index] - value) * weight));
}

/** Contrast between two colors; 1 when either is not a 6-digit hex (callers only pass valid hex). */
function ratio(a: string, b: string): number {
  return contrastRatio(a, b) ?? 1;
}

/**
 * The closest shade of `color` that reaches `minimum` against EVERY surface in `surfaces`:
 * it moves toward white or black (whichever pure color reads better on them) in small steps.
 * Black or white always reaches 4.5:1 against any single color, so this always terminates.
 */
export function ensureContrast(color: string, surfaces: string[], minimum = MIN_TEXT_CONTRAST): string {
  const passes = (candidate: string) => surfaces.every((surface) => ratio(candidate, surface) >= minimum);
  if (passes(color)) return color;
  const whiteScore = Math.min(...surfaces.map((surface) => ratio(WHITE, surface)));
  const blackScore = Math.min(...surfaces.map((surface) => ratio(BLACK, surface)));
  const target = whiteScore >= blackScore ? WHITE : BLACK;
  for (let step = 1; step <= 50; step++) {
    const candidate = mixHex(color, target, step / 50);
    if (passes(candidate)) return candidate;
  }
  return target;
}

/**
 * Keeps a background on the readable side of `text`: if `text` is below `minimum` on it, the surface
 * moves away from the text color (toward white under dark text, toward black under light text).
 *
 * Why: a color can reach 4.5:1 on several surfaces at once only if the pure text color does. On a
 * mid-tone page, a tint pulled toward a bright brand color can land on the wrong side of that line, and
 * then no ink works on both the page and the tint. Fitting every derived surface to the page text rules it out.
 */
export function fitSurface(surface: string, text: string, minimum = MIN_TEXT_CONTRAST): string {
  if (ratio(text, surface) >= minimum) return surface;
  const away = ratio(WHITE, text) < ratio(BLACK, text) ? BLACK : WHITE;
  for (let step = 1; step <= 50; step++) {
    const candidate = mixHex(surface, away, step / 50);
    if (ratio(text, candidate) >= minimum) return candidate;
  }
  return away;
}

export interface ColorFamily {
  base: string;
  hover: string;
  /** A soft tint of the color, for backgrounds. */
  subtle: string;
  muted: string;
  /** The color as readable text/icons on `subtle` and on the page surfaces. */
  ink: string;
  /** Text on a solid `base` or `hover` fill. */
  on: string;
}

/**
 * Everything a color needs to be used on a site: a hover shade, tints, a text-safe ink and the text that
 * sits on it. `surfaces` are the page and card backgrounds it will appear on; `tint` is how much of the
 * color goes into `subtle` (more in dark mode, where a faint tint disappears); `pageText` is the page's text
 * color, which every tint is kept readable under.
 */
export function deriveFamily(
  base: string,
  surfaces: { app: string; card: string },
  tint: number,
  pageText: string
): ColorFamily {
  const on = onContrastColor(base);
  // Hover moves away from the text color, so the label never loses contrast on it.
  const away = on === WHITE ? BLACK : WHITE;
  let hover = mixHex(base, away, 0.12);
  if (ratio(on, hover) < MIN_TEXT_CONTRAST) hover = base;
  const subtle = fitSurface(mixHex(surfaces.card, base, tint), pageText);
  const muted = fitSurface(mixHex(surfaces.card, base, Math.min(1, tint * 2)), pageText);
  const ink = ensureContrast(base, [subtle, surfaces.app, surfaces.card]);
  return { base, hover, subtle, muted, ink, on };
}
