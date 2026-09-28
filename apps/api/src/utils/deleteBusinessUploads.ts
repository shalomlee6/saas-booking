import fs from 'fs/promises';
import path from 'path';
import { Types } from 'mongoose';

/** All business-uploaded images (gallery, logo, landing hero/cover) land under
 *  this one directory, one subfolder per business — see landingUploadController. */
const LANDING_UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'landing');

function businessUploadDir(businessId: string): string {
  if (!Types.ObjectId.isValid(businessId)) {
    throw new Error(`Invalid businessId for upload path: ${businessId}`);
  }
  return path.join(LANDING_UPLOAD_ROOT, businessId);
}

/** Read-only — how many uploaded files a business has on disk. Powers the delete-impact dialog. */
export async function countBusinessUploadFiles(businessId: string): Promise<number> {
  try {
    const entries = await fs.readdir(businessUploadDir(businessId), { withFileTypes: true });
    return entries.filter((e) => e.isFile()).length;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw err;
  }
}

/** Deletes every uploaded file for a business (gallery/logo/landing media). Not part of the
 *  Mongo transaction — call only after the DB-side cascade has committed successfully. */
export async function deleteBusinessUploads(businessId: string): Promise<void> {
  await fs.rm(businessUploadDir(businessId), { recursive: true, force: true });
}
