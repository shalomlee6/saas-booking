import { BusinessSettings } from '../models/BusinessSettings';

/**
 * Removes the stored public-theme fields `theme.colors.accent` and `theme.colors.text`.
 * Nothing ever read them: the client site is themed from a preset or from the primary, secondary and
 * background colors, and derives everything else.
 *
 * It goes through the raw collection on purpose: the schema no longer has these paths, and Mongoose
 * strips unknown paths from updates, so `BusinessSettings.updateMany` would silently do nothing.
 * Idempotent: a second run matches nothing. With `dryRun` it only counts the documents that would change.
 *
 * Optional cleanup: stored leftovers are harmless. Every read leaves them out and every save ignores them
 * (see `utils/themeColors.ts` and `__tests__/legacyThemeFields.test.ts`), so nothing has to run before a deploy.
 */
export async function removeThemeAccentAndText(
  options: { dryRun?: boolean } = {}
): Promise<{ matched: number; modified: number }> {
  const filter = { $or: [{ 'theme.colors.accent': { $exists: true } }, { 'theme.colors.text': { $exists: true } }] };
  if (options.dryRun) {
    return { matched: await BusinessSettings.collection.countDocuments(filter), modified: 0 };
  }
  const result = await BusinessSettings.collection.updateMany(filter, {
    $unset: { 'theme.colors.accent': '', 'theme.colors.text': '' },
  });
  return { matched: result.matchedCount, modified: result.modifiedCount };
}
