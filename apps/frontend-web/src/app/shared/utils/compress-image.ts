/**
 * Client-side image compression using canvas (JPEG). Targets ~maxBytes when possible.
 */
export async function compressImageFile(
  file: File,
  options?: { maxBytes?: number; maxWidth?: number }
): Promise<Blob> {
  const maxBytes = options?.maxBytes ?? 2_000_000;
  const maxWidth = options?.maxWidth ?? 1920;

  if (!file.type.startsWith('image/')) {
    throw new Error('NOT_IMAGE');
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxWidth / bitmap.width);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('NO_CONTEXT');
    }
    ctx.drawImage(bitmap, 0, 0, w, h);

    let quality = 0.9;
    let blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
    );
    while (blob && blob.size > maxBytes && quality > 0.45) {
      quality -= 0.08;
      blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
      );
    }
    if (!blob) {
      throw new Error('COMPRESS_FAIL');
    }
    return blob;
  } finally {
    bitmap.close();
  }
}
