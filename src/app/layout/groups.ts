import type { TabDef, TabId } from '../../auth/tabs';

/** Sidebar sections. A screen not listed here still shows up (under "More"), so nothing can disappear by mistake. */
const GROUPS: { label: string; ids: TabId[] }[] = [
  { label: 'Operations', ids: ['pos', 'kds', 'bills', 'menu', 'inventory', 'stocklinks'] },
  { label: 'Business', ids: ['analytics', 'expenses', 'suppliers', 'gst', 'staff'] },
  { label: 'People', ids: ['attendance', 'users'] },
  { label: 'Admin', ids: ['outlets', 'settings', 'audit', 'telegram', 'cafes'] },
];

export function groupTabs(tabs: TabDef[]): { label: string; tabs: TabDef[] }[] {
  const listed = new Set(GROUPS.flatMap((g) => g.ids));
  const groups = GROUPS.map((g) => ({ label: g.label, tabs: g.ids.map((id) => tabs.find((t) => t.id === id)).filter((t): t is TabDef => !!t) }));
  const rest = tabs.filter((t) => !listed.has(t.id));
  if (rest.length) groups.push({ label: 'More', tabs: rest });
  return groups.filter((g) => g.tabs.length > 0);
}
