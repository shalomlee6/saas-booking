import type { Response } from 'express';

/** Public landing JSON must not be served stale after an owner save. */
export function setNoStore(res: Response): void {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
}
