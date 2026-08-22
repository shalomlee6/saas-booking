/**
 * Landing images used to be stored as `/uploads/...`. That path is reachable on
 * the admin origin (dev proxy / CloudFront `/uploads` behavior) but not on
 * custom tenant domains (chen-nails.co.il), which only forward `/api*` to this
 * server. Canonical public path is `/api/uploads/...` — same files, same-origin
 * on every host that already proxies the API.
 */

const LEGACY_PREFIX = '/uploads/';
const PUBLIC_PREFIX = '/api/uploads/';

function rewritePathname(pathname: string, suffix = ''): string | null {
  if (pathname.startsWith(PUBLIC_PREFIX) || pathname === '/api/uploads') {
    return `${pathname}${suffix}`;
  }
  if (pathname.startsWith(LEGACY_PREFIX) || pathname === '/uploads') {
    return `/api${pathname}${suffix}`;
  }
  return null;
}

/** Rewrite a stored image URL for public/admin clients. External URLs unchanged. */
export function rewriteStoredUploadUrl(raw: string | null | undefined): string {
  const t = typeof raw === 'string' ? raw.trim() : '';
  if (!t) return t;

  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      const rewritten = rewritePathname(u.pathname, u.search + u.hash);
      return rewritten ?? t;
    } catch {
      return t;
    }
  }

  return rewritePathname(t) ?? t;
}

export function rewriteLandingImageUrlsInSettings(
  raw: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...raw };

  if (typeof next.coverImageUrl === 'string') {
    next.coverImageUrl = rewriteStoredUploadUrl(next.coverImageUrl);
  }
  if (typeof next.landingSecondaryHeroImageUrl === 'string') {
    next.landingSecondaryHeroImageUrl = rewriteStoredUploadUrl(next.landingSecondaryHeroImageUrl);
  }
  if (Array.isArray(next.portfolioImages)) {
    next.portfolioImages = next.portfolioImages.map((u) =>
      typeof u === 'string' ? rewriteStoredUploadUrl(u) : u
    );
  }
  if (Array.isArray(next.landingGalleryItems)) {
    next.landingGalleryItems = next.landingGalleryItems.map((g) => {
      const item =
        g && typeof g === 'object' && typeof (g as { toObject?: unknown }).toObject === 'function'
          ? (g as { toObject: () => Record<string, unknown> }).toObject()
          : { ...(g as Record<string, unknown>) };
      if (typeof item.imageUrl === 'string') {
        item.imageUrl = rewriteStoredUploadUrl(item.imageUrl);
      }
      return item;
    });
  }

  const theme = next.theme;
  if (theme && typeof theme === 'object' && theme !== null && 'logoUrl' in theme) {
    const logo = (theme as { logoUrl?: unknown }).logoUrl;
    if (typeof logo === 'string') {
      next.theme = { ...(theme as Record<string, unknown>), logoUrl: rewriteStoredUploadUrl(logo) };
    }
  }

  return next;
}

export function settingsDocToClientJson(settings: {
  toObject?: (opts?: { depopulate?: boolean }) => Record<string, unknown>;
}): Record<string, unknown> {
  const raw =
    typeof settings.toObject === 'function' ? settings.toObject() : { ...(settings as Record<string, unknown>) };
  return rewriteLandingImageUrlsInSettings(raw);
}
