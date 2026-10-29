import type { TabDef } from '../../auth/tabs';
import { PageHeader } from '../../components/ui';

/**
 * Placeholder for a screen that has not been migrated yet. Keeps the route, permissions and the `tab-<name>` section
 * in place so navigation and role rules can be tested now; each phase replaces these one by one (see the tracker).
 */
export function ComingSoon({ tab }: { tab: TabDef }) {
  return (
    <section id={`tab-${tab.id}`} data-testid={`tab-${tab.id}`} className="space-y-5">
      <PageHeader title={tab.label} />
      <div className="card flex flex-col items-center text-center py-14 px-4 gap-3">
        <div className="w-12 h-12 rounded-full bg-brand/15 text-brand-text flex items-center justify-center text-lg"><i className={`fa-solid ${tab.icon}`} /></div>
        <div>
          <p className="font-medium text-fg">This screen is moving to the new app</p>
          <p className="text-sm text-muted mt-0.5">Until then it works exactly as before in the classic app.</p>
        </div>
        <a href={`/#${tab.id}`} className="btn btn-secondary">Open in the classic app</a>
      </div>
    </section>
  );
}
