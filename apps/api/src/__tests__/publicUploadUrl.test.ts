import { rewriteStoredUploadUrl } from '../utils/publicUploadUrl';

describe('rewriteStoredUploadUrl', () => {
  it('rewrites legacy relative /uploads paths to /api/uploads', () => {
    expect(rewriteStoredUploadUrl('/uploads/landing/abc/cover.jpg')).toBe(
      '/api/uploads/landing/abc/cover.jpg'
    );
  });

  it('leaves canonical /api/uploads paths unchanged', () => {
    expect(rewriteStoredUploadUrl('/api/uploads/landing/abc/cover.jpg')).toBe(
      '/api/uploads/landing/abc/cover.jpg'
    );
  });

  it('rewrites absolute URLs whose path is /uploads to a same-origin /api/uploads path', () => {
    expect(rewriteStoredUploadUrl('https://boki.co.il/uploads/landing/abc/cover.jpg')).toBe(
      '/api/uploads/landing/abc/cover.jpg'
    );
  });

  it('leaves third-party image URLs unchanged', () => {
    const picsum = 'https://picsum.photos/800/400?random=1';
    expect(rewriteStoredUploadUrl(picsum)).toBe(picsum);
  });

  it('trims whitespace and passes through empty values', () => {
    expect(rewriteStoredUploadUrl('  ')).toBe('');
    expect(rewriteStoredUploadUrl(undefined)).toBe('');
    expect(rewriteStoredUploadUrl(null)).toBe('');
  });
});
