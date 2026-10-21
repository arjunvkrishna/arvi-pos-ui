import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Store, User as UserIcon, LogOut, ChevronDown, ShieldCheck, Coffee } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { user, outlets, activeOutlet, switchOutlet, logout } = useAuth();

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'ADMIN':
      case 'CAFE_ADMIN':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'MANAGER':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'KITCHEN':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <header className="h-16 glass-panel border-b border-slate-800/80 px-4 flex items-center justify-between sticky top-0 z-30">
      {/* Brand & Logo */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <Coffee className="w-6 h-6 text-slate-950 stroke-[2.5]" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-transparent">
              {user?.tenantName || 'ARVI POS'}
            </span>
            {user?.role === 'SUPER_ADMIN' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                SaaS Owner
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            {user?.role === 'SUPER_ADMIN' ? 'Platform Management Console' : 'Multi-Franchise Cloud POS'}
          </p>
        </div>
      </div>

      {/* Middle: Multi-Franchise Outlet Selector (for Cafe Admins & Managers) */}
      <div className="flex items-center space-x-3">
        {user?.role !== 'SUPER_ADMIN' && outlets.length > 0 && (
          <div className="relative group">
            <div className="flex items-center space-x-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl px-3 py-1.5 cursor-pointer transition shadow-sm">
              <Store className="w-4 h-4 text-amber-400" />
              <div className="text-left">
                <span className="block text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Active Outlet</span>
                <span className="text-xs font-bold text-slate-200 flex items-center space-x-1">
                  <span>{activeOutlet?.name || 'Select Outlet'}</span>
                  {activeOutlet?.code && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1 rounded ml-1 font-mono">
                      {activeOutlet.code}
                    </span>
                  )}
                </span>
              </div>
              {outlets.length > 1 && (user?.role === 'ADMIN' || user?.role === 'CAFE_ADMIN') && (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
              )}
            </div>

            {/* Dropdown menu for multi-outlet switching */}
            {outlets.length > 1 && (user?.role === 'ADMIN' || user?.role === 'CAFE_ADMIN') && (
              <div className="absolute left-0 mt-1 w-56 glass-panel rounded-xl shadow-2xl py-1 hidden group-hover:block z-50 border border-slate-700">
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-800">
                  Switch Franchise Outlet
                </div>
                {outlets.map((outlet) => (
                  <button
                    key={outlet.id}
                    onClick={() => switchOutlet(outlet.id)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-amber-500/10 transition ${
                      activeOutlet?.id === outlet.id ? 'text-amber-400 font-bold bg-amber-500/5' : 'text-slate-300'
                    }`}
                  >
                    <span>{outlet.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{outlet.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: User Profile & Actions */}
      <div className="flex items-center space-x-3">
        {/* User Pill */}
        <div className="flex items-center space-x-2.5 bg-slate-900/60 border border-slate-800/80 rounded-xl px-3 py-1.5">
          <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 border border-slate-700">
            <UserIcon className="w-4 h-4" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold text-slate-200 leading-tight">
              {user?.employeeName || user?.username}
            </div>
            <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border inline-block mt-0.5 ${getRoleBadgeColor(user?.role)}`}>
              {user?.role}
            </span>
          </div>
        </div>

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
  );
};
