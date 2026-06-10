'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = 'agent' | 'manager' | 'admin';
type UserStatus = 'active' | 'inactive' | 'pending';
type ActiveTab = 'overview' | 'invite' | 'members' | 'permissions';

interface Permission {
  id: string;
  label: string;
  description: string;
  group: string;
}

interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastSignInAt: string | null;
  permissions: string[];
  enquiriesHandled: number;
}

interface InviteForm {
  fullName: string;
  email: string;
  role: UserRole;
  tempPassword: string;
  personalNote: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<UserRole, { label: string; desc: string; badgeClass: string; iconColor: string; bgClass: string }> = {
  agent: {
    label: 'Agent',
    desc: 'Manage enquiries, clients, and viewings',
    badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
    iconColor: 'text-blue-600',
    bgClass: 'bg-blue-50',
  },
  manager: {
    label: 'Manager',
    desc: 'Manage agents, view all data, run reports',
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
    iconColor: 'text-amber-600',
    bgClass: 'bg-amber-50',
  },
  admin: {
    label: 'Admin',
    desc: 'Full access including system settings and user management',
    badgeClass: 'bg-[#8B1A2B]/10 text-[#8B1A2B] border border-[#8B1A2B]/20',
    iconColor: 'text-[#8B1A2B]',
    bgClass: 'bg-[#8B1A2B]/10',
  },
};

const STATUS_CONFIG: Record<UserStatus, { label: string; dotClass: string; textClass: string; bgClass: string }> = {
  active: { label: 'Active', dotClass: 'bg-emerald-500', textClass: 'text-emerald-700', bgClass: 'bg-emerald-50' },
  inactive: { label: 'Inactive', dotClass: 'bg-slate-400', textClass: 'text-slate-500', bgClass: 'bg-slate-50' },
  pending: { label: 'Invite Sent', dotClass: 'bg-amber-400', textClass: 'text-amber-600', bgClass: 'bg-amber-50' },
};

const ALL_PERMISSIONS: Permission[] = [
  { id: 'view_dashboard', label: 'View Dashboard', description: 'Access the main dashboard and metrics', group: 'Dashboard' },
  { id: 'view_analytics', label: 'View Analytics', description: 'Access charts and performance reports', group: 'Dashboard' },
  { id: 'view_properties', label: 'View Properties', description: 'Browse and search property listings', group: 'Properties' },
  { id: 'edit_properties', label: 'Edit Properties', description: 'Add, update, and delete property records', group: 'Properties' },
  { id: 'view_clients', label: 'View Clients', description: 'Access client profiles and history', group: 'Clients' },
  { id: 'manage_enquiries', label: 'Manage Enquiries', description: 'Respond to and assign enquiries', group: 'Clients' },
  { id: 'manage_viewings', label: 'Manage Viewings', description: 'Schedule and update property viewings', group: 'Viewings' },
  { id: 'manage_team', label: 'Manage Team', description: 'Invite agents and manage roles', group: 'Administration' },
  { id: 'view_admin_logs', label: 'View Admin Logs', description: 'Access system audit logs', group: 'Administration' },
  { id: 'manage_users', label: 'Manage Users', description: 'Create, deactivate, and reset user accounts', group: 'Administration' },
];

const DEFAULT_PERMISSIONS: Record<UserRole, string[]> = {
  agent: ['view_dashboard', 'view_properties', 'view_clients', 'manage_enquiries', 'manage_viewings'],
  manager: ['view_dashboard', 'view_analytics', 'view_properties', 'edit_properties', 'view_clients', 'manage_enquiries', 'manage_viewings'],
  admin: ALL_PERMISSIONS.map((p) => p.id),
};

const PERMISSION_GROUPS = ['Dashboard', 'Properties', 'Clients', 'Viewings', 'Administration'];

const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function generatePassword(length = 12): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return result;
}

function RelativeTime({ iso }: { iso: string | null }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!iso) { setLabel('Never'); return; }
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) { setLabel(`${mins}m ago`); return; }
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) { setLabel(`${hrs}h ago`); return; }
    const days = Math.floor(hrs / 24);
    if (days < 30) { setLabel(`${days}d ago`); return; }
    setLabel(new Date(iso).toLocaleDateString('en-HK', { day: '2-digit', month: 'short', year: 'numeric' }));
  }, [iso]);
  return <>{label}</>;
}

