import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Outlet } from '../types/pos';
import { api } from '../api/client';

interface AuthContextType {
  user: User | null;
  outlets: Outlet[];
  activeOutlet: Outlet | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  switchOutlet: (outletId: number) => void;
  refreshOutlets: () => Promise<void>;
  updateUser: (updated: Partial<User>) => void;
  updateTenantLogo: (logoUrl: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('pos_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [activeOutlet, setActiveOutlet] = useState<Outlet | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchOutlets = async () => {
    if (!api.getToken() || (user && user.role === 'SUPER_ADMIN')) {
      setOutlets([]);
      setActiveOutlet(null);
      return;
    }
    try {
      const data = await api.get<Outlet[]>('/outlets');
      if (Array.isArray(data)) {
        setOutlets(data);
        const storedOutletId = api.getActiveOutletId();
        const found = data.find(o => o.id === storedOutletId) || (data.length > 0 ? data[0] : null);
        setActiveOutlet(found);
        if (found) {
          api.setActiveOutletId(found.id);
        }
      }
    } catch (e) {
      console.warn('Could not load outlets:', e);
    }
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    const initAuth = async () => {
      if (api.getToken() && user) {
        await fetchOutlets();
      }
      setIsLoading(false);
    };
    initAuth();

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (username: string, password: string) => {
    const data = await api.post('/auth/login', { username, password });
    if (!data.token) {
      throw new Error(data.message || 'Login failed');
    }
    api.setToken(data.token, data.refreshToken);

    const userData: User = {
      id: data.employeeId || 1,
      username: data.username,
      role: data.role,
      employeeId: data.employeeId,
      employeeName: data.employeeName,
      canBill: data.canBill,
      canTakeOrders: data.canTakeOrders,
      canManageInventory: data.canManageInventory,
      canManageExpenses: data.canManageExpenses,
      canViewReports: data.canViewReports,
      mustChangePassword: data.mustChangePassword,
      tenantId: data.tenantId,
      tenantName: data.tenantName,
      tenantCode: data.tenantCode,
      logoUrl: data.logoUrl,
      outletId: data.outletId,
      outletName: data.outletName,
      outletCode: data.outletCode,
    };

    setUser(userData);
    localStorage.setItem('pos_user', JSON.stringify(userData));

    if (data.outletId) {
      api.setActiveOutletId(data.outletId);
    }

    // Load outlets for this tenant
    if (userData.role !== 'SUPER_ADMIN') {
      try {
        const outletList = await api.get<Outlet[]>('/outlets');
        if (Array.isArray(outletList)) {
          setOutlets(outletList);
          const current = outletList.find(o => o.id === data.outletId) || outletList[0] || null;
          setActiveOutlet(current);
          if (current) api.setActiveOutletId(current.id);
        }
      } catch (e) {
        console.warn('Outlet load error on login:', e);
      }
    }
  };

  const logout = () => {
    try {
      const refreshToken = api.getRefreshToken();
      if (refreshToken) {
        api.post('/auth/logout', { refreshToken }).catch(() => {});
      }
    } catch {}
    api.setToken(null, null);
    api.setActiveOutletId(null);
    setUser(null);
    setOutlets([]);
    setActiveOutlet(null);
    localStorage.removeItem('pos_user');
  };

  const switchOutlet = (outletId: number) => {
    const found = outlets.find(o => o.id === outletId);
    if (found) {
      setActiveOutlet(found);
      api.setActiveOutletId(found.id);
      window.location.reload(); // Refresh views with newly selected outlet context
    }
  };

  const updateUser = (updated: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...updated };
      localStorage.setItem('pos_user', JSON.stringify(next));
      return next;
    });
  };

  const updateTenantLogo = (logoUrl: string) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, logoUrl };
      localStorage.setItem('pos_user', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        outlets,
        activeOutlet,
        isLoading,
        login,
        logout,
        switchOutlet,
        refreshOutlets: fetchOutlets,
        updateUser,
        updateTenantLogo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
