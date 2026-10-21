// NERAM POS - on-demand module: User accounts and permissions
// Loaded the first time one of its functions is used (see "ON-DEMAND CODE" in app.js). Declarations only: no code may run at load.
// Shared state that other files read must be declared in app.js. After editing run: node tools/check-chunks.js --write

// TAB 10: USER ACCOUNT MANAGEMENT
// ============================================================
let usersList = [];

async function loadUsersData() {
  try {
    // Update subtitle based on caller role
    const subtitle = document.getElementById('userMgmtSubtitle');
    if (currentUser.role === 'ADMIN') {
      subtitle.textContent = 'Root Admin View: All users in the system (Admin, Manager, Employee)';
    } else {
      subtitle.textContent = 'Manager View: Managers and Employee accounts';
    }

    usersList = await apiRequest('/users');
    renderUsersTable(usersList);
  } catch (err) {
    showToast('Failed to load users: ' + err.message, 'error');
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-500">No users found</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => `
    <tr class="hover:bg-gray-800/40">
      <td class="p-3 font-bold text-white">
        <i class="fa-solid fa-user mr-1 text-gray-500"></i>
        ${u.username}
      </td>
      <td class="p-3 text-gray-300">${u.employeeName || '<span class="text-gray-600">—</span>'}</td>
      <td class="p-3">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${u.role === 'ADMIN'
      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
      : u.role === 'MANAGER'
        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
    }">${u.role}</span>
      </td>
      <td class="p-3">
        <div class="flex flex-wrap gap-1">
          ${(u.role === 'ADMIN' || u.role === 'MANAGER' || u.canTakeOrders !== false) ? `
            <span class="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1" title="Can take table orders & send KOT/Bill">
              <i class="fa-solid fa-utensils text-[8px]"></i>Orders
            </span>
          ` : `
            <span class="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-gray-800 text-gray-500 border border-gray-700">
              No Orders
            </span>
          `}
          ${(u.role === 'ADMIN' || u.role === 'MANAGER' || u.canManageInventory === true) ? `
            <span class="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1" title="Can manage raw materials and reduce product stock">
              <i class="fa-solid fa-boxes-stacked text-[8px]"></i>Inventory
            </span>
          ` : `
            <span class="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-gray-800 text-gray-500 border border-gray-700">
              No Inv
            </span>
          `}
        </div>
      </td>
      <td class="p-3">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${u.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}">
          ${u.active ? 'ACTIVE' : 'INACTIVE'}
        </span>
      </td>
      <td class="p-3 text-gray-400">${u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '—'}</td>
      <td class="p-3 text-right">
        <div class="flex items-center justify-end space-x-2">
          ${(currentUser.role === 'ADMIN' || (currentUser.role === 'MANAGER' && u.role === 'EMPLOYEE')) ? `
            <button onclick="openUserPermissionsModal(${u.id}, '${u.username}', ${u.canTakeOrders !== false}, ${u.canManageInventory === true})" class="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-semibold" title="Grant or Revoke Feature Access">
              <i class="fa-solid fa-user-gear mr-1"></i>Access
            </button>
          ` : ''}
          ${(currentUser.role === 'ADMIN' || (currentUser.role === 'MANAGER' && u.role === 'EMPLOYEE')) ? `
            <button onclick="openResetPasswordModal(${u.id}, '${u.username}')" class="px-2 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[10px] font-semibold" title="Reset Password">
              <i class="fa-solid fa-key mr-1"></i>Reset Pwd
            </button>
          ` : ''}
          ${(currentUser.role === 'ADMIN' || (currentUser.role === 'MANAGER' && u.role === 'EMPLOYEE')) ? `
            <button onclick="toggleUserActive(${u.id})" class="px-2 py-1 rounded ${u.active ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300' : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300'} text-[10px] font-semibold" title="${u.active ? 'Deactivate' : 'Activate'}">
              <i class="fa-solid ${u.active ? 'fa-user-slash' : 'fa-user-check'} mr-1"></i>${u.active ? 'Deactivate' : 'Activate'}
            </button>
          ` : ''}
          ${currentUser.role === 'ADMIN' ? `
            <button onclick="deleteUserAccount(${u.id})" class="text-gray-500 hover:text-rose-400" title="Delete User">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

async function openCreateUserModal() {
  // Clear form
  document.getElementById('newUsername').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('newUserRole').value = 'EMPLOYEE';

  // Restrict role options based on caller role
  const optManager = document.getElementById('newUserOptManager');
  const optAdmin = document.getElementById('newUserOptAdmin');
  if (currentUser.role === 'ADMIN') {
    optManager.disabled = false; optManager.hidden = false;
    optAdmin.disabled = false; optAdmin.hidden = false;
  } else {
    // Manager can only create EMPLOYEE
    optManager.disabled = true; optManager.hidden = true;
    optAdmin.disabled = true; optAdmin.hidden = true;
  }

  // Reset permissions checkboxes
  const chkTakeOrders = document.getElementById('newUserCanTakeOrders');
  const chkManageInv = document.getElementById('newUserCanManageInventory');
  if (chkTakeOrders) chkTakeOrders.checked = true;
  if (chkManageInv) chkManageInv.checked = false;

  document.getElementById('createUserModal').classList.remove('hidden');
}

async function saveCreateUser(e) {
  e.preventDefault();
  const payload = {
    username: document.getElementById('newUsername').value.trim(),
    password: document.getElementById('newPassword').value,
    role: document.getElementById('newUserRole').value,
    canTakeOrders: document.getElementById('newUserCanTakeOrders') ? document.getElementById('newUserCanTakeOrders').checked : true,
    canManageInventory: document.getElementById('newUserCanManageInventory') ? document.getElementById('newUserCanManageInventory').checked : false
  };

  if (payload.password.length < 6) {
    showToast('Password must be at least 6 characters', 'error');
    return;
  }

  try {
    await apiRequest('/users', { method: 'POST', body: JSON.stringify(payload) });
    showToast('User account created successfully', 'success');
    closeModal('createUserModal');
    loadUsersData();
  } catch (err) {
    showToast('Failed to create user: ' + err.message, 'error');
  }
}

function openResetPasswordModal(userId, username) {
  document.getElementById('resetUserId').value = userId;
  document.getElementById('resetNewPassword').value = '';
  const label = document.getElementById('resetUserLabel');
  label.innerHTML = `Resetting password for: <span class="text-white font-bold">${username}</span>`;
  document.getElementById('resetPasswordModal').classList.remove('hidden');
}

async function saveResetPassword(e) {
  e.preventDefault();
  const id = document.getElementById('resetUserId').value;
  const newPassword = document.getElementById('resetNewPassword').value;

  if (newPassword.length < 6) {
    showToast('Password must be at least 6 characters', 'error');
    return;
  }

  try {
    await apiRequest(`/users/${id}/reset-password`, {
      method: 'PATCH',
      body: JSON.stringify({ newPassword })
    });
    showToast('Password reset successfully', 'success');
    closeModal('resetPasswordModal');
  } catch (err) {
    showToast('Failed to reset password: ' + err.message, 'error');
  }
}

async function toggleUserActive(userId) {
  try {
    await apiRequest(`/users/${userId}/toggle-active`, { method: 'PATCH' });
    showToast('User status updated', 'success');
    loadUsersData();
  } catch (err) {
    showToast('Failed to toggle user status: ' + err.message, 'error');
  }
}

async function deleteUserAccount(userId) {
  if (!confirm('Permanently delete this user account? This cannot be undone.')) return;
  try {
    await apiRequest(`/users/${userId}`, { method: 'DELETE' });
    showToast('User deleted', 'success');
    loadUsersData();
  } catch (err) {
    showToast('Failed to delete user: ' + err.message, 'error');
  }
}

// ============================================================
// MANAGE USER FEATURE PERMISSIONS (Admin & Manager)
// ============================================================
function openUserPermissionsModal(userId, username, canTakeOrders, canManageInventory) {
  document.getElementById('permUserId').value = userId;
  document.getElementById('permModalUsername').textContent = `User: ${username}`;
  document.getElementById('editPermTakeOrders').checked = !!canTakeOrders;
  document.getElementById('editPermManageInventory').checked = !!canManageInventory;
  document.getElementById('userPermissionsModal').classList.remove('hidden');
}

async function saveUserPermissions(e) {
  e.preventDefault();
  const userId = document.getElementById('permUserId').value;
  const canTakeOrders = document.getElementById('editPermTakeOrders').checked;
  const canManageInventory = document.getElementById('editPermManageInventory').checked;

  try {
    await apiRequest(`/users/${userId}/permissions`, {
      method: 'PATCH',
      body: JSON.stringify({ canTakeOrders, canManageInventory })
    });
    showToast('User permissions updated successfully', 'success');
    closeModal('userPermissionsModal');
    loadUsersData();

    // If the caller updated their own account, update in-memory and re-render tabs
    if (currentUser && currentUser.id == userId) {
      currentUser.canTakeOrders = canTakeOrders;
      currentUser.canManageInventory = canManageInventory;
      localStorage.setItem('neram_user', JSON.stringify(currentUser));
      buildNavigationTabs();
    }
  } catch (err) {
    showToast('Failed to update permissions: ' + err.message, 'error');
  }
}

// ============================================================
