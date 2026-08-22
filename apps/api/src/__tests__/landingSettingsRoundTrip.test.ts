import request from 'supertest';
import { buildTestApp } from './helpers/testApp';
import { dbConnect, dbDisconnect, dbClear } from './helpers/db';
import { seedOwner, seedBusinessSettings } from './helpers/seed';
import { BusinessSettings } from '../models/BusinessSettings';

const app = buildTestApp();

beforeAll(async () => dbConnect());
afterAll(async () => dbDisconnect());
beforeEach(async () => dbClear());

describe('LANDING SETTINGS ROUND TRIP', () => {
  it('PUT settings/me/settings persists hero + gallery and public GET returns the new URLs', async () => {
    const { business, token } = await seedOwner();
    await seedBusinessSettings(business._id);

    const cover = '/uploads/landing/test-biz/cover.jpg';
    const secondary = '/uploads/landing/test-biz/secondary.jpg';
    const galleryUrl = '/uploads/landing/test-biz/gallery.jpg';
    const external = 'https://picsum.photos/800/400?random=9';

    const put = await request(app)
      .put('/api/settings/me/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        coverImageUrl: cover,
        landingSecondaryHeroImageUrl: secondary,
        landingGalleryItems: [
          { id: 'g1', imageUrl: galleryUrl, title: 'Nail art', type: 'service' },
          { id: 'g2', imageUrl: external, title: 'External', type: 'product' },
        ],
      });

    expect(put.status).toBe(200);
    expect(put.body.coverImageUrl).toBe('/api/uploads/landing/test-biz/cover.jpg');
    expect(put.body.landingSecondaryHeroImageUrl).toBe(
      '/api/uploads/landing/test-biz/secondary.jpg'
    );
    expect(put.body.landingGalleryItems[0].imageUrl).toBe(
      '/api/uploads/landing/test-biz/gallery.jpg'
    );
    expect(put.body.landingGalleryItems[1].imageUrl).toBe(external);

    const stored = await BusinessSettings.findOne({ businessId: business._id });
    expect(stored?.coverImageUrl).toBe('/api/uploads/landing/test-biz/cover.jpg');
    expect(stored?.landingSecondaryHeroImageUrl).toBe(
      '/api/uploads/landing/test-biz/secondary.jpg'
    );
    expect(stored?.landingGalleryItems?.[0]?.imageUrl).toBe(
      '/api/uploads/landing/test-biz/gallery.jpg'
    );
    expect(stored?.portfolioImages).toEqual([
      '/api/uploads/landing/test-biz/gallery.jpg',
      external,
    ]);

    const pub = await request(app).get(`/api/public/businesses/${business.slug}`);
    expect(pub.status).toBe(200);
    expect(pub.headers['cache-control']).toMatch(/no-store/);
    expect(pub.body.landing.coverImageUrl).toBe('/api/uploads/landing/test-biz/cover.jpg');
    expect(pub.body.landing.secondaryHeroImageUrl).toBe(
      '/api/uploads/landing/test-biz/secondary.jpg'
    );
    expect(pub.body.landing.galleryItems.length).toBe(2);
    expect(pub.body.landing.galleryItems[0].imageUrl).toBe(
      '/api/uploads/landing/test-biz/gallery.jpg'
    );
    expect(pub.body.landing.galleryItems[0].title).toBe('Nail art');
    expect(pub.body.landing.galleryItems[1].imageUrl).toBe(external);
    expect(pub.body.landing.galleryItems[1].title).toBe('External');

    const landing = await request(app).get(`/api/public/businesses/${business.slug}/landing`);
    expect(landing.status).toBe(200);
    expect(landing.body.heroSection.heroImage).toBe('/api/uploads/landing/test-biz/cover.jpg');
    expect(landing.body.heroSection.heroImageSecondary).toBe(
      '/api/uploads/landing/test-biz/secondary.jpg'
    );
    expect(landing.body.gallery[0].imageUrl).toBe('/api/uploads/landing/test-biz/gallery.jpg');
  });

  it('rewrites already-stored legacy /uploads URLs on public GET without another save', async () => {
    const { business } = await seedOwner();
    await seedBusinessSettings(business._id);
    await BusinessSettings.updateOne(
      { businessId: business._id },
      {
        $set: {
          coverImageUrl: '/uploads/landing/old/hero.jpg',
          landingSecondaryHeroImageUrl: '/uploads/landing/old/sec.jpg',
          landingGalleryItems: [
            {
              id: 'legacy-g',
              imageUrl: '/uploads/landing/old/gal.jpg',
              title: 'Old',
              type: 'service',
            },
          ],
        },
      }
    );

    const pub = await request(app).get(`/api/public/businesses/${business.slug}`);
    expect(pub.status).toBe(200);
    expect(pub.body.landing.coverImageUrl).toBe('/api/uploads/landing/old/hero.jpg');
    expect(pub.body.landing.secondaryHeroImageUrl).toBe('/api/uploads/landing/old/sec.jpg');
    expect(pub.body.landing.galleryItems[0].imageUrl).toBe('/api/uploads/landing/old/gal.jpg');
  });
});
