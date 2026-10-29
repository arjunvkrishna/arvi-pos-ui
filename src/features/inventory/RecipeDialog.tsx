import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation as useMutation } from '../../lib/useSafeMutation';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { EmptyState, Field, Skeleton } from '../../components/ui';
import { fetchMenuItems, menuItemsKey } from '../menu/api';
import { addRecipeIngredient, deleteRecipeIngredient, fetchInventory, fetchRecipe, inventoryKey } from './api';

const notesKey = (id: string) => `arvi_recipe_notes_${id}`;
const readNotes = (id: string) => { try { return id ? localStorage.getItem(notesKey(id)) || '' : ''; } catch { return ''; } };

/** Dish recipes: link a dish to inventory ingredients (used for automatic stock deduction). Notes stay on this device, as in the classic app. */
export function RecipeDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const dishes = useQuery({ queryKey: menuItemsKey, queryFn: fetchMenuItems });
  const stock = useQuery({ queryKey: inventoryKey, queryFn: fetchInventory });
  const [dishId, setDishId] = useState('');
  const [notes, setNotes] = useState('');
  const [ingredientId, setIngredientId] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('');
  const recipeKey = ['recipe', dishId];
  const recipe = useQuery({ queryKey: recipeKey, queryFn: () => fetchRecipe(Number(dishId)), enabled: !!dishId });

  const add = useMutation({
    mutationFn: () => addRecipeIngredient(Number(dishId), Number(ingredientId), parseFloat(qty), unit.trim()),
    onSuccess: () => { showToast('Ingredient added to recipe', 'success'); setQty(''); setUnit(''); void qc.invalidateQueries({ queryKey: recipeKey }); },
    onError: (e: Error) => showToast(`Failed to add ingredient: ${e.message}`, 'error'),
  });
  const remove = useMutation({
    mutationFn: deleteRecipeIngredient,
    onSuccess: () => { showToast('Ingredient removed from recipe', 'success'); void qc.invalidateQueries({ queryKey: recipeKey }); },
    onError: (e: Error) => showToast(`Failed to delete recipe: ${e.message}`, 'error'),
  });

  const pick = (id: string) => { setDishId(id); setNotes(readNotes(id)); };
  const saveNotes = () => {
    if (!dishId) { showToast('Please select a dish first before saving notes', 'warning'); return; }
    try { localStorage.setItem(notesKey(dishId), notes.trim()); } catch { /* storage unavailable */ }
    showToast('Recipe comments & notes saved successfully!', 'success');
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!dishId) { showToast('Please select a dish first', 'warning'); return; }
    add.mutate();
  };
  const sortedDishes = [...(dishes.data ?? [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const sortedStock = [...(stock.data ?? [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const manualPick = sortedStock.find((i) => String(i.id) === ingredientId && i.autoDeduct === false) ?? null;

  return (
    <Dialog id="recipeModal" open onClose={onClose} size="lg" title="Dish recipes & ingredients" description="Link dishes to inventory ingredients for automatic stock deduction. Items marked as issued by hand are used for cost only.">
      <div className="space-y-5">
        <Field id="recipeMenuItemSelect" label="Dish">
          <select id="recipeMenuItemSelect" value={dishId} onChange={(e) => pick(e.target.value)} className="input">
            <option value="">-- Choose a dish --</option>
            {sortedDishes.map((d) => <option key={d.id} value={d.id}>{d.name} (₹{Number(d.price || 0).toFixed(2)})</option>)}
          </select>
        </Field>

        <div id="recipeIngredientsListSection">
          {!dishId ? <p className="text-sm text-muted text-center py-3">Select a dish above to view its linked recipe ingredients.</p>
            : recipe.isPending ? <Skeleton rows={2} />
            : recipe.isError ? <p className="text-sm text-danger text-center py-2">Failed to load recipes: {recipe.error.message}</p>
            : recipe.data.length === 0 ? <EmptyState icon="fa-book-open" title="No ingredients yet" hint="Add the first ingredient below to enable automatic stock deduction." />
            : (
              <div className="rounded-lg border border-line overflow-hidden">
                <table className="rtable">
                  <thead><tr><th>Ingredient</th><th>Qty / serving</th><th>Cost / serving</th><th className="text-right">Action</th></tr></thead>
                  <tbody>
                    {recipe.data.map((r) => (
                      <tr key={r.id}>
                        <td data-label="Ingredient" className="font-medium text-fg">{r.inventoryItemName}{r.inventoryAutoDeduct === false && <span className="badge badge-neutral ml-2" title="Issued by hand: selling this dish does not reduce its stock">cost only</span>}</td>
                        <td data-label="Qty" className="text-brand-text">{r.quantityPerServing} {r.unit}</td>
                        <td data-label="Cost">₹{Number(r.costPerServing || 0).toFixed(2)}</td>
                        <td className="cell-actions"><div className="flex justify-end w-full"><button type="button" onClick={() => remove.mutate(r.id)} title="Remove ingredient" aria-label={`Remove ${r.inventoryItemName}`} className="btn btn-ghost btn-icon btn-sm hover:!text-danger"><i className="fa-regular fa-trash-can" /></button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>

        <form id="addIngredientToRecipeForm" onSubmit={submit} className="space-y-3">
          <p className="text-sm font-medium text-fg">Add an ingredient</p>
          <Field id="newRecipeIngredientSelect" label="Inventory item">
            <select id="newRecipeIngredientSelect" required value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} className="input">
              <option value="">Select ingredient…</option>
              {sortedStock.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit || 'unit'} - cost ₹{Number(i.costPerUnit || 0).toFixed(2)})</option>)}
            </select>
          </Field>
 {manualPick && <p id="recipeManualNote" className="text-xs text-warn bg-warn/10 rounded-lg px-3 py-2">{manualPick.name} is issued by hand, so selling this dish will not reduce its stock. The recipe is used for cost only. Change this in the item's settings if you want it deducted automatically.</p>}
          <div className="grid grid-cols-2 gap-3">
            <Field id="newRecipeQtyInput" label="Qty per serving"><input id="newRecipeQtyInput" required type="number" inputMode="decimal" step="any" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className="input" placeholder="e.g. 100" /></Field>
            <Field id="newRecipeUnitInput" label="Unit (e.g. g, ml, pcs)"><input id="newRecipeUnitInput" required value={unit} onChange={(e) => setUnit(e.target.value)} className="input" placeholder="g, ml, pcs" /></Field>
          </div>
          <button type="submit" disabled={add.isPending || !dishId} className="btn btn-primary"><i className="fa-solid fa-plus" />Add ingredient</button>
        </form>

        <div id="recipeNotesContainer" className="space-y-2">
          <Field id="recipeDishNotes" label="Dish notes (kept on this device)">
            <textarea id="recipeDishNotes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="input h-auto py-2" placeholder="Special preparation instructions, chef guidelines, allergy alerts or comments…" />
          </Field>
          <button type="button" onClick={saveNotes} className="btn btn-secondary btn-sm"><i className="fa-solid fa-floppy-disk" />Save notes</button>
        </div>
      </div>
    </Dialog>
  );
}
