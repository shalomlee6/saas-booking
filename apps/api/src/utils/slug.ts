export function generateSlug(input: string) {
  return input
    .toLowerCase()
    .replace(/\s+/g, '-')        // רווחים → מקף
    .replace(/[^a-z0-9\-]/g, '') // רק תווים חוקיים
    .substring(0, 30);           // אורך סביר
}
