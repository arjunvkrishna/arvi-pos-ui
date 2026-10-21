import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { User, Outlet, Role } from '../types/pos';
import {
  Users,
  Plus,
  Phone,
  Mail,
  Shield,
  X,
  Store,
  KeyRound,
  Check,
  CheckCircle2,
  AlertCircle,
  Building2,
  Lock,
  Edit2,
  UserCheck,
  UserX,
  CreditCard,
  ShoppingBag,
  Package,
  Wallet,
  BarChart3,
} from 'lucide-react';

export const StaffView: React.FC = () => {
  const { user: currentUser, outlets } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states for Create User
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('CASHIER');
  const [outletId, setOutletId] = useState<number | undefined>(undefined);
  const [canBill, setCanBill] = useState(true);
  const [canTakeOrders, setCanTakeOrders] = useState(true);
  const [canManageInventory, setCanManageInventory] = useState(false);
  const [canManageExpenses, setCanManageExpenses] = useState(false);
  const [canViewReports, setCanViewReports] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for Edit Permissions
  const [editActive, setEditActive] = useState(true);
  const [editOutletId, setEditOutletId] = useState<number | undefined>(undefined);
  const [editCanBill, setEditCanBill] = useState(false);
  const [editCanTakeOrders, setEditCanTakeOrders] = useState(false);
  const [editCanManageInventory, setEditCanManageInventory] = useState(false);
  const [editCanManageExpenses, setEditCanManageExpenses] = useState(false);
  const [editCanViewReports, setEditCanViewReports] = useState(false);

  // Form state for Reset Password
  const [newStaffPassword, setNewStaffPassword] = useState('');

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<User[]>('/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Failed to load users:', e);
      setFeedback({ type: 'error', text: e.message || 'Could not load staff members' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Set permission defaults based on selected role
  const handleRoleChange = (selectedRole: Role) => {
    setRole(selectedRole);
    if (selectedRole === 'GENERAL_MANAGER') {
      setOutletId(undefined); // GM has multi-outlet privilege
      setCanBill(true);
      setCanTakeOrders(true);
      setCanManageInventory(true);
      setCanManageExpenses(true);
      setCanViewReports(true);
    } else if (selectedRole === 'MANAGER') {
      if (outlets.length > 0 && !outletId) {
        setOutletId(outlets[0].id);
      }
      setCanBill(true);
      setCanTakeOrders(true);
      setCanManageInventory(true);
      setCanManageExpenses(true);
      setCanViewReports(true);
    } else if (selectedRole === 'CASHIER') {
      setCanBill(true);
      setCanTakeOrders(true);
      setCanManageInventory(false);
      setCanManageExpenses(false);
      setCanViewReports(false);
    } else if (selectedRole === 'CAPTAIN') {
      setCanBill(false);
      setCanTakeOrders(true);
      setCanManageInventory(false);
      setCanManageExpenses(false);
      setCanViewReports(false);
    } else if (selectedRole === 'KITCHEN') {
      setCanBill(false);
      setCanTakeOrders(false);
      setCanManageInventory(false);
      setCanManageExpenses(false);
      setCanViewReports(false);
    } else {
      setCanBill(false);
      setCanTakeOrders(true);
      setCanManageInventory(false);
      setCanManageExpenses(false);
      setCanViewReports(false);
    }
  };

  const openCreateModal = () => {
    setUsername('');
    setPassword('');
    setEmployeeName('');
    setEmail('');
    setPhone('');
    handleRoleChange('CASHIER');
    if (outlets.length > 0) {
      setOutletId(outlets[0].id);
    }
    setShowCreateModal(true);
    setFeedback(null);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setFeedback({ type: 'error', text: 'Username and password are required' });
      return;
    }
    setIsSubmitting(true);
    setFeedback(null);
    try {
      await api.post('/users', {
        username: username.trim(),
        password,
        role,
        employeeName: employeeName.trim() || username.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        outletId: role === 'GENERAL_MANAGER' ? undefined : outletId,
        canBill,
        canTakeOrders,
        canManageInventory,
        canManageExpenses,
        canViewReports,
      });
      setShowCreateModal(false);
      setFeedback({ type: 'success', text: `Staff user '${username}' registered successfully!` });
      await loadUsers();
    } catch (e: any) {
      setFeedback({ type: 'error', text: e.message || 'Failed to create staff member' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (u: User) => {
    setSelectedUser(u);
    setEditActive(u.active !== false);
    setEditOutletId(u.outletId);
    setEditCanBill(u.canBill ?? (u.role !== 'CAPTAIN' && u.role !== 'KITCHEN'));
    setEditCanTakeOrders(u.canTakeOrders ?? (u.role !== 'KITCHEN'));
    setEditCanManageInventory(Boolean(u.canManageInventory));
    setEditCanManageExpenses(Boolean(u.canManageExpenses));
    setEditCanViewReports(Boolean(u.canViewReports));
    setShowEditModal(true);
    setFeedback(null);
  };

  const handleUpdatePermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      await api.put(`/users/${selectedUser.id}/permissions`, {
        active: editActive,
        outletId: selectedUser.role === 'GENERAL_MANAGER' ? undefined : editOutletId,
        canBill: editCanBill,
        canTakeOrders: editCanTakeOrders,
        canManageInventory: editCanManageInventory,
        canManageExpenses: editCanManageExpenses,
        canViewReports: editCanViewReports,
      });
      setShowEditModal(false);
      setFeedback({ type: 'success', text: `Permissions for ${selectedUser.username} updated!` });
      await loadUsers();
    } catch (e: any) {
      setFeedback({ type: 'error', text: e.message || 'Failed to update permissions' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openResetPasswordModal = (u: User) => {
    setSelectedUser(u);
    setNewStaffPassword('');
    setShowResetPasswordModal(true);
    setFeedback(null);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newStaffPassword.trim()) return;
    if (newStaffPassword.length < 6) {
      setFeedback({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }
    setIsSubmitting(true);
    setFeedback(null);
    try {
      await api.post(`/users/${selectedUser.id}/reset-password`, {
        newPassword: newStaffPassword.trim(),
      });
      setShowResetPasswordModal(false);
      setFeedback({ type: 'success', text: `Password for ${selectedUser.username} has been reset!` });
    } catch (e: any) {
      setFeedback({ type: 'error', text: e.message || 'Failed to reset password' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadgeStyle = (r: Role) => {
    switch (r) {
      case 'ADMIN':
      case 'CAFE_ADMIN':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'GENERAL_MANAGER':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'MANAGER':
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
      case 'CASHIER':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'CAPTAIN':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      case 'KITCHEN':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      default:
        return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center space-x-2">
            <Users className="w-7 h-7 text-amber-400" />
            <span>Staff &amp; Role-Based Access Control (RBAC)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure multi-outlet general managers, branch managers, cashiers, captains, and granular operational permissions
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Add Staff / Manager</span>
        </button>
      </div>

      {/* Notification banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center space-x-3 text-xs font-medium animate-fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Staff Grid */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-2 text-slate-400">
          <div className="w-8 h-8 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
          <span className="text-xs">Loading staff team members...</span>
        </div>
      ) : users.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl border-slate-800 text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-amber-400" />
          <h3 className="text-sm font-bold text-slate-200">No staff members found</h3>
          <p className="text-xs mt-1">Get started by creating your first manager, cashier, or captain</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {users.map((u) => {
            const isSelf = currentUser?.username === u.username;
            const isGM = u.role === 'GENERAL_MANAGER';
            const isOutletManager = u.role === 'MANAGER';

            return (
              <div
                key={u.id}
                className="glass-panel p-5 rounded-2xl border-slate-800/80 space-y-4 hover:border-slate-700 transition relative flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: Name, Username, Role */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-white text-sm">{u.employeeName || u.username}</h3>
                        {isSelf && (
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.2 rounded border border-amber-500/30">
                            YOU
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">@{u.username}</p>
                    </div>

                    <div className="flex flex-col items-end space-y-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getRoleBadgeStyle(u.role)}`}>
                        {u.role}
                      </span>
                      {u.active === false ? (
                        <span className="text-[9px] text-rose-400 font-medium">Inactive</span>
                      ) : (
                        <span className="text-[9px] text-emerald-400 font-medium">Active</span>
                      )}
                    </div>
                  </div>

                  {/* Outlet Assignment Banner */}
                  <div className="mt-3 p-2.5 rounded-xl bg-surface-950/60 border border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 text-slate-300">
                      {isGM ? (
                        <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                      ) : (
                        <Store className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <span className="font-semibold text-[11px]">
                        {isGM
                          ? 'Multi-Outlet Governance (All Branches)'
                          : u.outletName
                          ? `${u.outletName} (${u.outletCode || 'Branch'})`
                          : 'Unassigned / Global'}
                      </span>
                    </div>
                    {isOutletManager && (
                      <span className="text-[9px] bg-cyan-500/10 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/20 font-bold">
                        Single Outlet
                      </span>
                    )}
                  </div>

                  {/* Granular Permissions Badges */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80">
                    <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">
                      Operational Privileges
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-lg border font-medium flex items-center space-x-1 ${
                          u.canBill !== false
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            : 'bg-slate-900 text-slate-600 border-slate-800 line-through'
                        }`}
                      >
                        <CreditCard className="w-3 h-3" />
                        <span>Billing</span>
                      </span>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-lg border font-medium flex items-center space-x-1 ${
                          u.canTakeOrders !== false
                            ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
                            : 'bg-slate-900 text-slate-600 border-slate-800 line-through'
                        }`}
                      >
                        <ShoppingBag className="w-3 h-3" />
                        <span>Captain</span>
                      </span>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-lg border font-medium flex items-center space-x-1 ${
                          u.canManageInventory
                            ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                            : 'bg-slate-900 text-slate-600 border-slate-800 line-through'
                        }`}
                      >
                        <Package className="w-3 h-3" />
                        <span>Inventory</span>
                      </span>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-lg border font-medium flex items-center space-x-1 ${
                          u.canManageExpenses
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                            : 'bg-slate-900 text-slate-600 border-slate-800 line-through'
                        }`}
                      >
                        <Wallet className="w-3 h-3" />
                        <span>Expenses</span>
                      </span>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-lg border font-medium flex items-center space-x-1 ${
                          u.canViewReports
                            ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                            : 'bg-slate-900 text-slate-600 border-slate-800 line-through'
                        }`}
                      >
                        <BarChart3 className="w-3 h-3" />
                        <span>Reports</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <button
                    onClick={() => openEditModal(u)}
                    className="flex items-center space-x-1 text-slate-400 hover:text-amber-400 font-semibold transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit RBAC</span>
                  </button>

                  <button
                    onClick={() => openResetPasswordModal(u)}
                    className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 font-semibold transition"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                    <span>Reset Pass</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Staff / Manager */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-surface-900 border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Create Staff / Manager Account</h3>
                  <p className="text-[11px] text-slate-400">Add credentials, assign branch &amp; operational roles</p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              {/* Account Credentials */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. manager_indira"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Temporary Password *</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Min 6 chars"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Personal Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+91..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Assigned Role</label>
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as Role)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="GENERAL_MANAGER">General Manager (Multi-Franchise Governance)</option>
                  <option value="MANAGER">Branch Manager (Single Outlet Authority)</option>
                  <option value="CASHIER">Billing Cashier (Counter Checkout & Shifts)</option>
                  <option value="CAPTAIN">Floor Captain (Take Orders & Tables)</option>
                  <option value="EMPLOYEE">General Cafe Staff</option>
                  <option value="KITCHEN">Kitchen Chef / KDS Display</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  {role === 'GENERAL_MANAGER' && '⭐️ Right hand to Cafe Admin: Manages all franchise branches, cross-outlet inventory & managers.'}
                  {role === 'MANAGER' && '📍 Single Outlet Manager: Can only access and manage staff, expenses, and inventory for the assigned branch.'}
                  {role === 'CASHIER' && '💳 Cashier: Focused on POS billing, printing receipts, and opening/closing cash shifts.'}
                  {role === 'CAPTAIN' && '📝 Floor Captain: Table management, taking customer orders, and dispatching KOTs to kitchen.'}
                </p>
              </div>

              {/* Outlet / Branch Selection */}
              {role !== 'GENERAL_MANAGER' ? (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Assigned Branch / Outlet *</label>
                  <select
                    required
                    value={outletId || ''}
                    onChange={(e) => setOutletId(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- Select Specific Outlet --</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.code})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs">
                  <span className="font-bold block mb-0.5">Multi-Franchise Unified Scope</span>
                  General Managers operate above single outlets and have combined access across all franchises.
                </div>
              )}

              {/* Granular Permission Checkboxes */}
              <div className="p-3.5 bg-surface-950/60 border border-slate-800 rounded-xl space-y-2.5">
                <span className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Operational Privileges &amp; Permissions
                </span>

                <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canBill}
                    onChange={(e) => setCanBill(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
                  />
                  <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                  <span>POS Billing &amp; Bill Generation (canBill)</span>
                </label>

                <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canTakeOrders}
                    onChange={(e) => setCanTakeOrders(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <ShoppingBag className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Take Orders / Captain Tables (canTakeOrders)</span>
                </label>

                <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canManageInventory}
                    onChange={(e) => setCanManageInventory(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-purple-500 focus:ring-0"
                  />
                  <Package className="w-3.5 h-3.5 text-purple-400" />
                  <span>Inventory Management &amp; Stock Inward (canManageInventory)</span>
                </label>

                <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canManageExpenses}
                    onChange={(e) => setCanManageExpenses(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0"
                  />
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Expense Logging &amp; Petpooja Payouts (canManageExpenses)</span>
                </label>

                <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canViewReports}
                    onChange={(e) => setCanViewReports(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-blue-500 focus:ring-0"
                  />
                  <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Analytics Reports &amp; Financial P&amp;L (canViewReports)</span>
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Registering...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Permissions */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-surface-900 border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">Edit RBAC: {selectedUser.username}</h3>
                <p className="text-[11px] text-slate-400">Role: {selectedUser.role}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdatePermissions} className="space-y-4 mt-4">
              {/* Account Status Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-950 border border-slate-800">
                <span className="text-xs font-semibold text-slate-200">Account Active</span>
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-amber-500"
                />
              </div>

              {/* Outlet Assignment */}
              {selectedUser.role !== 'GENERAL_MANAGER' && selectedUser.role !== 'ADMIN' && selectedUser.role !== 'SUPER_ADMIN' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Assigned Branch / Outlet</label>
                  <select
                    value={editOutletId || ''}
                    onChange={(e) => setEditOutletId(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Unassigned</option>
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Permissions Checkboxes */}
              <div className="p-3.5 bg-surface-950/60 border border-slate-800 rounded-xl space-y-2.5">
                <span className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Granted Privileges
                </span>

                <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editCanBill}
                    onChange={(e) => setEditCanBill(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-amber-500"
                  />
                  <span>POS Billing &amp; Bill Generation</span>
                </label>

                <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editCanTakeOrders}
                    onChange={(e) => setEditCanTakeOrders(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                  />
                  <span>Take Orders / Captain Mode</span>
                </label>

                <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editCanManageInventory}
                    onChange={(e) => setEditCanManageInventory(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-purple-500"
                  />
                  <span>Inventory Stock &amp; Inward</span>
                </label>

                <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editCanManageExpenses}
                    onChange={(e) => setEditCanManageExpenses(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-emerald-500"
                  />
                  <span>Expense Logging &amp; Petpooja P&amp;L</span>
                </label>

                <label className="flex items-center space-x-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editCanViewReports}
                    onChange={(e) => setEditCanViewReports(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-blue-500"
                  />
                  <span>Reports &amp; Analytics</span>
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Update RBAC'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Staff Password */}
      {showResetPasswordModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-surface-900 border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Reset Staff Password</h3>
              <button onClick={() => setShowResetPasswordModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4 mt-4">
              <p className="text-xs text-slate-400">
                Assign a new password for <span className="font-bold text-slate-200">@{selectedUser.username}</span>:
              </p>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">New Password (min. 6 characters)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowResetPasswordModal(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Resetting...' : 'Confirm Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
