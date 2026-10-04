import { rewriteStoredUploadUrl } from './publicUploadUrl';
import { randomUUID } from 'crypto';

export function orderServicesById<T extends { id: string }>(list: T[], order: string[] | undefined): T[] {
  if (!order?.length) return list;
  const map = new Map(list.map((x) => [x.id, x]));
  const seen = new Set<string>();
  const ordered: T[] = [];
  for (const id of order) {
    const x = map.get(id);
    if (x) {
      ordered.push(x);
      seen.add(id);
    }
  }
  // Active services the owner has not placed yet lead the list, so a new
  // service is in the first screen of the landing carousel. The saved order follows.
  const extras = list.filter((x) => !seen.has(x.id));
  return [...extras, ...ordered];
}

export type GalleryItemNormalized = {
  id: string;
  imageUrl: string;
  title: string;
  type: 'product' | 'service';
};

export function normalizeGalleryItems(
  portfolioImages: string[],
  landingGalleryItems: unknown
): GalleryItemNormalized[] {
  if (Array.isArray(landingGalleryItems) && landingGalleryItems.length > 0) {
    return (landingGalleryItems as Record<string, unknown>[])
      .map((g) => ({
        id: String(g['id'] || randomUUID()),
        imageUrl: rewriteStoredUploadUrl(String(g['imageUrl'] || '').trim()),
        title: typeof g['title'] === 'string' ? g['title'].trim() : '',
        type: g['type'] === 'product' ? ('product' as const) : ('service' as const),
      }))
      .filter((g) => g.imageUrl.length > 0);
  }
  return portfolioImages.map((url, i) => ({
    id: `legacy-${i}`,
    imageUrl: rewriteStoredUploadUrl(url),
    title: '',
    type: 'service' as const,
  }));
}

const DEFAULT_SECTIONS = {
  hero: true,
  services: true,
  gallery: true,
  products: true,
  reviews: true,
  cta: true,
} as const;

export function mergeSectionVisibility(raw: Record<string, boolean> | undefined | null): Record<string, boolean> {
  return {
    hero: raw?.hero !== false,
    services: raw?.services !== false,
    gallery: raw?.gallery !== false,
    products: raw?.products !== false,
    reviews: raw?.reviews !== false,
    cta: raw?.cta !== false,
  };
}

export { DEFAULT_SECTIONS };
