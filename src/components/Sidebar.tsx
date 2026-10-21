import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  UtensilsCrossed,
  Layers,
  Package,
  Clock,
  Wallet,
  Users,
  Store,
  BarChart3,
  Settings,
  CookingPot,
  Globe,
  Building2,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { user } = useAuth();
  const role = user?.role || 'EMPLOYEE';

  interface NavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    roles: string[];
    badge?: string;
  }

  const navItems: NavItem[] = [
    // Super Admin Views
    {
      id: 'cafes',
      label: 'Cafes & Tenants',
      icon: <Building2 className="w-5 h-5" />,
      roles: ['SUPER_ADMIN'],
    },
    {
      id: 'super-analytics',
      label: 'Platform Overview',
      icon: <BarChart3 className="w-5 h-5" />,
      roles: ['SUPER_ADMIN'],
    },

    // POS & Operations
    {
      id: 'pos',
      label: 'POS Billing',
      icon: <ShoppingCart className="w-5 h-5" />,
      roles: ['ADMIN', 'CAFE_ADMIN', 'MANAGER', 'EMPLOYEE'],
    },
    {
      id: 'tables',
      label: 'Dining Tables',
      icon: <Layers className="w-5 h-5" />,
      roles: ['ADMIN', 'CAFE_ADMIN', 'MANAGER', 'EMPLOYEE'],
    },
    {
      id: 'kds',
      label: 'Kitchen Display',
      icon: <CookingPot className="w-5 h-5" />,
      roles: ['ADMIN', 'CAFE_ADMIN', 'MANAGER', 'EMPLOYEE', 'KITCHEN'],
      badge: 'LIVE',
    },
    {
      id: 'bills',
      label: 'Orders & Bills',
      icon: <Receipt className="w-5 h-5" />,
      roles: ['ADMIN', 'CAFE_ADMIN', 'MANAGER', 'EMPLOYEE'],
    },

    // Management & Resources
    {
      id: 'menu',
      label: 'Menu Catalog',
      icon: <UtensilsCrossed className="w-5 h-5" />,
      roles: ['ADMIN', 'CAFE_ADMIN', 'MANAGER'],
    },
    {
      id: 'inventory',
      label: 'Inventory Stock',
      icon: <Package className="w-5 h-5" />,
      roles: ['ADMIN', 'CAFE_ADMIN', 'MANAGER'],
    },
    {
      id: 'shifts',
      label: 'Cashier Shifts',
      icon: <Clock className="w-5 h-5" />,
      roles: ['ADMIN', 'CAFE_ADMIN', 'MANAGER', 'EMPLOYEE'],
    },
    {
      id: 'expenses',
      label: 'Expenses',
      icon: <Wallet className="w-5 h-5" />,
      roles: ['ADMIN', 'CAFE_ADMIN', 'MANAGER'],
    },
    {
      id: 'staff',
      label: 'Staff & Roles',
      icon: <Users className="w-5 h-5" />,
      roles: ['ADMIN', 'CAFE_ADMIN', 'MANAGER'],
    },

    // Multi-Franchise & Analytics
    {
      id: 'outlets',
      label: 'Franchise Outlets',
      icon: <Store className="w-5 h-5" />,
      roles: ['ADMIN', 'CAFE_ADMIN'],
      badge: 'Multi-Store',
    },
    {
      id: 'analytics',
      label: 'Analytics & P&L',
      icon: <BarChart3 className="w-5 h-5" />,
      roles: ['ADMIN', 'CAFE_ADMIN', 'MANAGER'],
    },

    // Settings
    {
      id: 'settings',
      label: 'Hardware & Printers',
      icon: <Settings className="w-5 h-5" />,
      roles: ['ADMIN', 'CAFE_ADMIN', 'MANAGER'],
    },
    {
      id: 'customer-menu',
      label: 'Customer QR Menu',
      icon: <Globe className="w-5 h-5" />,
      roles: ['ADMIN', 'CAFE_ADMIN', 'MANAGER'],
    },
  ];

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="w-64 glass-panel border-r border-slate-800/80 min-h-[calc(100vh-4rem)] flex flex-col justify-between py-4 px-3">
      <div className="space-y-1">
        <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Navigation
        </div>
        {visibleItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs transition duration-150 ${
                isActive
                  ? 'bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-amber-400 border border-amber-500/30 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className={isActive ? 'text-amber-400' : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                    item.badge === 'LIVE'
                      ? 'bg-rose-500/20 text-rose-300 animate-pulse border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="pt-4 border-t border-slate-800/80 px-3 text-center">
        <p className="text-[11px] text-slate-500">ARVI POS Platform v1.0.0</p>
        <p className="text-[10px] text-slate-600">Enterprise Cloud Architecture</p>
      </div>
    </aside>
  );
};
