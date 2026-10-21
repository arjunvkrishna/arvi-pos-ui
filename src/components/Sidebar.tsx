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
  X,
  Coffee,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isMobileOpen, onCloseMobile }) => {
  const { user } = useAuth();
  const role = user?.role || 'EMPLOYEE';

  interface NavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    roles?: string[];
    permissionCheck?: (u: typeof user) => boolean;
    badge?: string;
  }

  const isElevated = role === 'ADMIN' || role === 'CAFE_ADMIN' || role === 'GENERAL_MANAGER';

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
      permissionCheck: (u) => isElevated || role === 'MANAGER' || u?.canBill !== false,
    },
    {
      id: 'tables',
      label: 'Dining Tables',
      icon: <Layers className="w-5 h-5" />,
      permissionCheck: (u) => isElevated || role === 'MANAGER' || u?.canTakeOrders !== false,
    },
    {
      id: 'kds',
      label: 'Kitchen Display',
      icon: <CookingPot className="w-5 h-5" />,
      permissionCheck: (u) => isElevated || role === 'MANAGER' || role === 'KITCHEN' || u?.canTakeOrders !== false,
      badge: 'LIVE',
    },
    {
      id: 'bills',
      label: 'Orders & Bills',
      icon: <Receipt className="w-5 h-5" />,
      permissionCheck: (u) => isElevated || role === 'MANAGER' || u?.canBill !== false || u?.canTakeOrders !== false,
    },

    // Management & Resources
    {
      id: 'menu',
      label: 'Menu Catalog',
      icon: <UtensilsCrossed className="w-5 h-5" />,
      roles: ['ADMIN', 'CAFE_ADMIN', 'GENERAL_MANAGER', 'MANAGER'],
    },
    {
      id: 'inventory',
      label: 'Inventory Stock',
      icon: <Package className="w-5 h-5" />,
      permissionCheck: (u) => isElevated || role === 'MANAGER' || u?.canManageInventory === true,
    },
    {
      id: 'shifts',
      label: 'Cashier Shifts',
      icon: <Clock className="w-5 h-5" />,
      permissionCheck: (u) => isElevated || role === 'MANAGER' || u?.canBill !== false,
    },
    {
      id: 'expenses',
      label: 'Expenses',
      icon: <Wallet className="w-5 h-5" />,
      permissionCheck: (u) => isElevated || role === 'MANAGER' || u?.canManageExpenses === true,
    },
    {
      id: 'staff',
      label: 'Staff & Roles',
      icon: <Users className="w-5 h-5" />,
      roles: ['ADMIN', 'CAFE_ADMIN', 'GENERAL_MANAGER', 'MANAGER'],
    },

    // Multi-Franchise & Analytics
    {
      id: 'outlets',
      label: 'Franchise Outlets',
      icon: <Store className="w-5 h-5" />,
      roles: ['ADMIN', 'CAFE_ADMIN', 'GENERAL_MANAGER'],
      badge: 'Multi-Store',
    },
    {
      id: 'analytics',
      label: 'Analytics & P&L',
      icon: <BarChart3 className="w-5 h-5" />,
      permissionCheck: (u) => isElevated || role === 'MANAGER' || u?.canViewReports === true,
    },

    // Settings
    {
      id: 'settings',
      label: 'Brand & Hardware',
      icon: <Settings className="w-5 h-5" />,
      roles: ['ADMIN', 'CAFE_ADMIN', 'GENERAL_MANAGER', 'MANAGER'],
    },
    {
      id: 'customer-menu',
      label: 'Customer QR Menu',
      icon: <Globe className="w-5 h-5" />,
      roles: ['ADMIN', 'CAFE_ADMIN', 'GENERAL_MANAGER', 'MANAGER'],
    },
  ];

  const visibleItems = navItems.filter((item) => {
    if (role === 'SUPER_ADMIN') {
      return item.roles?.includes('SUPER_ADMIN');
    }
    if (item.roles?.includes('SUPER_ADMIN')) {
      return false;
    }
    if (item.permissionCheck) {
      return item.permissionCheck(user);
    }
    if (item.roles) {
      return item.roles.includes(role);
    }
    return true;
  });

  const renderNavButtons = (isMobile: boolean = false) => (
    <div className="space-y-1">
      <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        Navigation
      </div>
      {visibleItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id);
              if (isMobile && onCloseMobile) {
                onCloseMobile();
              }
            }}
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
  );

  return (
    <>
      {/* Desktop Sidebar (Pinned Left on md+ screens) */}
      <aside className="hidden md:flex w-64 glass-panel border-r border-slate-800/80 min-h-[calc(100vh-4rem)] flex-col justify-between py-4 px-3 flex-shrink-0">
        {renderNavButtons(false)}
        <div className="pt-4 border-t border-slate-800/80 px-3 text-center">
          <p className="text-[11px] text-slate-500 font-mono">ARVI POS v1.0.0</p>
          <p className="text-[10px] text-slate-600">Enterprise Cloud</p>
        </div>
      </aside>

      {/* Mobile Sliding Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity animate-fade-in"
            onClick={onCloseMobile}
          />
          {/* Sliding Panel */}
          <div className="relative w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4 z-10 shadow-2xl overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 mb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Coffee className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="font-extrabold text-sm text-slate-100">
                      {user?.tenantName || 'ARVI POS'}
                    </span>
                    <span className="block text-[10px] text-amber-400 font-semibold uppercase tracking-wider">
                      {user?.role}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onCloseMobile}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {renderNavButtons(true)}
            </div>

            <div className="pt-4 mt-6 border-t border-slate-800 text-center">
              <p className="text-[11px] text-slate-400 font-medium">ARVI POS Terminal</p>
              <p className="text-[10px] text-slate-600">Mobile Responsive Edition</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
