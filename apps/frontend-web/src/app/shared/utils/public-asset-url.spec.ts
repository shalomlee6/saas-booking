import { resolvePublicAssetUrl } from './public-asset-url';

describe('resolvePublicAssetUrl', () => {
  it('rewrites legacy /uploads paths so tenant domains hit /api', () => {
    expect(resolvePublicAssetUrl('/uploads/landing/abc/cover.jpg')).toBe(
      '/api/uploads/landing/abc/cover.jpg'
    );
  });

  it('leaves canonical /api/uploads and third-party URLs unchanged', () => {
    expect(resolvePublicAssetUrl('/api/uploads/landing/abc/cover.jpg')).toBe(
      '/api/uploads/landing/abc/cover.jpg'
    );
    expect(resolvePublicAssetUrl('https://picsum.photos/800/400?random=1')).toBe(
      'https://picsum.photos/800/400?random=1'
    );
  });

  it('returns empty for blank input', () => {
    expect(resolvePublicAssetUrl('')).toBe('');
    expect(resolvePublicAssetUrl(null)).toBe('');
  });
});
