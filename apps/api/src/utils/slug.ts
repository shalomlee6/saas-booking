export function generateSlug(input: string) {
  return input
    .toLowerCase()
    .replace(/\s+/g, '-')        // רווחים → מקף
    .replace(/[^a-z0-9\-]/g, '') // רק תווים חוקיים
    .substring(0, 30);           // אורך סביר
}

/** Normalize a user-entered business slug (Latin URL segment). */
export function normalizeBusinessSlugInput(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}