// ─── Password Strength ────────────────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ chars', pass: password.length >= 8 },
    { label: 'Uppercase', pass: /[A-Z]/.test(password) },
    { label: 'Number', pass: /[0-9]/.test(password) },
    { label: 'Symbol', pass: /[!@#$%^&*]/.test(password) },
  ];
  const score = checks.filter((c) => c.pass).length;
  const strengthColor = score <= 1 ? 'bg-red-400' : score === 2 ? 'bg-amber-400' : score === 3 ? 'bg-blue-400' : 'bg-emerald-500';
  const strengthLabel = score <= 1 ? 'Weak' : score === 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong';
  const strengthTextColor = score <= 1 ? 'text-red-500' : score === 2 ? 'text-amber-500' : score === 3 ? 'text-blue-500' : 'text-emerald-600';

  if (!password) return null;
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= score ? strengthColor : 'bg-[hsl(214,20%,88%)]'}`} />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {checks.map((c) => (
            <span key={c.label} className={`text-xs flex items-center gap-0.5 ${c.pass ? 'text-emerald-600' : 'text-[hsl(215,15%,65%)]'}`}>
              <Icon name={c.pass ? 'CheckIcon' : 'XIcon'} size={10} />{c.label}
            </span>
          ))}
        </div>
        <span className={`text-xs font-semibold ${strengthTextColor}`}>{strengthLabel}</span>
      </div>
    </div>
  );
}

// ─── Permissions Panel Modal ──────────────────────────────────────────────────

function PermissionsModal({
  member,
  onClose,
  onSave,
}: {
  member: TeamMember;
  onClose: () => void;
  onSave: (id: string, permissions: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(member.permissions));
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const applyRoleDefaults = (role: UserRole) => setSelected(new Set(DEFAULT_PERMISSIONS[role]));

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    onSave(member.id, Array.from(selected));
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(214,20%,88%)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#1B4F8A] flex items-center justify-center text-white text-xs font-bold">
              {getInitials(member.fullName)}
            </div>
            <div>
              <h2 className="text-base font-bold text-[hsl(215,25%,18%)]">{member.fullName}</h2>
              <p className="text-xs text-[hsl(215,15%,52%)]">Edit Access Permissions</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors">
            <Icon name="XIcon" size={16} className="text-[hsl(215,15%,52%)]" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-[hsl(214,20%,88%)] bg-[hsl(210,20%,98%)]">
          <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">Apply Role Defaults</p>
          <div className="flex gap-2">
            {(Object.keys(ROLE_CONFIG) as UserRole[]).map((role) => (
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
                          checked ? 'border-[#8B1A2B]/30 bg-[#8B1A2B]/5' : 'border-[hsl(214,20%,90%)] hover:border-[hsl(214,20%,75%)] hover:bg-[hsl(210,15%,97%)]'
                        }`}
                      >
                        <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                          checked ? 'bg-[#8B1A2B] border-[#8B1A2B]' : 'border-[hsl(214,20%,70%)] bg-white'
                        }`}>
                          {checked && <Icon name="CheckIcon" size={10} className="text-white" />}
                        </div>
                        <input type="checkbox" checked={checked} onChange={() => toggle(perm.id)} className="sr-only" />
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

        <div className="px-6 py-4 border-t border-[hsl(214,20%,88%)] flex items-center justify-between gap-3">
          <span className="text-xs text-[hsl(215,15%,52%)]">{selected.size} of {ALL_PERMISSIONS.length} permissions enabled</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-[hsl(214,20%,88%)] text-sm font-semibold text-[hsl(215,25%,18%)] hover:bg-[hsl(210,15%,94%)] transition-colors">
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

// ─── Deduplication Section ────────────────────────────────────────────────────

function DeduplicationSection() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ before: number; after: number; removed: number; uniqueRefs: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const handleRun = async () => {
    setStatus('running');
    setResult(null);
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/deduplicate-properties', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Deduplication failed');
      setResult({ before: data.before, after: data.after, removed: data.removed, uniqueRefs: data.uniqueRefs });
      setStatus('done');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
    setConfirmed(false);
  };

  return (
    <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
          <Icon name="DatabaseIcon" size={16} className="text-orange-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-[hsl(215,25%,18%)]">Property Deduplication</p>
          <p className="text-xs text-[hsl(215,15%,55%)]">Remove duplicate property records grouped by property_ref</p>
        </div>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 mb-4">
        <Icon name="AlertTriangleIcon" size={14} className="flex-shrink-0 mt-0.5 text-amber-600" />
        <span>
          <strong>Destructive action:</strong> This permanently deletes duplicate rows, keeping only the earliest record per unique <code className="bg-amber-100 px-1 rounded">property_ref</code>. Rows with no property_ref are also removed. This cannot be undone.
        </span>
      </div>

      {/* Confirm checkbox */}
      {status === 'idle' && (
        <label className="flex items-center gap-2.5 mb-4 cursor-pointer select-none">
          <div
            onClick={() => setConfirmed((v) => !v)}
            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${confirmed ? 'bg-orange-600 border-orange-600' : 'border-[hsl(214,20%,70%)] bg-white'}`}
          >
            {confirmed && <Icon name="CheckIcon" size={10} className="text-white" />}
          </div>
          <input type="checkbox" checked={confirmed} onChange={() => setConfirmed((v) => !v)} className="sr-only" />
          <span className="text-xs text-[hsl(215,15%,45%)]">I understand this will permanently delete duplicate records</span>
        </label>
      )}

      {/* Run button */}
      {(status === 'idle' || status === 'error') && (
        <button
          onClick={handleRun}
          disabled={!confirmed || status === 'running'}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Icon name="DatabaseIcon" size={14} />
          Run Deduplication Now
        </button>
      )}

      {/* Running state */}
      {status === 'running' && (
        <div className="flex items-center gap-2.5 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
          <Icon name="LoaderIcon" size={15} className="animate-spin flex-shrink-0" />
          Running deduplication… this may take a moment for large datasets.
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mt-3">
          <Icon name="AlertCircleIcon" size={15} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Deduplication failed</p>
            <p className="text-xs mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Success results */}
      {status === 'done' && result && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-2 text-sm text-emerald-700 font-semibold">
            <Icon name="CheckCircleIcon" size={15} className="text-emerald-500" />
            Deduplication complete
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Rows Before', value: result.before?.toLocaleString() ?? '—', color: 'text-[hsl(215,25%,18%)]', bg: 'bg-slate-50', border: 'border-slate-200' },
              { label: 'Rows After', value: result.after?.toLocaleString() ?? '—', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
              { label: 'Duplicates Deleted', value: result.removed?.toLocaleString() ?? '—', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
              { label: 'Unique Property Refs', value: result.uniqueRefs?.toLocaleString() ?? '—', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
            ].map((stat) => (
              <div key={stat.label} className={`rounded-xl border ${stat.border} ${stat.bg} p-3 text-center`}>
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-[hsl(215,15%,55%)] mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setStatus('idle'); setResult(null); setConfirmed(false); }}
            className="text-xs text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)] underline"
          >
            Run again
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ members, onTabChange }: { members: TeamMember[]; onTabChange: (tab: ActiveTab) => void }) {
  const stats = {
    total: members.length,
    active: members.filter((m) => m.status === 'active').length,
    pending: members.filter((m) => m.status === 'pending').length,
    admins: members.filter((m) => m.role === 'admin').length,
    managers: members.filter((m) => m.role === 'manager').length,
    agents: members.filter((m) => m.role === 'agent').length,
  };

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Members', value: stats.total, icon: 'UsersIcon', color: 'text-[#1B4F8A]', bg: 'bg-blue-50' },
          { label: 'Active', value: stats.active, icon: 'UserCheckIcon', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Invite Pending', value: stats.pending, icon: 'MailIcon', color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Admins', value: stats.admins, icon: 'ShieldCheckIcon', color: 'text-[#8B1A2B]', bg: 'bg-[#8B1A2B]/10' },
          { label: 'Managers', value: stats.managers, icon: 'BriefcaseIcon', color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Agents', value: stats.agents, icon: 'UserIcon', color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-4 flex flex-col gap-2">
            <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
              <Icon name={stat.icon as Parameters<typeof Icon>[0]['name']} size={15} className={stat.color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-[hsl(215,25%,18%)]">{stat.value}</p>
              <p className="text-xs text-[hsl(215,15%,52%)]">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Role overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(Object.keys(ROLE_CONFIG) as UserRole[]).map((role) => {
          const count = members.filter((m) => m.role === role).length;
          const cfg = ROLE_CONFIG[role];
          return (
            <div key={role} className={`rounded-xl border p-4 ${cfg.badgeClass}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold">{cfg.label}</p>
                <span className="text-2xl font-bold">{count}</span>
              </div>
              <p className="text-xs opacity-75 mb-3">{cfg.desc}</p>
              <p className="text-xs font-semibold opacity-60">{DEFAULT_PERMISSIONS[role].length} default permissions</p>
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-5">
        <p className="text-xs font-bold text-[hsl(215,15%,40%)] uppercase tracking-wider mb-4">Quick Actions</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => onTabChange('invite')}
            className="flex items-center gap-3 p-4 rounded-xl border border-[hsl(214,20%,88%)] hover:border-[#8B1A2B]/30 hover:bg-[#8B1A2B]/5 transition-all group text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-[#8B1A2B]/10 flex items-center justify-center flex-shrink-0">
              <Icon name="UserPlusIcon" size={16} className="text-[#8B1A2B]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[hsl(215,25%,18%)] group-hover:text-[#8B1A2B] transition-colors">Invite Member</p>
              <p className="text-xs text-[hsl(215,15%,55%)]">Send login credentials</p>
            </div>
          </button>
          <button
            onClick={() => onTabChange('members')}
            className="flex items-center gap-3 p-4 rounded-xl border border-[hsl(214,20%,88%)] hover:border-[#1B4F8A]/30 hover:bg-blue-50/50 transition-all group text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Icon name="UsersIcon" size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[hsl(215,25%,18%)] group-hover:text-blue-700 transition-colors">Manage Members</p>
              <p className="text-xs text-[hsl(215,15%,55%)]">Edit roles & access</p>
            </div>
          </button>
          <button
            onClick={() => onTabChange('permissions')}
            className="flex items-center gap-3 p-4 rounded-xl border border-[hsl(214,20%,88%)] hover:border-amber-300 hover:bg-amber-50/50 transition-all group text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Icon name="ShieldIcon" size={16} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[hsl(215,25%,18%)] group-hover:text-amber-700 transition-colors">Permissions Matrix</p>
              <p className="text-xs text-[hsl(215,15%,55%)]">Fine-tune access control</p>
            </div>
          </button>
        </div>
      </div>

      {/* Deduplication tool */}
      <DeduplicationSection />

      {/* Recent members */}
      <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[hsl(214,20%,88%)] flex items-center justify-between">
          <p className="text-sm font-bold text-[hsl(215,25%,18%)]">Team Members</p>
          <button onClick={() => onTabChange('members')} className="text-xs text-[#8B1A2B] font-semibold hover:underline">View all →</button>
        </div>
        <div className="divide-y divide-[hsl(214,20%,92%)]">
          {members.slice(0, 5).map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${m.status === 'inactive' ? 'bg-slate-400' : 'bg-[#1B4F8A]'}`}>
                {getInitials(m.fullName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[hsl(215,25%,18%)] truncate">{m.fullName}</p>
                <p className="text-xs text-[hsl(215,15%,55%)] truncate">{m.email}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ROLE_CONFIG[m.role].badgeClass}`}>{ROLE_CONFIG[m.role].label}</span>
              <div className="flex items-center gap-1.5 hidden sm:flex">
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[m.status].dotClass}`} />
                <span className={`text-xs ${STATUS_CONFIG[m.status].textClass}`}>{STATUS_CONFIG[m.status].label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Invite Tab ───────────────────────────────────────────────────────────────

function InviteTab({ onMemberAdded }: { onMemberAdded: (member: TeamMember) => void }) {
  const [form, setForm] = useState<InviteForm>({ fullName: '', email: '', role: 'agent', tempPassword: '', personalNote: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleGenerate = useCallback(() => {
    setForm((f) => ({ ...f, tempPassword: generatePassword() }));
    setShowPassword(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!form.fullName.trim()) { setError('Full name is required.'); return; }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError('A valid email address is required.'); return; }
    if (!form.tempPassword) { setError('A temporary password is required.'); return; }
    if (form.tempPassword.length < 8) { setError('Temporary password must be at least 8 characters.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          fullName: form.fullName.trim(),
          role: form.role,
          tempPassword: form.tempPassword,
          personalNote: form.personalNote.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invitation');

      onMemberAdded({
        id: data.userId || String(Date.now()),
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        status: 'pending',
        createdAt: new Date().toISOString(),
        lastSignInAt: null,
        permissions: DEFAULT_PERMISSIONS[form.role],
        enquiriesHandled: 0,
      });

      setSuccessMsg(`Invitation sent to ${form.email.trim().toLowerCase()} — they'll receive login credentials by email.`);
      setForm({ fullName: '', email: '', role: 'agent', tempPassword: '', personalNote: '' });
      setShowPassword(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-2xl border border-[hsl(214,20%,88%)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[hsl(214,20%,88%)] flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#8B1A2B]/10 flex items-center justify-center">
            <Icon name="UserPlusIcon" size={18} className="text-[#8B1A2B]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[hsl(215,25%,18%)]">Invite Team Member</h2>
            <p className="text-xs text-[hsl(215,15%,52%)]">Send login credentials via email</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-[hsl(215,15%,52%)] bg-[hsl(210,15%,94%)] px-2.5 py-1 rounded-full">
            <Icon name="ShieldCheckIcon" size={11} className="text-emerald-500" />
            Credentials sent via email
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <Icon name="AlertCircleIcon" size={15} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="flex items-start gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
              <Icon name="CheckCircleIcon" size={15} className="flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>

          {/* Role selector */}
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-2">
              Assign Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ROLE_CONFIG) as UserRole[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, role }))}
                  className={`px-3 py-3 rounded-xl border text-left transition-all ${
                    form.role === role
                      ? 'border-[#8B1A2B] bg-[#8B1A2B]/5'
                      : 'border-[hsl(214,20%,88%)] hover:border-[hsl(214,20%,70%)]'
                  }`}
                >
                  <p className={`text-xs font-bold mb-0.5 ${form.role === role ? 'text-[#8B1A2B]' : 'text-[hsl(215,25%,18%)]'}`}>{ROLE_CONFIG[role].label}</p>
                  <p className="text-xs text-[hsl(215,15%,55%)] leading-tight">{ROLE_CONFIG[role].desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Temp password */}
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1.5">
              Temporary Password <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.tempPassword}
                  onChange={(e) => setForm((f) => ({ ...f, tempPassword: e.target.value }))}
                  placeholder="Min. 8 characters"
                  className="w-full px-3 py-2.5 pr-10 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] placeholder-[hsl(215,15%,70%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,55%)] hover:text-[hsl(215,25%,18%)]"
                >
                  <Icon name={showPassword ? 'EyeOffIcon' : 'EyeIcon'} size={14} />
                </button>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                className="px-3 py-2.5 rounded-lg border border-[hsl(214,20%,88%)] text-xs font-semibold text-[hsl(215,15%,52%)] hover:bg-[hsl(210,15%,94%)] transition-colors whitespace-nowrap flex items-center gap-1.5"
              >
                <Icon name="RefreshCwIcon" size={12} /> Generate
              </button>
            </div>
            <PasswordStrength password={form.tempPassword} />
          </div>

          {/* Personal note */}
          <div>
            <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1.5">
              Personal Note <span className="text-[hsl(215,15%,65%)] font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={form.personalNote}
              onChange={(e) => setForm((f) => ({ ...f, personalNote: e.target.value }))}
              placeholder="Welcome message included in the invitation email…"
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] placeholder-[hsl(215,15%,70%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] transition-colors resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setForm({ fullName: '', email: '', role: 'agent', tempPassword: '', personalNote: '' })}
              className="px-4 py-2.5 rounded-lg border border-[hsl(214,20%,88%)] text-sm font-semibold text-[hsl(215,25%,18%)] hover:bg-[hsl(210,15%,94%)] transition-colors"
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-[#8B1A2B] text-white text-sm font-semibold hover:bg-[#7a1726] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><Icon name="LoaderIcon" size={14} className="animate-spin" /> Sending…</> : <><Icon name="SendIcon" size={14} /> Send Invitation</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Members Tab ──────────────────────────────────────────────────────────────

function MembersTab({
  members,
  onRoleChange,
  onToggleStatus,
  onEditPermissions,
  onResetPassword,
}: {
  members: TeamMember[];
  onRoleChange: (id: string, role: UserRole) => void;
  onToggleStatus: (id: string, active: boolean) => void;
  onEditPermissions: (member: TeamMember) => void;
  onResetPassword: (id: string, name: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<UserStatus | 'all'>('all');
  const [resetLoading, setResetLoading] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState('');

  const filtered = members.filter((m) => {
    const matchSearch = m.fullName.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'all' || m.role === filterRole;
    const matchStatus = filterStatus === 'all' || m.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  const handleReset = async (id: string, name: string) => {
    setResetLoading(id);
    try {
      const res = await fetch(`/api/admin/users/${id}/reset-password`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setResetMsg(`Password reset email sent to ${name}`);
      setTimeout(() => setResetMsg(''), 4000);
    } catch {
      setResetMsg('Failed to send reset email');
      setTimeout(() => setResetMsg(''), 4000);
    } finally {
      setResetLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {resetMsg && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <Icon name="CheckCircleIcon" size={15} className="flex-shrink-0" />
          {resetMsg}
        </div>
      )}

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
        <div className="flex items-center gap-1">
          {(['all', 'agent', 'manager', 'admin'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterRole === r ? 'bg-[#8B1A2B] text-white' : 'text-[hsl(215,15%,52%)] hover:bg-[hsl(210,15%,94%)]'}`}
            >
              {r === 'all' ? 'All Roles' : ROLE_CONFIG[r].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'active', 'inactive', 'pending'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterStatus === s ? 'bg-[hsl(215,25%,18%)] text-white' : 'text-[hsl(215,15%,52%)] hover:bg-[hsl(210,15%,94%)]'}`}
            >
              {s === 'all' ? 'All Status' : STATUS_CONFIG[s].label}
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
                <th className="py-3 px-4 text-right text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Actions</th>
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
                filtered.map((member) => (
                  <tr key={member.id} className={`border-b border-[hsl(214,20%,92%)] hover:bg-[hsl(210,15%,97%)] transition-colors ${member.status === 'inactive' ? 'opacity-60' : ''}`}>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${member.status === 'inactive' ? 'bg-slate-400' : 'bg-[#1B4F8A]'}`}>
                          {getInitials(member.fullName)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[hsl(215,25%,18%)] truncate">{member.fullName}</p>
                          <p className="text-xs text-[hsl(215,15%,52%)] truncate">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[member.status].dotClass}`} />
                        <span className={`text-xs font-medium ${STATUS_CONFIG[member.status].textClass}`}>{STATUS_CONFIG[member.status].label}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={member.role}
                        onChange={(e) => onRoleChange(member.id, e.target.value as UserRole)}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 ${ROLE_CONFIG[member.role].badgeClass} bg-transparent`}
                      >
                        <option value="agent">Agent</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 hidden md:table-cell">
                      <button
                        onClick={() => onEditPermissions(member)}
                        className="flex items-center gap-1.5 text-xs text-[hsl(215,15%,52%)] hover:text-[#8B1A2B] transition-colors group"
                      >
                        <Icon name="ShieldIcon" size={13} className="group-hover:text-[#8B1A2B]" />
                        <span className="font-medium">{member.permissions.length} permissions</span>
                        <Icon name="PencilIcon" size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </td>
                    <td className="py-3.5 px-4 hidden lg:table-cell">
                      <span className="text-xs text-[hsl(215,15%,55%)]"><RelativeTime iso={member.lastSignInAt} /></span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => onEditPermissions(member)}
                          className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,92%)] transition-colors"
                          title="Edit permissions"
                        >
                          <Icon name="ShieldIcon" size={14} className="text-[hsl(215,15%,52%)]" />
                        </button>
                        <button
                          onClick={() => handleReset(member.id, member.fullName)}
                          disabled={resetLoading === member.id}
                          className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                          title="Reset password"
                        >
                          {resetLoading === member.id
                            ? <Icon name="LoaderIcon" size={14} className="text-blue-500 animate-spin" />
                            : <Icon name="KeyIcon" size={14} className="text-[hsl(215,15%,52%)] hover:text-blue-600" />
                          }
                        </button>
                        <button
                          onClick={() => onToggleStatus(member.id, member.status !== 'active')}
                          className={`p-1.5 rounded-lg transition-colors ${
                            member.status === 'active' ?'hover:bg-red-50 text-[hsl(215,15%,52%)] hover:text-red-600' :'hover:bg-emerald-50 text-[hsl(215,15%,52%)] hover:text-emerald-600'
                          }`}
                          title={member.status === 'active' ? 'Deactivate' : 'Activate'}
                        >
                          <Icon name={member.status === 'active' ? 'UserXIcon' : 'UserCheckIcon'} size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Permissions Tab ──────────────────────────────────────────────────────────

function PermissionsTab({ members, onEditPermissions }: { members: TeamMember[]; onEditPermissions: (member: TeamMember) => void }) {
  return (
    <div className="space-y-5">
      {/* Role matrix */}
      <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[hsl(214,20%,88%)]">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Role Permissions Matrix</h3>
          <p className="text-xs text-[hsl(215,15%,55%)] mt-0.5">Default permissions assigned to each role</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[hsl(214,20%,88%)] bg-[hsl(210,20%,98%)]">
                <th className="text-left text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider py-3 px-4">Permission</th>
                {(Object.keys(ROLE_CONFIG) as UserRole[]).map((role) => (
                  <th key={role} className="text-center text-xs font-semibold uppercase tracking-wider py-3 px-4">
                    <span className={`px-2.5 py-1 rounded-full border text-xs font-semibold ${ROLE_CONFIG[role].badgeClass}`}>{ROLE_CONFIG[role].label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((group) => {
                const perms = ALL_PERMISSIONS.filter((p) => p.group === group);
                return (
                  <React.Fragment key={group}>
                    <tr className="bg-[hsl(210,20%,98%)]">
                      <td colSpan={4} className="py-2 px-4 text-xs font-bold text-[hsl(215,15%,40%)] uppercase tracking-wider">{group}</td>
                    </tr>
                    {perms.map((perm) => (
                      <tr key={perm.id} className="border-b border-[hsl(214,20%,92%)] hover:bg-[hsl(210,15%,97%)]">
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium text-[hsl(215,25%,18%)]">{perm.label}</p>
                          <p className="text-xs text-[hsl(215,15%,55%)]">{perm.description}</p>
                        </td>
                        {(Object.keys(ROLE_CONFIG) as UserRole[]).map((role) => (
                          <td key={role} className="py-3 px-4 text-center">
                            {DEFAULT_PERMISSIONS[role].includes(perm.id) ? (
                              <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100">
                                <Icon name="CheckIcon" size={12} className="text-emerald-600" />
                              </div>
                            ) : (
                              <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[hsl(214,20%,92%)]">
                                <Icon name="MinusIcon" size={12} className="text-[hsl(215,15%,65%)]" />
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-member permissions */}
      <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[hsl(214,20%,88%)]">
          <h3 className="text-sm font-bold text-[hsl(215,25%,18%)]">Individual Member Permissions</h3>
          <p className="text-xs text-[hsl(215,15%,55%)] mt-0.5">Click Edit to customise permissions for a specific member</p>
        </div>
        <div className="divide-y divide-[hsl(214,20%,92%)]">
          {members.filter((m) => m.status !== 'inactive').map((member) => (
            <div key={member.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="w-9 h-9 rounded-full bg-[#1B4F8A] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {getInitials(member.fullName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{member.fullName}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ROLE_CONFIG[member.role].badgeClass}`}>{ROLE_CONFIG[member.role].label}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {member.permissions.slice(0, 4).map((pid) => {
                    const p = ALL_PERMISSIONS.find((x) => x.id === pid);
                    return p ? (
                      <span key={pid} className="text-xs bg-[hsl(210,15%,94%)] text-[hsl(215,15%,45%)] px-2 py-0.5 rounded-full">{p.label}</span>
                    ) : null;
                  })}
                  {member.permissions.length > 4 && (
                    <span className="text-xs text-[hsl(215,15%,55%)] font-medium">+{member.permissions.length - 4} more</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => onEditPermissions(member)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(214,20%,88%)] text-xs font-semibold text-[hsl(215,15%,52%)] hover:border-[#8B1A2B]/30 hover:text-[#8B1A2B] hover:bg-[#8B1A2B]/5 transition-all flex-shrink-0"
              >
                <Icon name="PencilIcon" size={12} /> Edit
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const MOCK_MEMBERS: TeamMember[] = [
  {
    id: '1',
    fullName: 'Christine Lau',
    email: 'christine@homesrus.hk',
    role: 'admin',
    status: 'active',
    createdAt: '2024-01-10T09:00:00Z',
    lastSignInAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    permissions: ALL_PERMISSIONS.map((p) => p.id),
    enquiriesHandled: 0,
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
    enquiriesHandled: 24,
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
    enquiriesHandled: 47,
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
    enquiriesHandled: 0,
  },
  {
    id: '5',
    fullName: 'Kevin Tsang',
    email: 'kevin@homesrus.hk',
    role: 'agent',
    status: 'inactive',
    createdAt: '2023-11-01T08:00:00Z',
    lastSignInAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
    permissions: DEFAULT_PERMISSIONS.agent,
    enquiriesHandled: 12,
  },
];

const TABS: { id: ActiveTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'LayoutDashboardIcon' },
  { id: 'invite', label: 'Invite Member', icon: 'UserPlusIcon' },
  { id: 'members', label: 'Manage Members', icon: 'UsersIcon' },
  { id: 'permissions', label: 'Permissions', icon: 'ShieldIcon' },
];

export default function AdminPanelClient() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [members, setMembers] = useState<TeamMember[]>(MOCK_MEMBERS);
  const [permissionsMember, setPermissionsMember] = useState<TeamMember | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const handleMemberAdded = useCallback((member: TeamMember) => {
    setMembers((prev) => [member, ...prev]);
    showSuccess(`Invitation sent to ${member.email}`);
    setActiveTab('members');
  }, []);

  const handleRoleChange = useCallback(async (id: string, role: UserRole) => {
    try {
      await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
    } catch { /* optimistic update */ }
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, role, permissions: DEFAULT_PERMISSIONS[role] } : m));
    showSuccess('Role updated successfully');
  }, []);

  const handleToggleStatus = useCallback(async (id: string, active: boolean) => {
    try {
      await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: active }),
      });
    } catch { /* optimistic update */ }
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, status: active ? 'active' : 'inactive' } : m));
    showSuccess(active ? 'User activated' : 'User deactivated');
  }, []);

  const handleSavePermissions = useCallback((id: string, permissions: string[]) => {
    setMembers((prev) => prev.map((m) => m.id === id ? { ...m, permissions } : m));
    showSuccess('Permissions updated successfully');
  }, []);

  return (
    <div className="min-h-screen bg-[hsl(210,20%,97%)]">
      {/* Page Header */}
      <div className="bg-white border-b border-[hsl(214,20%,88%)] px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#8B1A2B]/10 flex items-center justify-center">
              <Icon name="ShieldCheckIcon" size={20} className="text-[#8B1A2B]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Admin Panel</h1>
              <p className="text-sm text-[hsl(215,15%,52%)]">Invite team members, assign roles, and manage user access</p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('invite')}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#8B1A2B] text-white text-sm font-semibold rounded-xl hover:bg-[#7a1726] transition-colors shadow-sm"
          >
            <Icon name="UserPlusIcon" size={15} />
            <span className="hidden sm:inline">Invite Member</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
        {/* Global success banner */}
        {successMsg && (
          <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
            <Icon name="CheckCircleIcon" size={15} className="flex-shrink-0" />
            {successMsg}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-1 flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === tab.id
                  ? 'bg-[#8B1A2B] text-white shadow-sm'
                  : 'text-[hsl(215,15%,52%)] hover:bg-[hsl(210,15%,94%)] hover:text-[hsl(215,25%,18%)]'
              }`}
            >
              <Icon name={tab.icon as Parameters<typeof Icon>[0]['name']} size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <OverviewTab members={members} onTabChange={setActiveTab} />
        )}
        {activeTab === 'invite' && (
          <InviteTab onMemberAdded={handleMemberAdded} />
        )}
        {activeTab === 'members' && (
          <MembersTab
            members={members}
            onRoleChange={handleRoleChange}
            onToggleStatus={handleToggleStatus}
            onEditPermissions={setPermissionsMember}
            onResetPassword={(id, name) => {}}
          />
        )}
        {activeTab === 'permissions' && (
          <PermissionsTab members={members} onEditPermissions={setPermissionsMember} />
        )}
      </div>

      {/* Permissions modal */}
      {permissionsMember && (
        <PermissionsModal
          member={permissionsMember}
          onClose={() => setPermissionsMember(null)}
          onSave={handleSavePermissions}
        />
      )}
    </div>
  );
}
