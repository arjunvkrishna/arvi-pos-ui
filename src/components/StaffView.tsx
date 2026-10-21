import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Employee } from '../types/pos';
import { Users, Plus, Phone, Mail, Shield, X } from 'lucide-react';

export const StaffView: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('EMPLOYEE');
  const [designation, setDesignation] = useState('Cashier');
  const [basicSalary, setBasicSalary] = useState('');

  const loadEmployees = async () => {
    try {
      const data = await api.get<Employee[]>('/staff');
      setEmployees(data || []);
    } catch {
      try {
        const fallback = await api.get<Employee[]>('/employees');
        setEmployees(fallback || []);
      } catch (err) {
        console.warn('Error loading staff:', err);
      }
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post('/employees', {
        name: name.trim(),
        phone,
        email,
        role,
        designation,
        basicSalary: parseFloat(basicSalary) || 0,
        active: true,
      });
      setShowAddModal(false);
      setName('');
      setPhone('');
      setEmail('');
      setBasicSalary('');
      await loadEmployees();
    } catch (e: any) {
      alert(e.message || 'Could not save employee');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center space-x-2">
            <Users className="w-7 h-7 text-amber-400" />
            <span>Staff, Roles &amp; Team Members</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">Manage cafe managers, cashiers, kitchen chefs and staff permissions</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map((emp) => (
          <div key={emp.id} className="glass-panel p-5 rounded-2xl border-slate-800/80 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-white text-sm">{emp.name}</h3>
                <p className="text-[11px] text-slate-400">{emp.designation || 'Staff Member'}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                emp.role === 'ADMIN'
                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                  : emp.role === 'MANAGER'
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}>
                {emp.role}
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-400 pt-1">
              {emp.phone && (
                <div className="flex items-center space-x-2">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>{emp.phone}</span>
                </div>
              )}
              {emp.email && (
                <div className="flex items-center space-x-2">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span>{emp.email}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-500">Base Salary</span>
              <span className="font-mono font-bold text-slate-200">₹{emp.basicSalary?.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Add Employee */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel bg-slate-900 border-slate-700 w-full max-w-sm rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Add Team Member</h3>
              <button onClick={() => setShowAddModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <form onSubmit={handleAddEmployee} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Suresh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="MANAGER">Manager</option>
                    <option value="EMPLOYEE">Cashier / Staff</option>
                    <option value="KITCHEN">Kitchen Chef</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Designation</label>
                  <input
                    type="text"
                    placeholder="e.g. Barista"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+91..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Basic Salary (₹)</label>
                  <input
                    type="number"
                    placeholder="18000"
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold"
                >
                  Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
