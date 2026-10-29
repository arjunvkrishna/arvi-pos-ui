import { useState, type FormEvent } from 'react';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/ui';
import { saveCategory, type Category, type MenuItem } from './api';
import { useMenuAction } from './hooks';
import { CATEGORY_ICONS, safeIcon } from './rules';

type View = { kind: 'list' } | { kind: 'form'; category: Category | null; fromList: boolean };

/** "Add category" opens straight on the form; "Edit categories" opens the list and an edit goes back to it. */
export function CategoryDialog({ start, categories, items, onClose }: { start: 'list' | 'add'; categories: Category[]; items: MenuItem[]; onClose: () => void }) {
  const [view, setView] = useState<View>(start === 'add' ? { kind: 'form', category: null, fromList: false } : { kind: 'list' });

  if (view.kind === 'list') {
    const counts: Record<number, number> = {};
    items.forEach((m) => { counts[m.categoryId] = (counts[m.categoryId] ?? 0) + 1; });
    const sorted = [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
    return (
      <Dialog id="categoryModal" open onClose={onClose} title="Edit categories" description="Pick a category to rename it or change its icon and position.">
        <div id="categoryManageList" className="space-y-2">
          {sorted.length === 0 && <p className="text-sm text-muted text-center py-6">No categories yet.</p>}
          {sorted.map((c) => {
            const n = counts[c.id] ?? 0;
            return (
              <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-line">
                <span className="w-9 h-9 rounded-lg bg-brand/15 text-brand-text flex items-center justify-center shrink-0"><i className={`fa-solid ${safeIcon(c.icon)}`} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg truncate">{c.name}</p>
                  <p className="text-xs text-muted">{n} dish{n === 1 ? '' : 'es'} · position {Number(c.sortOrder) || 0}{c.description ? ` · ${c.description}` : ''}</p>
                </div>
                <button type="button" onClick={() => setView({ kind: 'form', category: c, fromList: true })} title={`Edit ${c.name}`} aria-label={`Edit ${c.name}`} className="btn btn-secondary btn-icon btn-sm">
                  <i className="fa-regular fa-pen-to-square" />
                </button>
              </div>
            );
          })}
        </div>
      </Dialog>
    );
  }
  return <CategoryForm key={view.category?.id ?? 'new'} category={view.category} fromList={view.fromList} count={categories.length}
    onBack={() => setView({ kind: 'list' })} onClose={onClose} />;
}

function CategoryForm({ category, fromList, count, onBack, onClose }: { category: Category | null; fromList: boolean; count: number; onBack: () => void; onClose: () => void }) {
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [icon, setIcon] = useState(safeIcon(category?.icon));
  const [sortOrder, setSortOrder] = useState(category?.sortOrder != null ? String(category.sortOrder) : String(count + 1));
  const save = useMenuAction((c: Parameters<typeof saveCategory>[1]) => saveCategory(category?.id ?? null, c),
    category ? `Category "${name.trim()}" updated` : 'Category created successfully', `Failed to ${category ? 'update' : 'create'} category`);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const order = sortOrder === '' ? count + 1 : parseInt(sortOrder, 10);
    save.mutate({ name: name.trim(), description: description.trim(), icon, sortOrder: Number.isFinite(order) ? order : count + 1, active: category ? category.active !== false : true },
      { onSuccess: () => { if (category && fromList) onBack(); else onClose(); } });
  };

  return (
    <Dialog id="categoryModal" open onClose={onClose} title={category ? `Edit category: ${category.name}` : 'Add menu category'}>
      <form id="categoryForm" onSubmit={submit} className="space-y-4">
        <Field id="catName" label="Category name">
          <input id="catName" required autoFocus value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="e.g. Special Desserts" />
        </Field>
        <Field id="catDescription" label="Description">
          <input id="catDescription" value={description} onChange={(e) => setDescription(e.target.value)} className="input" placeholder="Short description" />
        </Field>
        <div>
          <span className="label">Icon</span>
          <div id="catIconPicker" className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
            {CATEGORY_ICONS.map(([cls, label]) => (
              <button key={cls} type="button" title={label} aria-label={label} aria-pressed={icon === cls} onClick={() => setIcon(cls)}
                className={`h-9 rounded-lg border text-sm flex items-center justify-center transition ${icon === cls ? 'bg-brand text-gray-950 border-brand' : 'border-line text-muted hover:text-fg hover:bg-subtle'}`}>
                <i className={`fa-solid ${cls}`} />
              </button>
            ))}
          </div>
        </div>
        <Field id="catSortOrder" label="Position" hint="Lower numbers are shown first in the POS and on the public menu.">
          <input id="catSortOrder" type="number" min="0" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="input" />
        </Field>
        <div className="flex gap-2">
          {fromList && <button type="button" id="btnCategoryBack" onClick={onBack} className="btn btn-secondary h-10">Back</button>}
          <button type="submit" id="btnSaveCategory" disabled={save.isPending} className="btn btn-primary flex-1 h-10">{category ? 'Save changes' : 'Save category'}</button>
        </div>
      </form>
    </Dialog>
  );
}
