// NERAM POS - on-demand module: Dish recipes
// Loaded the first time one of its functions is used (see "ON-DEMAND CODE" in app.js). Declarations only: no code may run at load.
// Shared state that other files read must be declared in app.js. After editing run: node tools/check-chunks.js --write

// DISH RECIPES & INVENTORY INGREDIENTS (Feature 4)
// ============================================================
async function openRecipeModal() {
  const modal = document.getElementById('recipeModal');
  if (!modal) return;

  // Populate dishes dropdown
  const dishSelect = document.getElementById('recipeMenuItemSelect');
  dishSelect.innerHTML = '<option value="">-- Choose a Dish --</option>';
  try {
    if (!menuItems || menuItems.length === 0) {
      menuItems = await apiRequest('/menu-items');
    }
    (menuItems || [])
      .slice()
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        const dishName = item.name || item.itemName || 'Dish';
        opt.textContent = `${dishName} (₹${Number(item.price || 0).toFixed(2)})`;
        dishSelect.appendChild(opt);
      });
  } catch (err) {
    console.warn('Could not load menu items for recipes:', err);
  }

  // Populate inventory dropdown
  const ingrSelect = document.getElementById('newRecipeIngredientSelect');
  ingrSelect.innerHTML = '<option value="">Select ingredient...</option>';
  try {
    const invItems = await apiRequest('/inventory');
    (invItems || [])
      .slice()
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .forEach(inv => {
        const opt = document.createElement('option');
        opt.value = inv.id;
        const invName = inv.name || inv.itemName || 'Ingredient';
        opt.textContent = `${invName} (${inv.unit || 'unit'} - Cost: ₹${Number(inv.costPerUnit || 0).toFixed(2)})`;
        ingrSelect.appendChild(opt);
      });
  } catch (err) {
    console.warn('Could not load inventory items for recipes:', err);
  }

  document.getElementById('recipeIngredientsListSection').innerHTML = '<div class="text-xs text-gray-500 py-3 text-center">Select a dish above to view its linked recipe ingredients</div>';
  loadRecipeDishNotes('');
  modal.classList.remove('hidden');
}

function closeRecipeModal() {
  const modal = document.getElementById('recipeModal');
  if (modal) modal.classList.add('hidden');
}

function loadRecipeDishNotes(menuItemId) {
  const notesEl = document.getElementById('recipeDishNotes');
  if (!notesEl) return;
  if (!menuItemId) {
    notesEl.value = '';
    return;
  }
  const saved = localStorage.getItem(`neram_recipe_notes_${menuItemId}`) || '';
  notesEl.value = saved;
}

function saveDishRecipeNotes() {
  const menuItemId = document.getElementById('recipeMenuItemSelect')?.value;
  if (!menuItemId) {
    showToast('Please select a dish first before saving notes', 'warning');
    return;
  }
  const notesEl = document.getElementById('recipeDishNotes');
  const val = notesEl ? notesEl.value.trim() : '';
  localStorage.setItem(`neram_recipe_notes_${menuItemId}`, val);
  showToast('Recipe comments & notes saved successfully!', 'success');
}

async function loadRecipeForSelectedDish() {
  const menuItemId = document.getElementById('recipeMenuItemSelect').value;
  const listEl = document.getElementById('recipeIngredientsListSection');
  loadRecipeDishNotes(menuItemId);

  if (!menuItemId) {
    listEl.innerHTML = '<div class="text-xs text-gray-500 py-3 text-center">Select a dish above to view its linked recipe ingredients</div>';
    return;
  }

  listEl.innerHTML = '<div class="text-xs text-gray-400 py-2 text-center"><i class="fa-solid fa-spinner fa-spin mr-1"></i>Loading ingredients...</div>';

  try {
    const recipes = await apiRequest(`/recipes/menu-item/${menuItemId}`);
    if (!recipes || recipes.length === 0) {
      listEl.innerHTML = '<div class="text-xs text-amber-400/80 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 text-center">No recipe ingredients defined yet for this dish. Add below to enable automatic stock deduction.</div>';
      return;
    }

    listEl.innerHTML = `
      <div class="border border-gray-800 rounded-xl overflow-hidden">
        <table class="w-full text-left text-xs text-gray-300">
          <thead class="bg-gray-900/80 text-gray-400 text-[10px] uppercase">
            <tr>
              <th class="p-2.5">Ingredient</th>
              <th class="p-2.5">Qty / Serving</th>
              <th class="p-2.5">Cost / Serving</th>
              <th class="p-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800/60">
            ${recipes.map(r => `
              <tr class="hover:bg-gray-800/30">
                <td class="p-2.5 font-semibold text-white">${escapeHtml(r.inventoryItemName)}</td>
                <td class="p-2.5 font-mono text-amber-300">${r.quantityPerServing} ${escapeHtml(r.unit)}</td>
                <td class="p-2.5 text-gray-300">₹${Number(r.costPerServing || 0).toFixed(2)}</td>
                <td class="p-2.5 text-right">
                  <button onclick="deleteRecipeItem(${r.id})" class="p-1 text-rose-400 hover:text-rose-300 text-xs rounded hover:bg-rose-500/10" title="Remove Ingredient">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    listEl.innerHTML = `<div class="text-xs text-rose-400 py-2 text-center">Failed to load recipes: ${err.message}</div>`;
  }
}

async function addIngredientToRecipe(e) {
  e.preventDefault();
  const menuItemId = document.getElementById('recipeMenuItemSelect').value;
  if (!menuItemId) {
    showToast('Please select a dish first', 'warning');
    return;
  }
  const inventoryItemId = Number(document.getElementById('newRecipeIngredientSelect').value);
  const quantityPerServing = parseFloat(document.getElementById('newRecipeQtyInput').value);
  const unit = document.getElementById('newRecipeUnitInput').value.trim();

  try {
    await apiRequest('/recipes', {
      method: 'POST',
      body: JSON.stringify({
        menuItemId: Number(menuItemId),
        inventoryItemId,
        quantityPerServing,
        unit,
        active: true
      })
    });
    showToast('Ingredient added to recipe', 'success');
    document.getElementById('newRecipeQtyInput').value = '';
    document.getElementById('newRecipeUnitInput').value = '';
    loadRecipeForSelectedDish();
  } catch (err) {
    showToast('Failed to add ingredient: ' + err.message, 'error');
  }
}

async function deleteRecipeItem(recipeId) {
  if (!confirm('Remove this ingredient from the recipe?')) return;
  try {
    await apiRequest(`/recipes/${recipeId}`, { method: 'DELETE' });
    showToast('Ingredient removed from recipe', 'success');
    loadRecipeForSelectedDish();
  } catch (err) {
    showToast('Failed to delete recipe: ' + err.message, 'error');
  }
}

// ============================================================
