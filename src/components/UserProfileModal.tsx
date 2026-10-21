import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { UserProfile } from '../types/pos';
import {
  X,
  User,
  KeyRound,
  Mail,
  Phone,
  MapPin,
  Building2,
  Store,
  Shield,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Lock,
  Save,
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [employeeName, setEmployeeName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadProfile();
      setStatusMessage(null);
    }
  }, [isOpen]);

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<UserProfile>('/users/me');
      setProfile(data);
      setEmployeeName(data.employeeName || '');
      setEmail(data.email || '');
      setPhone(data.phone || '');
      setAddress(data.address || '');
    } catch (e: any) {
      console.error('Failed to load profile:', e);
      setStatusMessage({ type: 'error', text: e.message || 'Failed to load profile details' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const updated = await api.put<UserProfile>('/users/me', {
        employeeName,
        phone,
        email,
        address,
      });
      setProfile(updated);
      updateUser({
        employeeName: updated.employeeName,
      });
      setStatusMessage({ type: 'success', text: 'Profile details updated successfully!' });
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e.message || 'Failed to update profile' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (newPassword.length < 6) {
      setStatusMessage({ type: 'error', text: 'New password must be at least 6 characters long' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatusMessage({ type: 'error', text: 'New password and confirmation do not match' });
      return;
    }
    if (newPassword === currentPassword) {
      setStatusMessage({ type: 'error', text: 'New password cannot be identical to current password' });
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/users/me/change-password', {
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setStatusMessage({ type: 'success', text: 'Password reset successfully! Your new password is now active.' });
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e.message || 'Failed to change password. Please check your current password.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-surface-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-surface-950/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">User Profile & Account</h2>
              <p className="text-xs text-slate-400">Manage your personal credentials, contact info, and security</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-slate-800 bg-surface-950/30 px-6 pt-2">
          <button
            onClick={() => { setActiveTab('profile'); setStatusMessage(null); }}
            className={`flex items-center space-x-2 py-3 px-4 text-xs font-bold border-b-2 transition ${
              activeTab === 'profile'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile Details</span>
          </button>
          <button
            onClick={() => { setActiveTab('security'); setStatusMessage(null); }}
            className={`flex items-center space-x-2 py-3 px-4 text-xs font-bold border-b-2 transition ${
              activeTab === 'security'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Change Password</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Notification banner */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl border flex items-center space-x-3 text-xs font-medium animate-fade-in ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
              <div className="w-7 h-7 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
              <span className="text-xs">Loading profile information...</span>
            </div>
          ) : activeTab === 'profile' ? (
            <div className="space-y-6">
              {/* Account summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-surface-950/60 border border-slate-800 rounded-xl">
                  <div className="flex items-center space-x-2 text-slate-400 text-[11px] mb-1">
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    <span>Role & Access</span>
                  </div>
                  <div className="text-xs font-bold text-slate-200">{profile?.role || user?.role}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">@{profile?.username || user?.username}</div>
                </div>

                <div className="p-3 bg-surface-950/60 border border-slate-800 rounded-xl">
                  <div className="flex items-center space-x-2 text-slate-400 text-[11px] mb-1">
                    <Store className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Assigned Outlet</span>
                  </div>
                  <div className="text-xs font-bold text-slate-200">
                    {profile?.outletName || (profile?.role === 'GENERAL_MANAGER' || profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN' ? 'All Franchises' : 'Default Branch')}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{profile?.tenantName || 'ARVI Cafe'}</div>
                </div>

                <div className="p-3 bg-surface-950/60 border border-slate-800 rounded-xl">
                  <div className="flex items-center space-x-2 text-slate-400 text-[11px] mb-1">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <span>Account Status</span>
                  </div>
                  <div className="text-xs font-bold text-emerald-400 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Active Member</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {profile?.accountCreatedAt ? new Date(profile.accountCreatedAt).toLocaleDateString() : 'Verified'}
                  </div>
                </div>
              </div>

              {/* Granular permissions display */}
              <div className="p-3.5 bg-surface-950/40 border border-slate-800 rounded-xl">
                <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">
                  Staff Role Privileges & Assigned Capabilities
                </span>
                <div className="flex flex-wrap gap-2">
                  <span className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium ${
                    profile?.canBill !== false ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    Billing & Checkout: {profile?.canBill !== false ? 'Enabled' : 'Restricted'}
                  </span>
                  <span className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium ${
                    profile?.canTakeOrders !== false ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    Captain / Take Orders: {profile?.canTakeOrders !== false ? 'Enabled' : 'Restricted'}
                  </span>
                  <span className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium ${
                    profile?.canManageInventory ? 'bg-purple-500/10 text-purple-300 border-purple-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    Inventory: {profile?.canManageInventory ? 'Full Access' : 'View Only'}
                  </span>
                  <span className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium ${
                    profile?.canManageExpenses ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    Expenses: {profile?.canManageExpenses ? 'Full Access' : 'Restricted'}
                  </span>
                  <span className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium ${
                    profile?.canViewReports ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    Reports & Analytics: {profile?.canViewReports ? 'Enabled' : 'Restricted'}
                  </span>
                </div>
              </div>

              {/* Edit form */}
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={employeeName}
                        onChange={(e) => setEmployeeName(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="w-full bg-surface-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. user@cafe.com"
                        className="w-full bg-surface-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 9876543210"
                        className="w-full bg-surface-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Address / Location
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Street, City, Pin"
                        className="w-full bg-surface-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'Saving Changes...' : 'Update Profile Details'}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl flex items-start space-x-3">
                <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 leading-relaxed">
                  <span className="font-bold text-amber-300 block mb-1">Reset Account Password</span>
                  Enter your existing password followed by your desired new password. Once updated, you can use the new password on your next sign in.
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg mx-auto">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Current Password
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      className="w-full bg-surface-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    New Password (min. 6 characters)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter strong new password"
                      className="w-full bg-surface-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-type new password"
                      className="w-full bg-surface-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>{isSaving ? 'Updating Password...' : 'Change Password'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
