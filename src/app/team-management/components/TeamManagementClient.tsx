'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentRole = 'agent' | 'manager' | 'admin';
type AgentStatus = 'active' | 'inactive' | 'pending';

interface Permission {
  id: string;
  label: string;
  description: string;
  group: string;
}

interface AgentRecord {
  id: string;
  fullName: string;
  email: string;
  role: AgentRole;
  status: AgentStatus;
  createdAt: string;
  lastSignInAt: string | null;
  permissions: string[];
}

interface InviteForm {
  fullName: string;
  email: string;
  role: AgentRole;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<AgentRole, { label: string; desc: string; badgeClass: string; iconColor: string }> = {
  agent: {
    label: 'Agent',
    desc: 'Manage enquiries, clients, and viewings',
    badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
    iconColor: 'text-blue-600',
  },
  manager: {
    label: 'Manager',
    desc: 'Manage agents, view all data, run reports',
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
    iconColor: 'text-amber-600',
  },
  admin: {
    label: 'Admin',
    desc: 'Full access including system settings',
    badgeClass: 'bg-[#8B1A2B]/10 text-[#8B1A2B] border border-[#8B1A2B]/20',
    iconColor: 'text-[#8B1A2B]',
  },
};

const STATUS_CONFIG: Record<AgentStatus, { label: string; dotClass: string; textClass: string }> = {
  active: { label: 'Active', dotClass: 'bg-emerald-500', textClass: 'text-emerald-700' },
  inactive: { label: 'Inactive', dotClass: 'bg-slate-400', textClass: 'text-slate-500' },
  pending: { label: 'Invite Sent', dotClass: 'bg-amber-400', textClass: 'text-amber-600' },
};

const ALL_PERMISSIONS: Permission[] = [
  // Dashboard
  { id: 'view_dashboard', label: 'View Dashboard', description: 'Access the main dashboard and metrics', group: 'Dashboard' },
  { id: 'view_analytics', label: 'View Analytics', description: 'Access charts and performance reports', group: 'Dashboard' },
  // Properties
  { id: 'view_properties', label: 'View Properties', description: 'Browse and search property listings', group: 'Properties' },
  { id: 'edit_properties', label: 'Edit Properties', description: 'Add, update, and delete property records', group: 'Properties' },
  // Clients & Enquiries
  { id: 'view_clients', label: 'View Clients', description: 'Access client profiles and history', group: 'Clients' },
  { id: 'manage_enquiries', label: 'Manage Enquiries', description: 'Respond to and assign enquiries', group: 'Clients' },
  // Viewings
  { id: 'manage_viewings', label: 'Manage Viewings', description: 'Schedule and update property viewings', group: 'Viewings' },
  // Admin
  { id: 'manage_team', label: 'Manage Team', description: 'Invite agents and manage roles', group: 'Administration' },
  { id: 'view_admin_logs', label: 'View Admin Logs', description: 'Access system audit logs', group: 'Administration' },
  { id: 'manage_users', label: 'Manage Users', description: 'Create, deactivate, and reset user accounts', group: 'Administration' },
];

const DEFAULT_PERMISSIONS: Record<AgentRole, string[]> = {
  agent: ['view_dashboard', 'view_properties', 'view_clients', 'manage_enquiries', 'manage_viewings'],
  manager: ['view_dashboard', 'view_analytics', 'view_properties', 'edit_properties', 'view_clients', 'manage_enquiries', 'manage_viewings'],
  admin: ALL_PERMISSIONS.map((p) => p.id),
};

const PERMISSION_GROUPS = ['Dashboard', 'Properties', 'Clients', 'Viewings', 'Administration'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-HK', { day: '2-digit', month: 'short', year: 'numeric' });
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

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (agent: AgentRecord) => void }) {
  const [form, setForm] = useState<InviteForm>({ fullName: '', email: '', role: 'agent' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.fullName.trim()) { setError('Full name is required.'); return; }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError('A valid email address is required.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          fullName: form.fullName.trim(),
          role: form.role,
          tempPassword: Math.random().toString(36).slice(-10) + 'A1!',
          personalNote: '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invitation');

      onSuccess({
        id: data.userId || String(Date.now()),
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        status: 'pending',
        createdAt: new Date().toISOString(),
        lastSignInAt: null,
        permissions: DEFAULT_PERMISSIONS[form.role],
      });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(214,20%,88%)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#8B1A2B]/10 flex items-center justify-center">
              <Icon name="UserPlusIcon" size={18} className="text-[#8B1A2B]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[hsl(215,25%,18%)]">Invite Agent</h2>
              <p className="text-xs text-[hsl(215,15%,52%)]">Send login credentials by email</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors">
            <Icon name="XIcon" size={16} className="text-[hsl(215,15%,52%)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <Icon name="AlertCircleIcon" size={14} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1.5">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="e.g. Sarah Wong"
              className="w-full px-3 py-2.5 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] placeholder-[hsl(215,15%,70%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1.5">
              Email Address <span className="text-red-400">*</span>
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
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ROLE_CONFIG) as AgentRole[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, role }))}
                  className={`px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all text-center ${
                    form.role === role
                      ? 'border-[#8B1A2B] bg-[#8B1A2B]/5 text-[#8B1A2B]'
                      : 'border-[hsl(214,20%,88%)] text-[hsl(215,15%,52%)] hover:border-[hsl(214,20%,70%)]'
                  }`}
                >
                  {ROLE_CONFIG[role].label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-[hsl(215,15%,60%)]">{ROLE_CONFIG[form.role].desc}</p>
          </div>

          <div className="flex gap-3 pt-1">
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
                <><Icon name="LoaderIcon" size={14} className="animate-spin" /> Sending…</>
              ) : (
                <><Icon name="SendIcon" size={14} /> Send Invite</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Permissions Panel ────────────────────────────────────────────────────────

function PermissionsPanel({
  agent,
  onClose,
  onSave,
}: {
  agent: AgentRecord;
  onClose: () => void;
  onSave: (id: string, permissions: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(agent.permissions));
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const applyRoleDefaults = (role: AgentRole) => {
    setSelected(new Set(DEFAULT_PERMISSIONS[role]));
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    onSave(agent.id, Array.from(selected));
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(214,20%,88%)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#1B4F8A] flex items-center justify-center text-white text-xs font-bold">
              {getInitials(agent.fullName)}
            </div>
            <div>
              <h2 className="text-base font-bold text-[hsl(215,25%,18%)]">{agent.fullName}</h2>
              <p className="text-xs text-[hsl(215,15%,52%)]">Access Permissions</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors">
            <Icon name="XIcon" size={16} className="text-[hsl(215,15%,52%)]" />
          </button>
        </div>

        {/* Role presets */}
        <div className="px-6 py-3 border-b border-[hsl(214,20%,88%)] bg-[hsl(210,20%,98%)]">
          <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">Apply Role Defaults</p>
          <div className="flex gap-2">
            {(Object.keys(ROLE_CONFIG) as AgentRole[]).map((role) => (
              <button
                key={role}
                onClick={() => applyRoleDefaults(role)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${ROLE_CONFIG[role].badgeClass} hover:opacity-80`}
              >
                {ROLE_CONFIG[role].label} defaults
              </button>
            ))}
          </div>
        </div>

        {/* Permissions list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {PERMISSION_GROUPS.map((group) => {
            const perms = ALL_PERMISSIONS.filter((p) => p.group === group);
            return (
              <div key={group}>
                <p className="text-xs font-bold text-[hsl(215,15%,40%)] uppercase tracking-wider mb-2">{group}</p>
                <div className="space-y-1.5">
                  {perms.map((perm) => {
                    const checked = selected.has(perm.id);
                    return (
                      <label
                        key={perm.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          checked
                            ? 'border-[#8B1A2B]/30 bg-[#8B1A2B]/5'
                            : 'border-[hsl(214,20%,90%)] hover:border-[hsl(214,20%,75%)] hover:bg-[hsl(210,15%,97%)]'
                        }`}
                      >
                        <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                          checked ? 'bg-[#8B1A2B] border-[#8B1A2B]' : 'border-[hsl(214,20%,70%)] bg-white'
                        }`}>
                          {checked && <Icon name="CheckIcon" size={10} className="text-white" />}
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(perm.id)}
                          className="sr-only"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{perm.label}</p>
                          <p className="text-xs text-[hsl(215,15%,55%)] mt-0.5">{perm.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[hsl(214,20%,88%)] flex items-center justify-between gap-3">
          <span className="text-xs text-[hsl(215,15%,52%)]">
            {selected.size} of {ALL_PERMISSIONS.length} permissions enabled
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[hsl(214,20%,88%)] text-sm font-semibold text-[hsl(215,25%,18%)] hover:bg-[hsl(210,15%,94%)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#8B1A2B] text-white text-sm font-semibold hover:bg-[#7a1726] disabled:opacity-60 transition-colors flex items-center gap-2"
            >
              {saving ? <><Icon name="LoaderIcon" size={13} className="animate-spin" /> Saving…</> : <><Icon name="ShieldCheckIcon" size={13} /> Save Permissions</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Agent Row ────────────────────────────────────────────────────────────────

function AgentRow({
  agent,
  onRoleChange,
  onToggleStatus,
  onEditPermissions,
}: {
  agent: AgentRecord;
  onRoleChange: (id: string, role: AgentRole) => void;
  onToggleStatus: (id: string) => void;
  onEditPermissions: (agent: AgentRecord) => void;
}) {
  const statusCfg = STATUS_CONFIG[agent.status];
  const roleCfg = ROLE_CONFIG[agent.role];

  return (
    <tr className={`border-b border-[hsl(214,20%,92%)] hover:bg-[hsl(210,15%,97%)] transition-colors ${agent.status === 'inactive' ? 'opacity-60' : ''}`}>
      {/* Agent */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${agent.status === 'inactive' ? 'bg-slate-400' : 'bg-[#1B4F8A]'}`}>
            {getInitials(agent.fullName)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[hsl(215,25%,18%)] truncate">{agent.fullName}</p>
            <p className="text-xs text-[hsl(215,15%,52%)] truncate">{agent.email}</p>
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotClass}`} />
          <span className={`text-xs font-medium ${statusCfg.textClass}`}>{statusCfg.label}</span>
        </div>
      </td>

      {/* Role */}
      <td className="py-3.5 px-4">
        <select
          value={agent.role}
          onChange={(e) => onRoleChange(agent.id, e.target.value as AgentRole)}
          className={`text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 ${roleCfg.badgeClass} bg-transparent`}
        >
          <option value="agent">Agent</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
      </td>

      {/* Permissions count */}
      <td className="py-3.5 px-4 hidden md:table-cell">
        <button
          onClick={() => onEditPermissions(agent)}
          className="flex items-center gap-1.5 text-xs text-[hsl(215,15%,52%)] hover:text-[#8B1A2B] transition-colors group"
        >
          <Icon name="ShieldIcon" size={13} className="group-hover:text-[#8B1A2B]" />
          <span className="font-medium">{agent.permissions.length} permissions</span>
          <Icon name="PencilIcon" size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </td>

      {/* Last active */}
      <td className="py-3.5 px-4 hidden lg:table-cell">
        <span className="text-xs text-[hsl(215,15%,55%)]">{formatRelative(agent.lastSignInAt)}</span>
      </td>

      {/* Actions */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-1.5 justify-end">
          <button
            onClick={() => onEditPermissions(agent)}
            className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,92%)] transition-colors"
            title="Edit permissions"
          >
            <Icon name="ShieldIcon" size={14} className="text-[hsl(215,15%,52%)]" />
          </button>
          <button
            onClick={() => onToggleStatus(agent.id)}
            className={`p-1.5 rounded-lg transition-colors ${
              agent.status === 'active' ?'hover:bg-red-50 text-[hsl(215,15%,52%)] hover:text-red-600' :'hover:bg-emerald-50 text-[hsl(215,15%,52%)] hover:text-emerald-600'
            }`}
            title={agent.status === 'active' ? 'Deactivate' : 'Activate'}
          >
            <Icon name={agent.status === 'active' ? 'UserXIcon' : 'UserCheckIcon'} size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const MOCK_AGENTS: AgentRecord[] = [
  {
    id: '1',
    fullName: 'Christine Lau',
    email: 'christine@homesrus.hk',
    role: 'admin',
    status: 'active',
    createdAt: '2024-01-10T09:00:00Z',
    lastSignInAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    permissions: ALL_PERMISSIONS.map((p) => p.id),
  },
  {
    id: '2',
    fullName: 'Natalie Chan',
    email: 'natalie@homesrus.hk',
    role: 'manager',
    status: 'active',
    createdAt: '2024-02-14T10:30:00Z',
    lastSignInAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    permissions: DEFAULT_PERMISSIONS.manager,
  },
  {
    id: '3',
    fullName: 'James Ho',
    email: 'james@homesrus.hk',
    role: 'agent',
    status: 'active',
    createdAt: '2024-03-05T08:00:00Z',
    lastSignInAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    permissions: DEFAULT_PERMISSIONS.agent,
  },
  {
    id: '4',
    fullName: 'Emily Yuen',
    email: 'emily@homesrus.hk',
    role: 'agent',
    status: 'pending',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    lastSignInAt: null,
    permissions: DEFAULT_PERMISSIONS.agent,
  },
];

export default function TeamManagementClient() {
  const [agents, setAgents] = useState<AgentRecord[]>(MOCK_AGENTS);
  const [showInvite, setShowInvite] = useState(false);
  const [permissionsAgent, setPermissionsAgent] = useState<AgentRecord | null>(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<AgentRole | 'all'>('all');
  const [successMsg, setSuccessMsg] = useState('');

  const filtered = agents.filter((a) => {
    const matchSearch = a.fullName.toLowerCase().includes(search.toLowerCase()) || a.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'all' || a.role === filterRole;
    return matchSearch && matchRole;
  });

  const handleInviteSuccess = useCallback((agent: AgentRecord) => {
    setAgents((prev) => [agent, ...prev]);
    setSuccessMsg(`Invitation sent to ${agent.email}`);
    setTimeout(() => setSuccessMsg(''), 4000);
  }, []);

  const handleRoleChange = useCallback((id: string, role: AgentRole) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, role, permissions: DEFAULT_PERMISSIONS[role] } : a))
    );
  }, []);

  const handleToggleStatus = useCallback((id: string) => {
    setAgents((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: a.status === 'active' ? 'inactive' : 'active' } : a
      )
    );
  }, []);

  const handleSavePermissions = useCallback((id: string, permissions: string[]) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, permissions } : a)));
    setSuccessMsg('Permissions updated successfully');
    setTimeout(() => setSuccessMsg(''), 3000);
  }, []);

  const stats = {
    total: agents.length,
    active: agents.filter((a) => a.status === 'active').length,
    pending: agents.filter((a) => a.status === 'pending').length,
    admins: agents.filter((a) => a.role === 'admin').length,
  };

  return (
    <div className="min-h-screen bg-[hsl(210,20%,97%)]">
      {/* Page Header */}
      <div className="bg-white border-b border-[hsl(214,20%,88%)] px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#8B1A2B]/10 flex items-center justify-center">
              <Icon name="UsersIcon" size={20} className="text-[#8B1A2B]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Team Management</h1>
              <p className="text-sm text-[hsl(215,15%,52%)]">Invite agents, assign roles, and manage access permissions</p>
            </div>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#8B1A2B] text-white text-sm font-semibold rounded-xl hover:bg-[#7a1726] transition-colors shadow-sm"
          >
            <Icon name="UserPlusIcon" size={15} />
            <span className="hidden sm:inline">Invite Agent</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">

        {/* Success banner */}
        {successMsg && (
          <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
            <Icon name="CheckCircleIcon" size={15} className="flex-shrink-0" />
            {successMsg}
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Members', value: stats.total, icon: 'UsersIcon', color: 'text-[#1B4F8A]', bg: 'bg-blue-50' },
            { label: 'Active', value: stats.active, icon: 'UserCheckIcon', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Invite Pending', value: stats.pending, icon: 'MailIcon', color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Admins', value: stats.admins, icon: 'ShieldCheckIcon', color: 'text-[#8B1A2B]', bg: 'bg-[#8B1A2B]/10' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon name={stat.icon as Parameters<typeof Icon>[0]['name']} size={16} className={stat.color} />
              </div>
              <div>
                <p className="text-xl font-bold text-[hsl(215,25%,18%)]">{stat.value}</p>
                <p className="text-xs text-[hsl(215,15%,52%)]">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-48 relative">
            <Icon name="SearchIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,60%)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] placeholder-[hsl(215,15%,65%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] transition-colors"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {(['all', 'agent', 'manager', 'admin'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setFilterRole(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filterRole === r
                    ? 'bg-[#8B1A2B] text-white'
                    : 'text-[hsl(215,15%,52%)] hover:bg-[hsl(210,15%,94%)]'
                }`}
              >
                {r === 'all' ? 'All' : ROLE_CONFIG[r].label}
              </button>
            ))}
          </div>
          <span className="text-xs text-[hsl(215,15%,55%)] ml-auto">{filtered.length} member{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[hsl(214,20%,88%)] bg-[hsl(210,20%,98%)]">
                  <th className="text-left text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider py-3 px-4">Member</th>
                  <th className="text-left text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider py-3 px-4">Status</th>
                  <th className="text-left text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider py-3 px-4">Role</th>
                  <th className="text-left text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider py-3 px-4 hidden md:table-cell">Permissions</th>
                  <th className="text-left text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider py-3 px-4 hidden lg:table-cell">Last Active</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <Icon name="UsersIcon" size={32} className="text-[hsl(214,20%,80%)] mx-auto mb-2" />
                      <p className="text-sm text-[hsl(215,15%,52%)]">No team members found</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((agent) => (
                    <AgentRow
                      key={agent.id}
                      agent={agent}
                      onRoleChange={handleRoleChange}
                      onToggleStatus={handleToggleStatus}
                      onEditPermissions={setPermissionsAgent}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Role legend */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-4">
          <p className="text-xs font-bold text-[hsl(215,15%,40%)] uppercase tracking-wider mb-3">Role Permissions Overview</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(Object.keys(ROLE_CONFIG) as AgentRole[]).map((role) => (
              <div key={role} className={`rounded-xl border p-3.5 ${ROLE_CONFIG[role].badgeClass}`}>
                <p className="text-sm font-bold mb-0.5">{ROLE_CONFIG[role].label}</p>
                <p className="text-xs opacity-80">{ROLE_CONFIG[role].desc}</p>
                <p className="text-xs font-semibold mt-2 opacity-70">{DEFAULT_PERMISSIONS[role].length} default permissions</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSuccess={handleInviteSuccess}
        />
      )}
      {permissionsAgent && (
        <PermissionsPanel
          agent={permissionsAgent}
          onClose={() => setPermissionsAgent(null)}
          onSave={handleSavePermissions}
        />
      )}
    </div>
  );
}
