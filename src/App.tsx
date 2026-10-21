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

export const App: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('pos');

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

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex flex-1">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full">
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
    </div>
  );
};
