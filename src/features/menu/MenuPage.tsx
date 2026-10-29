import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { canManageBranchSettings, canManageMenu } from '../../api/roles';
import { useSession } from '../../api/session';
import { showToast } from '../../components/toast';
import { Badge, EmptyState, PageHeader, SearchInput, SegmentedTabs, Skeleton, Switch } from '../../components/ui';
import { deleteDish, exportMenu, previewImport, toggleAvailability, type MenuItem } from './api';
import { BranchPriceDialog } from './BranchPriceDialog';
import { CategoryDialog } from './CategoryDialog';
import { ModifiersAdminDialog } from '../modifiers/ModifiersAdminDialog';
import { RecipeDialog } from '../inventory/RecipeDialog';
import { DishDialog } from './DishDialog';
import { useCategories, useMenuAction, useMenuAutoRefresh, useMenuItems } from './hooks';
import { ImportDialog, type PendingImport } from './ImportDialog';
import { PublicMenuCard } from './PublicMenuCard';
import { filterMenu, isAvailable, menuCounts, rupees, type MenuFilter } from './rules';

const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

type Modal = { kind: 'dish'; dish: MenuItem | null } | { kind: 'categories'; start: 'list' | 'add' } | { kind: 'import'; pending: PendingImport } | { kind: 'recipes' } | { kind: 'modifiers' } | { kind: 'branchPrice'; dish: MenuItem } | null;

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function MenuPage() {
  useMenuAutoRefresh();
  const user = useSession((s) => s.user)!;
  // The dishes, categories, add-ons and recipes are shared by every branch: changing them is a right of its own. A branch's own price
  // needs the branch settings right and a branch to work in.
  const mayEdit = canManageMenu(user);
  const branchName = user.selectedOutletId ? undefined : user.outletName;
  const mayPrice = canManageBranchSettings(user) && !!(user.selectedOutletId ?? user.outletId);
  const categories = useCategories();
  const menu = useMenuItems();
  const [filter, setFilter] = useState<MenuFilter>('all');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [exporting, setExporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const close = () => setModal(null);

  const toggle = useMenuAction(toggleAvailability, (u) => `"${u.name}" is now marked ${u.isAvailable ? 'Available' : 'Unavailable (Out of Stock)'}`, 'Failed to toggle availability');
  const remove = useMenuAction(deleteDish, 'Dish removed', 'Failed to delete dish');

  const items = menu.data ?? [];
  const counts = menuCounts(items);
  const rows = filterMenu(items, filter, query);

  const loadError = menu.isError ? menu.error.message : categories.isError ? categories.error.message : '';
  useEffect(() => { if (loadError) showToast(`Failed to load menu: ${loadError}`, 'error'); }, [loadError]);

  const onExport = async () => {
    setExporting(true);
    try {
      const data = await exportMenu();
      downloadJson(data, `arvi-menu-${new Date().toISOString().slice(0, 10)}.json`);
      showToast(`Exported ${data.itemCount} dishes`);
    } catch (e) { showToast(`Export failed: ${e instanceof Error ? e.message : e}`, 'error'); }
    finally { setExporting(false); }
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) { showToast('File is too large (max 2 MB)', 'error'); return; }
    let payload: unknown;
    try { payload = JSON.parse(await file.text()); } catch { showToast('That file is not valid JSON', 'error'); return; }
    try {
      const result = await previewImport(payload);
      if (result) setModal({ kind: 'import', pending: { payload, fileName: file.name, result } });
    } catch (err) { showToast(`Import check failed: ${err instanceof Error ? err.message : err}`, 'error'); }
  };

  const onDelete = (i: MenuItem) => {
    if (!window.confirm('Are you sure you want to remove this dish from the menu?')) return;
    remove.mutate(i.id);
  };

  const makeAllAvailable = async () => {
    const list = items.filter((i) => !isAvailable(i));
    if (list.length === 0) { showToast('No unavailable items to restore.', 'info'); return; }
    if (!window.confirm(`Are you sure you want to make all ${list.length} unavailable item(s) available again?`)) return;
    try {
      for (const i of list) await toggleAvailability(i.id);
      showToast(`All ${list.length} dish(es) are now marked Available!`, 'success');
    } catch (err) { showToast(`Failed to update some dishes: ${err instanceof Error ? err.message : err}`, 'error'); }
    await menu.refetch();
  };

  return (
    <section id="tab-menu" data-testid="tab-menu" className="space-y-5">
      <PageHeader title="Menu & pricing" description={mayEdit ? 'Dishes, prices, categories and the public customer menu. The menu is shared by every branch.' : 'The menu is shared by every branch; the owner or main manager changes it. You can mark dishes sold out and set your branch\'s price.'}
        actions={<>
          <div id="menuBulkButtons" className="flex gap-2">
            <button type="button" id="btnExportMenu" data-testid="menu-export" onClick={onExport} disabled={exporting} className="btn btn-secondary"><i className="fa-solid fa-file-export" />Export</button>
            {mayEdit && <button type="button" id="btnImportMenu" onClick={() => fileInput.current?.click()} className="btn btn-secondary"><i className="fa-solid fa-file-import" />Import</button>}
            <input ref={fileInput} type="file" id="menuImportFile" data-testid="menu-import-file" accept=".json,application/json" className="hidden" onChange={onFile} />
          </div>
          {mayEdit && <>
            <button type="button" id="btnDishRecipes" onClick={() => setModal({ kind: 'recipes' })} className="btn btn-secondary"><i className="fa-solid fa-book-open" />Dish recipes</button>
            <button type="button" id="btnModifiersCombos" onClick={() => setModal({ kind: 'modifiers' })} className="btn btn-secondary"><i className="fa-solid fa-layer-group" />Modifiers & combos</button>
            <button type="button" id="btnEditCategories" onClick={() => setModal({ kind: 'categories', start: 'list' })} className="btn btn-secondary"><i className="fa-solid fa-pen-to-square" />Edit categories</button>
            <button type="button" onClick={() => setModal({ kind: 'categories', start: 'add' })} className="btn btn-secondary"><i className="fa-solid fa-folder-plus" />Add category</button>
            <button type="button" onClick={() => setModal({ kind: 'dish', dish: null })} className="btn btn-primary"><i className="fa-solid fa-plus" />Add dish</button>
          </>}
        </>} />

      <PublicMenuCard />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs label="Dish availability" value={filter} onChange={setFilter} options={[
          { value: 'all', label: 'All dishes', count: counts.all, id: 'menuSubTab-all' },
          { value: 'available', label: 'Available', count: counts.available, id: 'menuSubTab-available' },
          { value: 'unavailable', label: 'Unavailable', count: counts.unavailable, id: 'menuSubTab-unavailable' },
        ]} />
        <div className="flex items-center gap-2 flex-1 sm:justify-end flex-wrap">
          {filter === 'unavailable' && counts.unavailable > 0 && (
            <button type="button" id="btnMakeAllAvailable" onClick={makeAllAvailable} className="btn btn-soft-ok"><i className="fa-solid fa-check-double" />Make all available</button>
          )}
          <SearchInput id="menuSearchInput" value={query} onChange={setQuery} placeholder="Search by name, category or diet" />
        </div>
      </div>

      <div className="card overflow-hidden">
        {menu.isPending ? <Skeleton rows={6} /> : rows.length === 0 ? (
          items.length === 0 ? <EmptyState icon="fa-utensils" title="No dishes in menu" hint="Add your first dish to get started." />
          : query ? <EmptyState icon="fa-magnifying-glass" title={`No dishes match "${query}"`} action={<button type="button" onClick={() => setQuery('')} className="btn btn-secondary btn-sm">Clear search</button>} />
          : filter === 'unavailable' ? <EmptyState icon="fa-circle-check" title="All dishes are currently available" hint="To mark a dish unavailable, use the switch in All dishes." />
          : <EmptyState icon="fa-ban" title="No dishes available" hint="All items in the menu are currently marked unavailable." />
        ) : (
          <table className="rtable">
            <thead><tr><th>Item name</th><th>Category</th><th>Diet</th><th>Price</th><th>Availability</th><th className="text-right">Actions</th></tr></thead>
            <tbody id="menuTableBody">
              {rows.map((i) => {
                const avail = isAvailable(i);
                return (
                  <tr key={i.id}>
                    <td data-label="" className="cell-title font-medium text-fg">
                      <span className="flex items-center gap-2">{i.name}{!avail && <Badge tone="danger">OUT OF STOCK</Badge>}</span>
                    </td>
                    <td data-label="Category" className="text-muted">{i.categoryName || '-'}</td>
                    <td data-label="Diet"><Badge tone={i.isVeg ? 'ok' : 'danger'}>{i.isVeg ? 'VEG' : 'NON-VEG'}</Badge></td>
                    <td data-label="Price" className="font-semibold text-fg">
                      {rupees(i.price)}
                      {i.branchOverride && i.basePrice != null && i.basePrice !== i.price && <span className="ml-1.5 text-xs font-normal text-muted" title="The cafe-wide price">(cafe {rupees(i.basePrice)})</span>}
                    </td>
                    <td data-label="Availability">
                      {filter === 'unavailable'
                        ? <button type="button" onClick={() => toggle.mutate(i.id)} className="btn btn-soft-ok btn-sm" title="Make this item available again"><i className="fa-solid fa-circle-check" />Make available</button>
                        : <span className="flex items-center gap-2"><Switch checked={avail} onChange={() => toggle.mutate(i.id)} label={`Toggle availability of ${i.name}`} /><span className={`text-xs font-medium ${avail ? 'text-ok' : 'text-muted'}`}>{avail ? 'Available' : 'Unavailable'}</span></span>}
                    </td>
                    <td className="cell-actions">
                      <div className="flex items-center justify-end gap-1 w-full md:w-auto">
                        {mayPrice && <button type="button" onClick={() => setModal({ kind: 'branchPrice', dish: i })} title="Set this branch's own price" aria-label={`Branch price of ${i.name}`} className={`btn btn-ghost btn-icon btn-sm ${i.branchOverride ? 'text-brand-text' : ''}`}><i className="fa-solid fa-tag" /></button>}
                        {mayEdit && <button type="button" onClick={() => setModal({ kind: 'dish', dish: i })} title="Edit" aria-label={`Edit ${i.name}`} className="btn btn-ghost btn-icon btn-sm"><i className="fa-regular fa-pen-to-square" /></button>}
                        {mayEdit && <button type="button" onClick={() => onDelete(i)} title="Delete" aria-label={`Delete ${i.name}`} className="btn btn-ghost btn-icon btn-sm hover:!text-danger"><i className="fa-regular fa-trash-can" /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal?.kind === 'dish' && <DishDialog key={modal.dish?.id ?? 'new'} dish={modal.dish} categories={categories.data ?? []} onClose={close} />}
      {modal?.kind === 'modifiers' && <ModifiersAdminDialog onClose={close} />}
      {modal?.kind === 'categories' && <CategoryDialog start={modal.start} categories={categories.data ?? []} items={items} onClose={close} />}
      {modal?.kind === 'recipes' && <RecipeDialog onClose={close} />}
      {modal?.kind === 'import' && <ImportDialog pending={modal.pending} onClose={close} />}
      {modal?.kind === 'branchPrice' && <BranchPriceDialog dish={modal.dish} branchName={branchName} onClose={close} />}
    </section>
  );
}
