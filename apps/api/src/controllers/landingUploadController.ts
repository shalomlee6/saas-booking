import { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer, { MulterError } from 'multer';
import { AuthRequest } from '../middleware/auth';
import { getEffectiveBusinessId } from '../utils/effectiveBusinessId';

const uploadRoot = path.join(process.cwd(), 'uploads', 'landing');

function ensureDirForBusiness(businessId: string): string {
  const dir = path.join(uploadRoot, businessId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const id = getEffectiveBusinessId(req as AuthRequest);
    if (!id) {
      cb(new Error('NO_BUSINESS'), '');
      return;
    }
    try {
      cb(null, ensureDirForBusiness(id));
    } catch {
      cb(new Error('MKDIR'), '');
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safe = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safe}`);
  },
});

const allowedImageMimeTypes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const landingImageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    const ext = path.extname(file.originalname || '').toLowerCase();
    const extOk = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    const mimeMissing = mime === '' || mime === 'application/octet-stream';
    if (allowedImageMimeTypes.has(mime) || (mimeMissing && extOk)) {
      cb(null, true);
      return;
    }
    cb(new Error('INVALID_TYPE'));
  },
});

export function runLandingImageUpload(req: Request, res: Response, next: NextFunction): void {
  landingImageUpload.single('file')(req, res, (err) => {
    if (err) {
      landingUploadErrorHandler(err, req, res, next);
      return;
    }
    next();
  });
}

export function landingUploadErrorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ message: 'File too large (max 5MB)' });
      return;
    }
  }
  if (err instanceof Error) {
    if (err.message === 'INVALID_TYPE') {
      res.status(400).json({ message: 'Only image uploads are allowed' });
      return;
    }
    if (err.message === 'NO_BUSINESS') {
      res.status(400).json({ message: 'Business ID not found' });
      return;
    }
    if (err.message === 'MKDIR') {
      res.status(500).json({ message: 'Could not store uploaded file' });
      return;
    }
  }
  next(err);
}

export async function postLandingImageUpload(req: AuthRequest, res: Response): Promise<void> {
  const biz = getEffectiveBusinessId(req);
  if (!biz) {
    res.status(400).json({ message: 'Business ID not found' });
    return;
  }
  const f = req.file;
  if (!f) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }
  const url = `/api/uploads/landing/${biz}/${f.filename}`;
  res.status(201).json({ url });
}
