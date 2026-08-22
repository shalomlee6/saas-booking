import { environment } from '../../../environments/environment';

/**
 * Landing uploads are stored as `/uploads/...` (legacy) or `/api/uploads/...`.
 * Custom tenant domains only proxy `/api*`, so rewrite legacy paths and, when
 * `environment.apiUrl` is a separate host, prefix so <img> hits the API origin.
 */
export function resolvePublicAssetUrl(url: string | null | undefined): string {
  const t = typeof url === 'string' ? url.trim() : '';
  if (!t) return t;

  const rewritten = rewriteUploadPath(t);
  if (!rewritten.startsWith('/')) return rewritten;

  const apiBase = (environment.apiUrl ?? '').trim().replace(/\/$/, '');
  if (!apiBase) return rewritten;
  const origin = apiBase.endsWith('/api') ? apiBase.slice(0, -4) : apiBase;
  return `${origin}${rewritten}`;
}

function rewriteUploadPath(t: string): string {
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      const next = rewritePathname(u.pathname, u.search + u.hash);
      return next ?? t;
    } catch {
      return t;
    }
  }
  return rewritePathname(t) ?? t;
}

function rewritePathname(pathname: string, suffix = ''): string | null {
  if (pathname.startsWith('/api/uploads/') || pathname === '/api/uploads') {
    return `${pathname}${suffix}`;
  }
  if (pathname.startsWith('/uploads/') || pathname === '/uploads') {
    return `/api${pathname}${suffix}`;
  }
  return null;
}
