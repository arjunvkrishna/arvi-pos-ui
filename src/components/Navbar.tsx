import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Store, User as UserIcon, LogOut, ChevronDown, Coffee, Settings, ShieldCheck, Menu, X } from 'lucide-react';
import { UserProfileModal } from './UserProfileModal';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, isMobileMenuOpen, onToggleMobileMenu }) => {
  const { user, outlets, activeOutlet, switchOutlet, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'ADMIN':
      case 'CAFE_ADMIN':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'GENERAL_MANAGER':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'MANAGER':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'CASHIER':
      case 'CAPTAIN':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'KITCHEN':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  const canSwitchOutlet =
    user?.role === 'SUPER_ADMIN' ||
    user?.role === 'ADMIN' ||
    user?.role === 'CAFE_ADMIN' ||
    user?.role === 'GENERAL_MANAGER';

  const [isOutletDropdownOpen, setIsOutletDropdownOpen] = useState(false);

  return (
    <>
      <header className="h-16 glass-panel border-b border-slate-800/80 px-2 sm:px-4 flex items-center justify-between sticky top-0 z-30">
        {/* Brand & Mobile Hamburger */}
        <div className="flex items-center space-x-1.5 sm:space-x-3 min-w-0">
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              aria-label="Toggle Navigation Menu"
              className="md:hidden p-1.5 sm:p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-amber-400 border border-slate-800 transition"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 text-amber-400" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex-shrink-0 flex items-center justify-center shadow-lg shadow-amber-500/20 overflow-hidden border border-amber-400/30">
            {user?.logoUrl ? (
              <img
                src={user.logoUrl}
                alt={user?.tenantName || 'Cafe Logo'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <Coffee className="w-4 h-4 sm:w-6 sm:h-6 text-slate-950 stroke-[2.5]" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1 sm:space-x-2">
              <span className="font-extrabold text-xs sm:text-lg tracking-tight bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-transparent truncate max-w-[85px] xs:max-w-[120px] sm:max-w-[200px]">
                {user?.tenantName || 'ARVI POS'}
              </span>
              {user?.role === 'SUPER_ADMIN' && (
                <span className="text-[8px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                  SaaS Owner
                </span>
              )}
              {user?.role === 'GENERAL_MANAGER' && (
                <span className="hidden sm:inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 whitespace-nowrap">
                  Multi-Franchise GM
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate hidden md:block">
              {user?.role === 'SUPER_ADMIN'
                ? 'Platform Management Console'
                : user?.role === 'GENERAL_MANAGER'
                ? 'Multi-Outlet Operations'
                : 'Cloud POS'}
            </p>
          </div>
        </div>

        {/* Middle: Multi-Franchise Outlet Selector */}
        <div className="flex items-center space-x-2">
          {user?.role !== 'SUPER_ADMIN' && outlets.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => canSwitchOutlet && setIsOutletDropdownOpen(!isOutletDropdownOpen)}
                className="flex items-center space-x-1.5 sm:space-x-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl px-2 py-1 sm:px-3 sm:py-1.5 cursor-pointer transition shadow-sm text-left"
              >
                <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
                <div className="text-left max-w-[80px] xs:max-w-[110px] sm:max-w-[160px]">
                  <span className="hidden sm:block text-[9px] text-slate-400 uppercase font-semibold tracking-wider truncate">
                    {canSwitchOutlet ? 'Active Outlet' : 'Branch'}
                  </span>
                  <span className="text-[11px] sm:text-xs font-bold text-slate-200 flex items-center space-x-1 truncate">
                    <span className="truncate">{activeOutlet?.name || (canSwitchOutlet ? 'All branches' : 'Select Outlet')}</span>
                    {activeOutlet?.code && (
                      <span className="hidden xs:inline-block text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded ml-1 font-mono">
                        {activeOutlet.code}
                      </span>
                    )}
                  </span>
                </div>
                {outlets.length > 1 && canSwitchOutlet && (
                  <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
                )}
              </button>

              {/* Dropdown menu for multi-outlet switching */}
              {outlets.length > 1 && canSwitchOutlet && isOutletDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOutletDropdownOpen(false)}
                  />
                  <div className="absolute right-0 sm:left-0 mt-1 w-52 sm:w-56 glass-panel bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-50">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-800">
                      Switch Franchise Outlet
                    </div>
                    <button
                      onClick={() => {
                        switchOutlet(null);
                        setIsOutletDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-amber-500/10 transition ${
                        !activeOutlet ? 'text-amber-400 font-bold bg-amber-500/5' : 'text-slate-300'
                      }`}
                    >
                      <span className="truncate mr-2">All branches</span>
                    </button>
                    {outlets.map((outlet) => (
                      <button
                        key={outlet.id}
                        onClick={() => {
                          switchOutlet(outlet.id);
                          setIsOutletDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-amber-500/10 transition ${
                          activeOutlet?.id === outlet.id ? 'text-amber-400 font-bold bg-amber-500/5' : 'text-slate-300'
                        }`}
                      >
                        <span className="truncate mr-2">{outlet.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0">{outlet.code}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: User Profile & Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* User Profile Button */}
          <button
            onClick={() => setIsProfileOpen(true)}
            title="My Profile & Change Password"
            className="flex items-center space-x-2.5 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-amber-500/40 rounded-xl px-3 py-1.5 transition text-left cursor-pointer group shadow-sm"
          >
            <div className="w-7 h-7 rounded-lg bg-slate-800 group-hover:bg-amber-500/10 flex items-center justify-center text-slate-300 group-hover:text-amber-400 border border-slate-700 group-hover:border-amber-500/30 transition">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-bold text-slate-200 group-hover:text-amber-200 leading-tight transition">
                {user?.employeeName || user?.username}
              </div>
              <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border inline-block mt-0.5 ${getRoleBadgeColor(user?.role)}`}>
                {user?.role}
              </span>
            </div>
          </button>

          {/* Logout Button */}
          <button
            onClick={logout}
            title="Sign Out"
            className="p-2 rounded-xl bg-slate-900/60 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-800/80 hover:border-rose-500/30 transition shadow-sm"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* User Profile Modal */}
      <UserProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
};
