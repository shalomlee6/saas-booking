import path from 'path';
import express, { type Application, type RequestHandler } from 'express';

export const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

const withCorp: RequestHandler = (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
};

/**
 * Files live on disk under `uploads/`. Serve them at both:
 * - `/uploads/...` (legacy URLs already stored in Mongo)
 * - `/api/uploads/...` (reachable on custom tenant domains that only proxy `/api*`)
 */
export function mountUploadStatic(app: Application): void {
  const staticFiles = express.static(UPLOADS_DIR);
  app.use('/uploads', withCorp, staticFiles);
  app.use('/api/uploads', withCorp, staticFiles);
}
