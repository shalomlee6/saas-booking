import { BusinessSettings } from '../models/BusinessSettings';

/**
 * Removes the stored public-theme fields `theme.colors.accent` and `theme.colors.text`.
 * Nothing ever read them: the client site is themed from a preset or from the primary, secondary and
 * background colors, and derives everything else.
 *
 * It goes through the raw collection on purpose: the schema no longer has these paths, and Mongoose
 * strips unknown paths from updates, so `BusinessSettings.updateMany` would silently do nothing.
 * Idempotent: a second run matches nothing.
 */
export async function removeThemeAccentAndText(): Promise<{ matched: number; modified: number }> {
  const result = await BusinessSettings.collection.updateMany(
    { $or: [{ 'theme.colors.accent': { $exists: true } }, { 'theme.colors.text': { $exists: true } }] },
    { $unset: { 'theme.colors.accent': '', 'theme.colors.text': '' } }
  );
  return { matched: result.matchedCount, modified: result.modifiedCount };
}
