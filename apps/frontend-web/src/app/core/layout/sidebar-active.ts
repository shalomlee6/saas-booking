/** The owner sidebar's items. Exactly one is active on every owner route. */
export type SidebarItemId =
  | 'dashboard'
  | 'appointments'
  | 'services'
  | 'customers'
  | 'settings'
  | 'landing'
  | 'preview'
  | 'account';

/** Translation key of each item's label, which is also the topbar title on its pages. */
export const SIDEBAR_ITEM_TITLE_KEY: Record<SidebarItemId, string> = {
  dashboard: 'navigation.dashboard',
  appointments: 'navigation.appointments',
  services: 'navigation.services',
  customers: 'navigation.customers',
  settings: 'navigation.settings',
  landing: 'navigation.landingPage',
  preview: 'navigation.previewSite',
  account: 'navigation.account',
};

/**
 * Which sidebar item owns a URL.
 *
 * `/settings/landing` and `/settings/account` live under `/settings` but are their own sidebar items, so a
 * plain prefix match would highlight "Settings" next to them. The rule is explicit instead:
 *   - `/settings/landing` → landing page, `/settings/account` → account
 *   - every other `/settings` URL (the section pages, the old `theme` and `working-hours` paths, the
 *     bare `/settings`) → settings
 * Returns null only for URLs outside the owner portal.
 */
export function sidebarItemForUrl(url: string): SidebarItemId | null {
  const path = url.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const [first, second] = path.split('/').filter(Boolean);
  switch (first) {
    case undefined: // "/" redirects to the dashboard
    case 'dashboard':
      return 'dashboard';
    case 'appointments':
    case 'services':
    case 'customers':
      return first;
    case 'settings':
      if (second === 'landing') return 'landing';
      if (second === 'account') return 'account';
      return 'settings';
    case 'preview':
      return 'preview';
    default:
      return null;
  }
}
