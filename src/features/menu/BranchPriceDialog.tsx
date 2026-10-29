import { useState, type FormEvent } from 'react';
import { Dialog } from '../../components/Dialog';
import { showToast } from '../../components/toast';
import { Field } from '../../components/ui';
import { resetBranchSetting, setBranchPrice, type MenuItem } from './api';
import { useMenuAction } from './hooks';
import { rupees } from './rules';

/** A branch may sell a dish at its own price. The dish itself, its category and its recipe stay shared by every branch. */
export function BranchPriceDialog({ dish, branchName, onClose }: { dish: MenuItem; branchName?: string | null; onClose: () => void }) {
  const [price, setPrice] = useState(String(dish.price ?? ''));
  const save = useMenuAction((p: number) => setBranchPrice(dish.id, p), `Price of "${dish.name}" set for this branch`, 'Could not set the branch price');
  const reset = useMenuAction(() => resetBranchSetting(dish.id), `"${dish.name}" is back to the cafe price here`, 'Could not reset the branch price');
  const cafePrice = dish.basePrice ?? dish.price;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = Number(price);
    if (!Number.isFinite(value) || value < 0) { showToast('Enter a price of zero or more.', 'error'); return; }
    save.mutate(value, { onSuccess: onClose });
  };

  return (
    <Dialog id="branchPriceModal" open onClose={onClose} size="sm" title={`Price at ${branchName || 'this branch'}`}
      description={<>{dish.name} · cafe price {rupees(cafePrice)}</>}>
      <form className="space-y-4" onSubmit={submit}>
        <Field id="branchPriceInput" label="Price in this branch (₹)" hint="Only this branch's bills and its customer menu use it.">
          <input id="branchPriceInput" type="number" min={0} step="0.01" autoFocus className="input" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <div className="flex items-center justify-between gap-2">
          {dish.branchOverride ? <button type="button" className="btn btn-ghost" disabled={reset.isPending} onClick={() => reset.mutate(undefined, { onSuccess: onClose })}><i className="fa-solid fa-rotate-left" />Use cafe price</button> : <span />}
          <div className="flex gap-2"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary" disabled={save.isPending}>Save</button></div>
        </div>
      </form>
    </Dialog>
  );
}
