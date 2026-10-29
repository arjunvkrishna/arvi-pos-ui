import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog } from '../../components/Dialog';
import { Badge, Skeleton } from '../../components/ui';
import {
  fetchModifiersForMenuItem,
  fetchCombosForMenuItem,
  menuItemModifiersKey,
  menuItemCombosKey,
  type Modifier,
  type ComboItem,
} from './api';
import {
  defaultComboSelection,
  defaultModifierSelection,
  isSelectionValid,
  summariseSelection,
  toggleChoice,
  type Selection,
} from './selection';

export interface ModifierCustomizationResult {
  price: number;
  modifiersSnapshot?: string;
  comboSnapshot?: string;
  summaryText: string;
}

export function ModifierModal({
  dish,
  onClose,
  onConfirm,
}: {
  dish: { id: number; name: string; price: number };
  onClose: () => void;
  onConfirm: (res: ModifierCustomizationResult) => void;
}) {
  const modQ = useQuery({
    queryKey: menuItemModifiersKey(dish.id),
    queryFn: () => fetchModifiersForMenuItem(dish.id),
  });

  const comboQ = useQuery({
    queryKey: menuItemCombosKey(dish.id),
    queryFn: () => fetchCombosForMenuItem(dish.id),
  });

  const groups = useMemo(() => modQ.data ?? [], [modQ.data]);
  const comboGroups = useMemo(() => comboQ.data ?? [], [comboQ.data]);

  // Defaults come from the loaded groups; what the cashier toggles is layered on top of them.
  const defaultModifiers = useMemo(() => defaultModifierSelection(groups), [groups]);
  const defaultComboItems = useMemo(() => defaultComboSelection(comboGroups), [comboGroups]);
  const [modifierEdits, setModifierEdits] = useState<Selection>({});
  const [comboEdits, setComboEdits] = useState<Selection>({});
  const selectedModifiers = useMemo(() => ({ ...defaultModifiers, ...modifierEdits }), [defaultModifiers, modifierEdits]);
  const selectedComboItems = useMemo(() => ({ ...defaultComboItems, ...comboEdits }), [defaultComboItems, comboEdits]);

  const handleToggleModifier = (groupId: number, mod: Modifier, isSingleChoice: boolean) => {
    if (!mod.id) return;
    setModifierEdits((edits) => {
      const current = ({ ...defaultModifiers, ...edits })[groupId] || [];
      const max = groups.find((x) => x.id === groupId)?.maxSelections ?? 0;
      return { ...edits, [groupId]: toggleChoice(current, mod.id!, isSingleChoice, max) };
    });
  };

  const handleToggleComboItem = (groupId: number, item: ComboItem, isSingleChoice: boolean) => {
    setComboEdits((edits) => {
      const current = ({ ...defaultComboItems, ...edits })[groupId] || [];
      const max = comboGroups.find((x) => x.id === groupId)?.maxChoices ?? 0;
      return { ...edits, [groupId]: toggleChoice(current, item.menuItemId, isSingleChoice, max) };
    });
  };

  const isValid = useMemo(
    () => isSelectionValid(groups, comboGroups, selectedModifiers, selectedComboItems),
    [groups, comboGroups, selectedModifiers, selectedComboItems],
  );

  const { totalPrice, modifiersSnapshot, comboSnapshot, summaryList } = useMemo(
    () => summariseSelection(dish.price, groups, comboGroups, selectedModifiers, selectedComboItems),
    [dish.price, groups, comboGroups, selectedModifiers, selectedComboItems],
  );

  const isLoading = modQ.isLoading || comboQ.isLoading;

  return (
    <Dialog
      id="modifierCustomizationModal"
      open
      onClose={onClose}
      size="md"
      title={`Customize: ${dish.name}`}
      description="Choose modifiers, portions, add-ons and combo sides."
    >
      {isLoading ? (
        <div className="p-4 space-y-4">
          <Skeleton rows={6} />
        </div>
      ) : (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {groups.map((g) => {
            const isSingle = g.maxSelections === 1;
            const chosen = selectedModifiers[g.id!] || [];
            return (
              <div key={g.id} className="rounded-xl border border-line bg-subtle/50 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-fg text-sm">{g.name}</span>
                    <span className="text-xs text-muted block">
                      {isSingle ? 'Choose 1' : `Choose up to ${g.maxSelections}`}
                    </span>
                  </div>
                  {g.minSelections > 0 ? (
                    <Badge tone={chosen.length >= g.minSelections ? 'ok' : 'warn'}>
                      {chosen.length >= g.minSelections ? 'Done' : `Required (${g.minSelections})`}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Optional</Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {g.modifiers.map((m) => {
                    const isSelected = chosen.includes(m.id!);
                    const adj = Number(m.priceAdjustment || 0);
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => handleToggleModifier(g.id!, m, isSingle)}
                        className={`text-left p-2.5 rounded-lg border text-xs font-medium transition flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'border-brand bg-brand/10 text-brand-text ring-1 ring-brand'
                            : 'border-line bg-surface text-fg hover:border-brand/50'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <i
                            className={`fa-solid ${
                              isSelected
                                ? isSingle
                                  ? 'fa-circle-dot text-brand'
                                  : 'fa-square-check text-brand'
                                : isSingle
                                ? 'fa-circle text-muted/40'
                                : 'fa-square text-muted/40'
                            }`}
                          />
                          <span>{m.name}</span>
                        </span>
                        {adj > 0 && <span className="font-semibold text-fg">+₹{adj.toFixed(2)}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {comboGroups.map((cg) => {
            const isSingle = cg.maxChoices === 1;
            const chosen = selectedComboItems[cg.id!] || [];
            return (
              <div key={cg.id} className="rounded-xl border border-line bg-subtle/50 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-fg text-sm">{cg.name}</span>
                    <span className="text-xs text-muted block">
                      {isSingle ? 'Choose 1' : `Choose up to ${cg.maxChoices}`}
                    </span>
                  </div>
                  {cg.minChoices > 0 ? (
                    <Badge tone={chosen.length >= cg.minChoices ? 'ok' : 'warn'}>
                      {chosen.length >= cg.minChoices ? 'Done' : `Required (${cg.minChoices})`}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Optional</Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {cg.items.map((item) => {
                    const isSelected = chosen.includes(item.menuItemId);
                    const addPrice = Number(item.additionalPrice || 0);
                    return (
                      <button
                        type="button"
                        key={item.menuItemId}
                        onClick={() => handleToggleComboItem(cg.id!, item, isSingle)}
                        className={`text-left p-2.5 rounded-lg border text-xs font-medium transition flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'border-brand bg-brand/10 text-brand-text ring-1 ring-brand'
                            : 'border-line bg-surface text-fg hover:border-brand/50'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <i
                            className={`fa-solid ${
                              isSelected
                                ? isSingle
                                  ? 'fa-circle-dot text-brand'
                                  : 'fa-square-check text-brand'
                                : isSingle
                                ? 'fa-circle text-muted/40'
                                : 'fa-square text-muted/40'
                            }`}
                          />
                          <span>{item.menuItemName || 'Item'}</span>
                        </span>
                        {addPrice > 0 && (
                          <span className="font-semibold text-fg">+₹{addPrice.toFixed(2)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="border-t border-line pt-3 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted block">Total Item Price</span>
              <span className="text-lg font-bold text-brand-text">₹{totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                id="btnConfirmModifiers"
                disabled={!isValid}
                onClick={() =>
                  onConfirm({
                    price: totalPrice,
                    modifiersSnapshot,
                    comboSnapshot,
                    summaryText: summaryList.join(', '),
                  })
                }
                className="btn btn-primary"
              >
                <i className="fa-solid fa-plus mr-1" />
                Add to Cart (₹{totalPrice.toFixed(2)})
              </button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
