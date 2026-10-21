import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Coffee, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md glass-panel bg-slate-900 border-slate-800 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-y-auto max-h-[95vh]">
        {/* Subtle accent glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="text-center space-y-2 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center mx-auto shadow-xl shadow-amber-500/20">
            <Coffee className="w-8 h-8 text-slate-950 stroke-[2.5]" />
          </div>
          <h2 className="text-2xl font-extrabold text-white">ARVI POS</h2>
          <p className="text-xs text-slate-400">Multi-Franchise Cafe Point of Sale &amp; SaaS Console</p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center space-x-2 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Username</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                required
                placeholder="superadmin, admin, or staff username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 disabled:opacity-50 transition flex items-center justify-center space-x-2"
          >
            <span>{isLoading ? 'Signing In...' : 'Sign In to Terminal'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-500">
            For SaaS platform administration, log in as <span className="text-purple-400 font-mono">superadmin</span>.
          </p>
        </div>
      </div>
    </div>
  );
};
