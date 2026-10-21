import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { POSBillingView } from './components/POSBillingView';
import { DiningTablesView } from './components/DiningTablesView';
import { KDSView } from './components/KDSView';
import { BillsView } from './components/BillsView';
import { MenuView } from './components/MenuView';
import { InventoryView } from './components/InventoryView';
import { ShiftsView } from './components/ShiftsView';
import { ExpensesView } from './components/ExpensesView';
import { StaffView } from './components/StaffView';
import { OutletsView } from './components/OutletsView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { SuperAdminView } from './components/SuperAdminView';
import { CustomerMenuView } from './components/CustomerMenuView';
import { LoginModal } from './components/LoginModal';
import { ShoppingCart, Layers, Receipt, UtensilsCrossed, Menu as MenuIcon, Building2, BarChart3 } from 'lucide-react';

export const App: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('pos');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Check if current route is customer menu
  const isMenuRoute = window.location.pathname.startsWith('/menu');

  useEffect(() => {
    if (user) {
      if (user.role === 'SUPER_ADMIN') {
        setActiveTab('cafes');
      } else if (user.role === 'KITCHEN') {
        setActiveTab('kds');
      } else {
        setActiveTab('pos');
      }
    }
  }, [user]);

  if (isMenuRoute) {
    return <CustomerMenuView />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
          <span className="text-xs font-mono">Initializing ARVI POS Cloud...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginModal />;
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />
      <div className="flex flex-1 relative">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />
        <main className="flex-1 p-3 sm:p-4 md:p-6 pb-24 md:pb-6 overflow-y-auto max-w-7xl mx-auto w-full">
          {activeTab === 'cafes' && <SuperAdminView />}
          {activeTab === 'super-analytics' && <SuperAdminView />}
          {activeTab === 'pos' && <POSBillingView />}
          {activeTab === 'tables' && <DiningTablesView />}
          {activeTab === 'kds' && <KDSView />}
          {activeTab === 'bills' && <BillsView />}
          {activeTab === 'menu' && <MenuView />}
          {activeTab === 'inventory' && <InventoryView />}
          {activeTab === 'shifts' && <ShiftsView />}
          {activeTab === 'expenses' && <ExpensesView />}
          {activeTab === 'staff' && <StaffView />}
          {activeTab === 'outlets' && <OutletsView />}
          {activeTab === 'analytics' && <AnalyticsView />}
          {activeTab === 'settings' && <SettingsView />}
          {activeTab === 'customer-menu' && <CustomerMenuView />}
        </main>
      </div>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 glass-panel bg-slate-900/95 border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around shadow-2xl backdrop-blur-md">
        {isSuperAdmin ? (
          <>
            <button
              onClick={() => setActiveTab('cafes')}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition ${
                activeTab === 'cafes' ? 'text-purple-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">Cafes</span>
            </button>
            <button
              onClick={() => setActiveTab('super-analytics')}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition ${
                activeTab === 'super-analytics' ? 'text-purple-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">Analytics</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setActiveTab('pos')}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition ${
                activeTab === 'pos' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShoppingCart className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">Billing</span>
            </button>
            <button
              onClick={() => setActiveTab('tables')}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition ${
                activeTab === 'tables' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">Tables</span>
            </button>
            <button
              onClick={() => setActiveTab('bills')}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition ${
                activeTab === 'bills' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Receipt className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">Orders</span>
            </button>
            <button
              onClick={() => setActiveTab('menu')}
              className={`flex flex-col items-center py-1 px-3 rounded-xl transition ${
                activeTab === 'menu' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UtensilsCrossed className="w-5 h-5 mb-0.5" />
              <span className="text-[10px]">Menu</span>
            </button>
          </>
        )}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center py-1 px-3 rounded-xl text-slate-400 hover:text-amber-400 transition"
        >
          <MenuIcon className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">More</span>
        </button>
      </nav>
    </div>
  );
};
