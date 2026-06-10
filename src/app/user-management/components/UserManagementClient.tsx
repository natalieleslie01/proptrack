'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = 'agent' | 'manager' | 'admin';

interface UserRecord {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  enquiriesHandled: number;
}

interface AddUserForm {
  email: string;
  fullName: string;
  role: UserRole;
  password: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  agent: 'Agent',
  manager: 'Manager',
  admin: 'Admin',
};

const ROLE_COLORS: Record<UserRole, string> = {
  agent: 'bg-blue-50 text-blue-700 border border-blue-200',
  manager: 'bg-amber-50 text-amber-700 border border-amber-200',
  admin: 'bg-[#8B1A2B]/10 text-[#8B1A2B] border border-[#8B1A2B]/20',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return d.toLocaleDateString('en-HK', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Add User Modal ───────────────────────────────────────────────────────────

function AddUserModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<AddUserForm>({
    email: '',
    fullName: '',
    role: 'agent',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.fullName || !form.password) {
      setError('All fields are required.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(214,20%,88%)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#8B1A2B]/10 flex items-center justify-center">
              <Icon name="UserPlusIcon" size={16} className="text-[#8B1A2B]" />
            </div>
            <h2 className="text-base font-bold text-[hsl(215,25%,18%)]">Add New User</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors">
            <Icon name="XIcon" size={16} className="text-[hsl(215,15%,52%)]" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <Icon name="AlertCircleIcon" size={14} />
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="e.g. Christine Lau"
              className="w-full px-3 py-2.5 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] placeholder-[hsl(215,15%,70%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="agent@homesrus.hk"
              className="w-full px-3 py-2.5 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] placeholder-[hsl(215,15%,70%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1.5">
              Role
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
              className="w-full px-3 py-2.5 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] transition-colors bg-white"
            >
              <option value="agent">Agent</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1.5">
              Temporary Password
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Min. 8 characters"
              className="w-full px-3 py-2.5 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] placeholder-[hsl(215,15%,70%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] transition-colors"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-[hsl(214,20%,88%)] text-sm font-semibold text-[hsl(215,25%,18%)] hover:bg-[hsl(210,15%,94%)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-[#8B1A2B] text-white text-sm font-semibold hover:bg-[#7a1726] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Icon name="LoaderIcon" size={14} className="animate-spin" /> Creating…</>
              ) : (
                <><Icon name="UserPlusIcon" size={14} /> Add User</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── User Row ─────────────────────────────────────────────────────────────────

function UserRow({
  user,
  onRoleChange,
  onToggleActive,
  onResetPassword,
}: {
  user: UserRecord;
  onRoleChange: (id: string, role: UserRole) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onResetPassword: (id: string, name: string) => void;
}) {
  const [roleLoading, setRoleLoading] = useState(false);
  const [activeLoading, setActiveLoading] = useState(false);

  const handleRoleChange = async (newRole: UserRole) => {
    setRoleLoading(true);
    await onRoleChange(user.id, newRole);
    setRoleLoading(false);
  };

  const handleToggle = async () => {
    setActiveLoading(true);
    await onToggleActive(user.id, !user.isActive);
    setActiveLoading(false);
  };

  return (
    <tr className={`border-b border-[hsl(214,20%,92%)] hover:bg-[hsl(210,15%,97%)] transition-colors ${!user.isActive ? 'opacity-60' : ''}`}>
      {/* User */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${user.isActive ? 'bg-[#1B4F8A]' : 'bg-[hsl(215,15%,65%)]'}`}>
            {getInitials(user.fullName)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[hsl(215,25%,18%)] truncate">{user.fullName}</p>
            <p className="text-xs text-[hsl(215,15%,52%)] truncate">{user.email}</p>
          </div>
        </div>
      </td>

      {/* Role */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[user.role]}`}>
            {ROLE_LABELS[user.role]}
          </span>
          {roleLoading && <Icon name="LoaderIcon" size={12} className="animate-spin text-[hsl(215,15%,52%)]" />}
        </div>
      </td>

      {/* Status */}
      <td className="py-3.5 px-4">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${user.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-[hsl(210,15%,94%)] text-[hsl(215,15%,52%)] border border-[hsl(214,20%,88%)]'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-[hsl(215,15%,65%)]'}`} />
          {user.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>

      {/* Last Login */}
      <td className="py-3.5 px-4">
        <div>
          <p className="text-sm text-[hsl(215,25%,18%)]">{formatRelative(user.lastSignInAt)}</p>
          {user.lastSignInAt && (
            <p className="text-xs text-[hsl(215,15%,52%)]">{formatDate(user.lastSignInAt)}</p>
          )}
        </div>
      </td>

      {/* Enquiries */}
      <td className="py-3.5 px-4 text-center">
        <span className="text-sm font-bold tabular-nums text-[hsl(215,25%,18%)]">{user.enquiriesHandled}</span>
      </td>

      {/* Joined */}
      <td className="py-3.5 px-4">
        <span className="text-sm text-[hsl(215,15%,52%)]">{formatDate(user.createdAt)}</span>
      </td>

      {/* Actions */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-1">
          {/* Change Role */}
          <div className="relative group">
            <button
              className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
              title="Change role"
            >
              <Icon name="ShieldIcon" size={15} className="text-[hsl(215,15%,52%)]" />
            </button>
            <div className="absolute right-0 top-8 z-20 hidden group-hover:block bg-white border border-[hsl(214,20%,88%)] rounded-xl shadow-modal min-w-[140px] py-1">
              {(['agent', 'manager', 'admin'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => handleRoleChange(r)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-[hsl(210,15%,94%)] transition-colors flex items-center gap-2 ${user.role === r ? 'font-semibold text-[#8B1A2B]' : 'text-[hsl(215,25%,18%)]'}`}
                >
                  {user.role === r && <Icon name="CheckIcon" size={12} className="text-[#8B1A2B]" />}
                  {user.role !== r && <span className="w-3" />}
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>

          {/* Reset Password */}
          <button
            onClick={() => onResetPassword(user.id, user.fullName)}
            className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
            title="Send password reset"
          >
            <Icon name="KeyIcon" size={15} className="text-[hsl(215,15%,52%)]" />
          </button>

          {/* Toggle Active */}
          <button
            onClick={handleToggle}
            disabled={activeLoading}
            className={`p-1.5 rounded-lg transition-colors ${user.isActive ? 'hover:bg-red-50' : 'hover:bg-emerald-50'}`}
            title={user.isActive ? 'Deactivate user' : 'Reactivate user'}
          >
            {activeLoading ? (
              <Icon name="LoaderIcon" size={15} className="animate-spin text-[hsl(215,15%,52%)]" />
            ) : user.isActive ? (
              <Icon name="UserXIcon" size={15} className="text-red-500" />
            ) : (
              <Icon name="UserCheckIcon" size={15} className="text-emerald-600" />
            )}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UserManagementClient() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load users');
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (id: string, role: UserRole) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('Failed to update role');
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
      showToast('Role updated successfully');
    } catch {
      showToast('Failed to update role', 'error');
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: isActive ? 'PATCH' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: isActive ? JSON.stringify({ isActive: true }) : undefined,
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, isActive } : u)));
      showToast(isActive ? 'User reactivated' : 'User deactivated');
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
    }
  };

  const handleResetPassword = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/admin/users/${id}/reset-password`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      showToast(`Password reset email sent to ${name}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to send reset email', 'error');
    }
  };

  // Filtered list
  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && u.isActive) ||
      (statusFilter === 'inactive' && !u.isActive);
    return matchSearch && matchRole && matchStatus;
  });

  // Summary counts
  const totalActive = users.filter((u) => u.isActive).length;
  const totalAgents = users.filter((u) => u.role === 'agent').length;
  const totalManagers = users.filter((u) => u.role === 'manager').length;
  const totalAdmins = users.filter((u) => u.role === 'admin').length;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-auto bg-[hsl(210,20%,97%)]">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-modal text-sm font-semibold transition-all ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          <Icon name={toast.type === 'success' ? 'CheckCircleIcon' : 'AlertCircleIcon'} size={16} />
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white border-b border-[hsl(214,20%,88%)] px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">User Management</h1>
              <span className="px-2 py-0.5 rounded-full bg-[#8B1A2B]/10 text-[#8B1A2B] text-xs font-bold">Admin Only</span>
            </div>
            <p className="text-sm text-[hsl(215,15%,52%)]">Manage agents, roles, and account access for Homes R Us</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#8B1A2B] text-white text-sm font-semibold rounded-xl hover:bg-[#7a1726] transition-colors shadow-sm"
          >
            <Icon name="UserPlusIcon" size={16} />
            Add User
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active Users', value: totalActive, icon: 'UsersIcon', color: 'text-[#1B4F8A]', bg: 'bg-[#1B4F8A]/10' },
            { label: 'Agents', value: totalAgents, icon: 'UserIcon', color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Managers', value: totalManagers, icon: 'BriefcaseIcon', color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Admins', value: totalAdmins, icon: 'ShieldIcon', color: 'text-[#8B1A2B]', bg: 'bg-[#8B1A2B]/10' },
          ].map((card) => (
            <div key={card.label} className="card bg-white p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${card.bg}`}>
                <Icon name={card.icon as Parameters<typeof Icon>[0]['name']} size={18} className={card.color} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[hsl(215,25%,18%)] tabular-nums">{loading ? '—' : card.value}</p>
                <p className="text-xs text-[hsl(215,15%,52%)] font-medium">{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card bg-white p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Icon name="SearchIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] placeholder-[hsl(215,15%,70%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] transition-colors"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
            className="px-3 py-2 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] transition-colors bg-white"
          >
            <option value="all">All Roles</option>
            <option value="agent">Agent</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] transition-colors bg-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button
            onClick={fetchUsers}
            className="p-2 rounded-lg border border-[hsl(214,20%,88%)] hover:bg-[hsl(210,15%,94%)] transition-colors"
            title="Refresh"
          >
            <Icon name="RefreshCwIcon" size={15} className="text-[hsl(215,15%,52%)]" />
          </button>

          <span className="text-xs text-[hsl(215,15%,52%)] ml-auto">
            {filtered.length} of {users.length} users
          </span>
        </div>

        {/* Table */}
        <div className="card bg-white overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <Icon name="LoaderIcon" size={20} className="animate-spin text-[#8B1A2B]" />
              <span className="text-sm text-[hsl(215,15%,52%)]">Loading users…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <Icon name="AlertCircleIcon" size={20} className="text-red-500" />
              </div>
              <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{error}</p>
              <button onClick={fetchUsers} className="text-sm text-[#8B1A2B] font-semibold hover:underline">
                Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-full bg-[hsl(210,15%,94%)] flex items-center justify-center">
                <Icon name="UsersIcon" size={20} className="text-[hsl(215,15%,52%)]" />
              </div>
              <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">No users found</p>
              <p className="text-xs text-[hsl(215,15%,52%)]">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[hsl(214,20%,88%)] bg-[hsl(210,20%,97%)]">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">User</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Role</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Last Login</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Enquiries</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Joined</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      onRoleChange={handleRoleChange}
                      onToggleActive={handleToggleActive}
                      onResetPassword={handleResetPassword}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            fetchUsers();
            showToast('User created successfully');
          }}
        />
      )}
    </div>
  );
}
