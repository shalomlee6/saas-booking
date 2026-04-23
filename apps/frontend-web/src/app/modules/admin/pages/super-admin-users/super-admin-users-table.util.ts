import type { AdminUserRow } from '../../services/admin-api.service';

export type AvatarKey = 'af' | 'gm' | 'ns' | 'tz';

export function tableAvatarInitial(name: string, email: string): string {
  const s = (name.trim() || email.trim() || '?').charAt(0).toUpperCase();
  return s || '?';
}

export function tableAvatarKey(name: string, email: string): AvatarKey {
  const m = /[A-Za-z]/.exec(name.trim() || email.trim());
  if (m) {
    const u = m[0].toUpperCase();
    if (u <= 'F') return 'af';
    if (u <= 'M') return 'gm';
    if (u <= 'S') return 'ns';
    return 'tz';
  }
  let h = 0;
  const src = name + email;
  for (let i = 0; i < src.length; i += 1) {
    h = (h + src.charCodeAt(i)) % 4;
  }
  return (['af', 'gm', 'ns', 'tz'] as const)[h];
}

export function formatRelativeLogin(iso: string | null, nowMs: number): string {
  if (!iso) return 'Never';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'Never';
  const sec = Math.floor((nowMs - t) / 1000);
  if (sec < 10) return 'Just now';
  if (sec < 60) return `${sec} seconds ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day < 14) return `${day} day${day === 1 ? '' : 's'} ago`;
  const week = Math.floor(day / 7);
  if (week < 8) return `${week} week${week === 1 ? '' : 's'} ago`;
  const month = Math.floor(day / 30);
  return `${month} month${month === 1 ? '' : 's'} ago`;
}

export function paginationPages(current: number, total: number): (number | 'dots')[] {
  if (total <= 0) return [1];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const set = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | 'dots')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('dots');
    out.push(p);
    prev = p;
  }
  return out;
}

export function roleLabel(role: string): string {
  switch (role) {
    case 'super_admin':
      return 'Super admin';
    case 'owner':
      return 'Owner';
    case 'staff':
      return 'Staff';
    case 'client':
      return 'Client';
    default:
      return role;
  }
}

export function planLabel(plan: AdminUserRow['plan']): string {
  switch (plan) {
    case 'free':
      return 'Free';
    case 'pro':
      return 'Pro';
    case 'premium':
      return 'Premium';
    default:
      return '—';
  }
}

export function statusLabel(status: string): string {
  return status === 'active' ? 'Active' : 'Suspended';
}
