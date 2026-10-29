import { useState, type FormEvent } from 'react';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { CheckRow, Field } from '../../components/ui';
import { saveDish, type Category, type MenuItem } from './api';
import { useMenuAction } from './hooks';

/** Add (dish = null) or edit a dish. */
export function DishDialog({ dish, categories, onClose }: { dish: MenuItem | null; categories: Category[]; onClose: () => void }) {
  const [name, setName] = useState(dish?.name ?? '');
  const [categoryId, setCategoryId] = useState(String(dish?.categoryId ?? categories[0]?.id ?? ''));
  const [price, setPrice] = useState(dish ? String(dish.price) : '');
  const [description, setDescription] = useState(dish?.description ?? '');
  const [isVeg, setIsVeg] = useState(dish?.isVeg ?? true);
  const [isAvailable, setIsAvailable] = useState(dish?.isAvailable ?? true);
  const save = useMenuAction((d: Parameters<typeof saveDish>[1]) => saveDish(dish?.id ?? null, d),
    dish ? 'Dish updated successfully' : 'New dish added to menu', 'Error saving dish');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = parseFloat(price);
    if (!Number.isFinite(value) || value < 0) { showToast('Enter a valid price', 'error'); return; }
    if (!categoryId) { showToast('Add a category first', 'error'); return; }
    save.mutate({ name: name.trim(), categoryId: parseInt(categoryId, 10), price: value, description: description.trim(), isVeg, isAvailable, active: true }, { onSuccess: onClose });
  };

  return (
    <Dialog id="dishModal" open onClose={onClose} title={dish ? 'Edit dish & price' : 'Add new dish'}>
      <form id="dishForm" onSubmit={submit} className="space-y-4">
        <Field id="dishName" label="Dish name">
          <input id="dishName" required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="e.g. Paneer Tikka" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="dishCategory" label="Category">
            <select id="dishCategory" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field id="dishPrice" label="Price (₹)">
            <input id="dishPrice" required type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="input" placeholder="150" />
          </Field>
        </div>
        <Field id="dishDescription" label="Description">
          <textarea id="dishDescription" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="input h-auto py-2" placeholder="Ingredients, taste notes…" />
        </Field>
        <div className="rounded-lg border border-line p-3 space-y-1">
          <CheckRow id="dishIsVeg" checked={isVeg} onChange={setIsVeg} title="Vegetarian" hint="Shown with a VEG badge on the menu" />
          <CheckRow id="dishIsAvailable" checked={isAvailable} onChange={setIsAvailable} title="Available in POS" hint="Turn off when the dish is out of stock" />
        </div>
        <button type="submit" disabled={save.isPending} className="btn btn-primary w-full h-10">{save.isPending ? 'Saving…' : dish ? 'Save changes' : 'Add dish'}</button>
      </form>
    </Dialog>
  );
}
