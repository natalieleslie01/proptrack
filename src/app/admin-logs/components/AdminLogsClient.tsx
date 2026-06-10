'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'activity' | 'transactions' | 'audit' | 'roles';

type ActivityType = 'login' | 'logout' | 'enquiry' | 'property' | 'client' | 'viewing' | 'invite' | 'role_change';

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  activityType: ActivityType;
  target: string;
  timestamp: string;
  ipAddress: string;
  details?: string;
}

interface Transaction {
  id: string;
  propertyRef: string;
  propertyAddress: string;
  type: 'sale' | 'rental' | 'renewal' | 'termination';
  amount: number;
  currency: string;
  agentName: string;
  clientName: string;
  status: 'completed' | 'pending' | 'cancelled';
  date: string;
  notes?: string;
}

interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  event: string;
  eventCategory: 'auth' | 'data' | 'admin' | 'system';
  before?: string;
  after?: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
}

type UserRole = 'agent' | 'manager' | 'admin';

interface RolePermission {
  module: string;
  agent: boolean;
  manager: boolean;
  admin: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  agent: 'bg-blue-50 text-blue-700 border border-blue-200',
  manager: 'bg-amber-50 text-amber-700 border border-amber-200',
  admin: 'bg-[#8B1A2B]/10 text-[#8B1A2B] border border-[#8B1A2B]/20',
};

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  login: 'LogInIcon',
  logout: 'LogOutIcon',
  enquiry: 'InboxIcon',
  property: 'BuildingIcon',
  client: 'UserIcon',
  viewing: 'CalendarIcon',
  invite: 'UserPlusIcon',
  role_change: 'ShieldIcon',
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  login: 'bg-emerald-50 text-emerald-600',
  logout: 'bg-slate-100 text-slate-500',
  enquiry: 'bg-blue-50 text-blue-600',
  property: 'bg-violet-50 text-violet-600',
  client: 'bg-cyan-50 text-cyan-600',
  viewing: 'bg-amber-50 text-amber-600',
  invite: 'bg-indigo-50 text-indigo-600',
  role_change: 'bg-[#8B1A2B]/10 text-[#8B1A2B]',
};

const TX_STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  cancelled: 'bg-red-50 text-red-700 border border-red-200',
};

const TX_TYPE_COLORS: Record<string, string> = {
  sale: 'bg-violet-50 text-violet-700 border border-violet-200',
  rental: 'bg-blue-50 text-blue-700 border border-blue-200',
  renewal: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  termination: 'bg-red-50 text-red-700 border border-red-200',
};

const AUDIT_CATEGORY_COLORS: Record<string, string> = {
  auth: 'bg-emerald-50 text-emerald-700',
  data: 'bg-blue-50 text-blue-700',
  admin: 'bg-[#8B1A2B]/10 text-[#8B1A2B]',
  system: 'bg-slate-100 text-slate-600',
};

const ROLE_PERMISSIONS: RolePermission[] = [
  { module: 'View Dashboard', agent: true, manager: true, admin: true },
  { module: 'Manage Own Enquiries', agent: true, manager: true, admin: true },
  { module: 'View All Enquiries', agent: false, manager: true, admin: true },
  { module: 'Assign Enquiries', agent: false, manager: true, admin: true },
  { module: 'Add/Edit Properties', agent: true, manager: true, admin: true },
  { module: 'Delete Properties', agent: false, manager: false, admin: true },
  { module: 'Manage Clients', agent: true, manager: true, admin: true },
  { module: 'View Agent Metrics', agent: false, manager: true, admin: true },
  { module: 'Invite Team Members', agent: false, manager: false, admin: true },
  { module: 'User Management', agent: false, manager: false, admin: true },
  { module: 'Role Assignment', agent: false, manager: false, admin: true },
  { module: 'View Admin Logs', agent: false, manager: false, admin: true },
  { module: 'Export Reports', agent: false, manager: true, admin: true },
  { module: 'Property Matching', agent: true, manager: true, admin: true },
  { module: 'Schedule Viewings', agent: true, manager: true, admin: true },
];

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_ACTIVITIES: ActivityLog[] = [
  { id: 'a1', userId: 'u1', userName: 'Christine Lau', userRole: 'admin', action: 'Logged in', activityType: 'login', target: 'System', timestamp: new Date(Date.now() - 5 * 60000).toISOString(), ipAddress: '203.198.12.44' },
  { id: 'a2', userId: 'u2', userName: 'Marcus Wong', userRole: 'agent', action: 'Updated enquiry status to Viewing Scheduled', activityType: 'enquiry', target: 'ENQ-2024-0891', timestamp: new Date(Date.now() - 18 * 60000).toISOString(), ipAddress: '203.198.12.51', details: 'Status changed from New to Viewing Scheduled' },
  { id: 'a3', userId: 'u3', userName: 'Sarah Ng', userRole: 'manager', action: 'Added new property listing', activityType: 'property', target: 'DB-042 Siena One', timestamp: new Date(Date.now() - 42 * 60000).toISOString(), ipAddress: '203.198.12.88' },
  { id: 'a4', userId: 'u1', userName: 'Christine Lau', userRole: 'admin', action: 'Changed role: Marcus Wong → Manager', activityType: 'role_change', target: 'Marcus Wong', timestamp: new Date(Date.now() - 1.5 * 3600000).toISOString(), ipAddress: '203.198.12.44', details: 'Role changed from Agent to Manager' },
  { id: 'a5', userId: 'u4', userName: 'James Cheung', userRole: 'agent', action: 'Scheduled viewing for client', activityType: 'viewing', target: 'DB-019 Headland Village', timestamp: new Date(Date.now() - 2.2 * 3600000).toISOString(), ipAddress: '203.198.12.63' },
  { id: 'a6', userId: 'u1', userName: 'Christine Lau', userRole: 'admin', action: 'Invited new team member', activityType: 'invite', target: 'alice.chan@homesrus.hk', timestamp: new Date(Date.now() - 3 * 3600000).toISOString(), ipAddress: '203.198.12.44' },
  { id: 'a7', userId: 'u2', userName: 'Marcus Wong', userRole: 'agent', action: 'Added new client profile', activityType: 'client', target: 'David & Emma Thornton', timestamp: new Date(Date.now() - 4.5 * 3600000).toISOString(), ipAddress: '203.198.12.51' },
  { id: 'a8', userId: 'u3', userName: 'Sarah Ng', userRole: 'manager', action: 'Logged out', activityType: 'logout', target: 'System', timestamp: new Date(Date.now() - 6 * 3600000).toISOString(), ipAddress: '203.198.12.88' },
  { id: 'a9', userId: 'u5', userName: 'Lily Ho', userRole: 'agent', action: 'Updated property details', activityType: 'property', target: 'DB-033 Bijou Hamlet', timestamp: new Date(Date.now() - 8 * 3600000).toISOString(), ipAddress: '203.198.12.72' },
  { id: 'a10', userId: 'u4', userName: 'James Cheung', userRole: 'agent', action: 'Replied to enquiry', activityType: 'enquiry', target: 'ENQ-2024-0876', timestamp: new Date(Date.now() - 10 * 3600000).toISOString(), ipAddress: '203.198.12.63' },
];

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 't1', propertyRef: 'DB-019', propertyAddress: 'Headland Village, 3/F Flat A', type: 'rental', amount: 38000, currency: 'HKD', agentName: 'Marcus Wong', clientName: 'David Thornton', status: 'completed', date: new Date(Date.now() - 2 * 86400000).toISOString(), notes: '12-month tenancy agreement signed' },
  { id: 't2', propertyRef: 'DB-042', propertyAddress: 'Siena One, 8/F Flat B', type: 'sale', amount: 8500000, currency: 'HKD', agentName: 'Sarah Ng', clientName: 'Michael & Lisa Park', status: 'pending', date: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: 't3', propertyRef: 'DB-025', propertyAddress: 'Chianti, 12/F Flat C', type: 'renewal', amount: 32000, currency: 'HKD', agentName: 'James Cheung', clientName: 'Robert Chen', status: 'completed', date: new Date(Date.now() - 5 * 86400000).toISOString(), notes: 'Renewed for 24 months at same rate' },
  { id: 't4', propertyRef: 'DB-033', propertyAddress: 'Bijou Hamlet, G/F House 5', type: 'termination', amount: 0, currency: 'HKD', agentName: 'Lily Ho', clientName: 'Jennifer Walsh', status: 'completed', date: new Date(Date.now() - 7 * 86400000).toISOString(), notes: 'Early termination, deposit returned' },
  { id: 't5', propertyRef: 'DB-006', propertyAddress: 'Discovery Bay Plaza, 5/F Flat D', type: 'rental', amount: 22000, currency: 'HKD', agentName: 'Marcus Wong', clientName: 'Thomas & Amy Liu', status: 'pending', date: new Date(Date.now() - 9 * 86400000).toISOString() },
  { id: 't6', propertyRef: 'DB-038', propertyAddress: 'Positano, 2/F Flat A', type: 'sale', amount: 12000000, currency: 'HKD', agentName: 'Sarah Ng', clientName: 'William Foster', status: 'completed', date: new Date(Date.now() - 12 * 86400000).toISOString() },
  { id: 't7', propertyRef: 'DB-014', propertyAddress: 'La Costa, 7/F Flat B', type: 'rental', amount: 45000, currency: 'HKD', agentName: 'James Cheung', clientName: 'Sophie & Mark Anderson', status: 'cancelled', date: new Date(Date.now() - 14 * 86400000).toISOString(), notes: 'Client withdrew offer' },
];

const MOCK_AUDIT: AuditEntry[] = [
  { id: 'au1', userId: 'u1', userName: 'Christine Lau', userEmail: 'christine@homesrus.hk', userRole: 'admin', event: 'User role changed', eventCategory: 'admin', before: 'agent', after: 'manager', timestamp: new Date(Date.now() - 1.5 * 3600000).toISOString(), ipAddress: '203.198.12.44', userAgent: 'Chrome 124 / macOS' },
  { id: 'au2', userId: 'u2', userName: 'Marcus Wong', userEmail: 'marcus@homesrus.hk', userRole: 'manager', event: 'Successful login', eventCategory: 'auth', timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), ipAddress: '203.198.12.51', userAgent: 'Safari 17 / iOS' },
  { id: 'au3', userId: 'u1', userName: 'Christine Lau', userEmail: 'christine@homesrus.hk', userRole: 'admin', event: 'New user invited', eventCategory: 'admin', after: 'alice.chan@homesrus.hk (agent)', timestamp: new Date(Date.now() - 3 * 3600000).toISOString(), ipAddress: '203.198.12.44', userAgent: 'Chrome 124 / macOS' },
  { id: 'au4', userId: 'u4', userName: 'James Cheung', userEmail: 'james@homesrus.hk', userRole: 'agent', event: 'Failed login attempt', eventCategory: 'auth', timestamp: new Date(Date.now() - 5 * 3600000).toISOString(), ipAddress: '203.198.12.63', userAgent: 'Chrome 124 / Windows' },
  { id: 'au5', userId: 'u3', userName: 'Sarah Ng', userEmail: 'sarah@homesrus.hk', userRole: 'manager', event: 'Property record deleted', eventCategory: 'data', before: 'DB-011 (archived)', timestamp: new Date(Date.now() - 8 * 3600000).toISOString(), ipAddress: '203.198.12.88', userAgent: 'Firefox 125 / macOS' },
  { id: 'au6', userId: 'u5', userName: 'Lily Ho', userEmail: 'lily@homesrus.hk', userRole: 'agent', event: 'Password reset requested', eventCategory: 'auth', timestamp: new Date(Date.now() - 12 * 3600000).toISOString(), ipAddress: '203.198.12.72', userAgent: 'Chrome 124 / macOS' },
  { id: 'au7', userId: 'u1', userName: 'Christine Lau', userEmail: 'christine@homesrus.hk', userRole: 'admin', event: 'System settings updated', eventCategory: 'system', before: 'email_notifications: false', after: 'email_notifications: true', timestamp: new Date(Date.now() - 24 * 3600000).toISOString(), ipAddress: '203.198.12.44', userAgent: 'Chrome 124 / macOS' },
  { id: 'au8', userId: 'u2', userName: 'Marcus Wong', userEmail: 'marcus@homesrus.hk', userRole: 'manager', event: 'Bulk enquiry export', eventCategory: 'data', after: '47 records exported to CSV', timestamp: new Date(Date.now() - 30 * 3600000).toISOString(), ipAddress: '203.198.12.51', userAgent: 'Safari 17 / macOS' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-HK', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-HK', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatCurrency(amount: number, currency: string): string {
  if (amount === 0) return '—';
  return new Intl.NumberFormat('en-HK', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, count }: { title: string; subtitle: string; count?: number }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h2 className="text-base font-bold text-[hsl(215,25%,18%)]">{title}</h2>
        <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">{subtitle}</p>
      </div>
      {count !== undefined && (
        <span className="text-xs font-semibold text-[hsl(215,15%,52%)] bg-[hsl(210,15%,94%)] px-2.5 py-1 rounded-full">
          {count} records
        </span>
      )}
    </div>
  );
}

function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 mb-5 p-3.5 bg-[hsl(210,15%,97%)] rounded-xl border border-[hsl(214,20%,90%)]">
      {children}
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1 min-w-[200px]">
      <Icon name="SearchIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-3 py-2 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] placeholder-[hsl(215,15%,70%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] bg-white transition-colors"
      />
    </div>
  );
}

function SelectFilter({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] bg-white transition-colors"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ─── Tab: Team Activity ───────────────────────────────────────────────────────

function TeamActivityTab() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  const filtered = MOCK_ACTIVITIES.filter((a) => {
    const matchSearch = !search || a.userName.toLowerCase().includes(search.toLowerCase()) || a.action.toLowerCase().includes(search.toLowerCase()) || a.target.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || a.activityType === typeFilter;
    const matchRole = roleFilter === 'all' || a.userRole === roleFilter;
    return matchSearch && matchType && matchRole;
  });

  return (
    <div>
      <SectionHeader
        title="Team Activity Log"
        subtitle="Real-time record of all team member actions across the platform"
        count={filtered.length}
      />
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by user, action, or target…" />
        <SelectFilter
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: 'all', label: 'All Types' },
            { value: 'login', label: 'Login' },
            { value: 'logout', label: 'Logout' },
            { value: 'enquiry', label: 'Enquiry' },
            { value: 'property', label: 'Property' },
            { value: 'client', label: 'Client' },
            { value: 'viewing', label: 'Viewing' },
            { value: 'invite', label: 'Invite' },
            { value: 'role_change', label: 'Role Change' },
          ]}
        />
        <SelectFilter
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: 'all', label: 'All Roles' },
            { value: 'admin', label: 'Admin' },
            { value: 'manager', label: 'Manager' },
            { value: 'agent', label: 'Agent' },
          ]}
        />
      </FilterBar>

      <div className="space-y-2">
        {filtered.map((log) => (
          <div key={log.id} className="flex items-start gap-3.5 p-4 bg-white rounded-xl border border-[hsl(214,20%,90%)] hover:border-[hsl(214,20%,80%)] hover:shadow-sm transition-all">
            {/* Activity icon */}
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${ACTIVITY_COLORS[log.activityType]}`}>
              <Icon name={ACTIVITY_ICONS[log.activityType] as Parameters<typeof Icon>[0]['name']} size={16} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-[#1B4F8A] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                    {getInitials(log.userName)}
                  </div>
                  <span className="text-sm font-semibold text-[hsl(215,25%,18%)]">{log.userName}</span>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[log.userRole] || 'bg-slate-100 text-slate-600'}`}>
                  {log.userRole}
                </span>
              </div>
              <p className="text-sm text-[hsl(215,25%,18%)] mt-0.5">
                {log.action}{' '}
                <span className="font-medium text-[#1B4F8A]">{log.target}</span>
              </p>
              {log.details && (
                <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">{log.details}</p>
              )}
            </div>

            {/* Meta */}
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-medium text-[hsl(215,25%,18%)]">{formatRelative(log.timestamp)}</p>
              <p className="text-xs text-[hsl(215,15%,65%)] mt-0.5">{log.ipAddress}</p>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-[hsl(215,15%,52%)]">
            <Icon name="ActivityIcon" size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No activity logs match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Transaction History ─────────────────────────────────────────────────

function TransactionHistoryTab() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = MOCK_TRANSACTIONS.filter((t) => {
    const matchSearch = !search || t.propertyAddress.toLowerCase().includes(search.toLowerCase()) || t.agentName.toLowerCase().includes(search.toLowerCase()) || t.clientName.toLowerCase().includes(search.toLowerCase()) || t.propertyRef.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || t.type === typeFilter;
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const totalCompleted = MOCK_TRANSACTIONS.filter((t) => t.status === 'completed').reduce((sum, t) => sum + t.amount, 0);

  return (
    <div>
      <SectionHeader
        title="Property Transaction History"
        subtitle="Complete record of all property sales, rentals, renewals, and terminations"
        count={filtered.length}
      />

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Transactions', value: MOCK_TRANSACTIONS.length.toString(), icon: 'ArrowLeftRightIcon', color: 'text-[#1B4F8A]', bg: 'bg-blue-50' },
          { label: 'Completed', value: MOCK_TRANSACTIONS.filter((t) => t.status === 'completed').length.toString(), icon: 'CheckCircleIcon', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Pending', value: MOCK_TRANSACTIONS.filter((t) => t.status === 'pending').length.toString(), icon: 'ClockIcon', color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Total Value', value: formatCurrency(totalCompleted, 'HKD'), icon: 'DollarSignIcon', color: 'text-[#8B1A2B]', bg: 'bg-[#8B1A2B]/5' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-[hsl(214,20%,90%)] p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
              <Icon name={stat.icon as Parameters<typeof Icon>[0]['name']} size={16} className={stat.color} />
            </div>
            <div>
              <p className="text-xs text-[hsl(215,15%,52%)]">{stat.label}</p>
              <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by property, agent, or client…" />
        <SelectFilter
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: 'all', label: 'All Types' },
            { value: 'sale', label: 'Sale' },
            { value: 'rental', label: 'Rental' },
            { value: 'renewal', label: 'Renewal' },
            { value: 'termination', label: 'Termination' },
          ]}
        />
        <SelectFilter
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All Statuses' },
            { value: 'completed', label: 'Completed' },
            { value: 'pending', label: 'Pending' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
      </FilterBar>

      <div className="bg-white rounded-xl border border-[hsl(214,20%,90%)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[hsl(214,20%,90%)] bg-[hsl(210,15%,97%)]">
              <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Property</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Type</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Amount</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Agent</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Client</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Status</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx) => (
              <tr key={tx.id} className="border-b border-[hsl(214,20%,92%)] hover:bg-[hsl(210,15%,97%)] transition-colors last:border-0">
                <td className="py-3.5 px-4">
                  <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{tx.propertyRef}</p>
                  <p className="text-xs text-[hsl(215,15%,52%)] truncate max-w-[180px]">{tx.propertyAddress}</p>
                </td>
                <td className="py-3.5 px-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${TX_TYPE_COLORS[tx.type]}`}>
                    {tx.type}
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <span className="text-sm font-bold tabular-nums text-[hsl(215,25%,18%)]">{formatCurrency(tx.amount, tx.currency)}</span>
                  {tx.type === 'rental' && tx.amount > 0 && <span className="text-xs text-[hsl(215,15%,52%)]">/mo</span>}
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#1B4F8A] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                      {getInitials(tx.agentName)}
                    </div>
                    <span className="text-sm text-[hsl(215,25%,18%)]">{tx.agentName}</span>
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <span className="text-sm text-[hsl(215,25%,18%)]">{tx.clientName}</span>
                </td>
                <td className="py-3.5 px-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${TX_STATUS_COLORS[tx.status]}`}>
                    {tx.status}
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <span className="text-sm text-[hsl(215,15%,52%)]">{formatRelative(tx.date)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[hsl(215,15%,52%)]">
            <Icon name="ArrowLeftRightIcon" size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No transactions match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: User Audit Trails ───────────────────────────────────────────────────

function UserAuditTab() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = MOCK_AUDIT.filter((a) => {
    const matchSearch = !search || a.userName.toLowerCase().includes(search.toLowerCase()) || a.event.toLowerCase().includes(search.toLowerCase()) || a.userEmail.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || a.eventCategory === categoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <div>
      <SectionHeader
        title="User Audit Trails"
        subtitle="Detailed log of security events, data changes, and administrative actions"
        count={filtered.length}
      />
      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by user, email, or event…" />
        <SelectFilter
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            { value: 'all', label: 'All Categories' },
            { value: 'auth', label: 'Authentication' },
            { value: 'data', label: 'Data Changes' },
            { value: 'admin', label: 'Admin Actions' },
            { value: 'system', label: 'System' },
          ]}
        />
      </FilterBar>

      <div className="space-y-2">
        {filtered.map((entry) => {
          const isExpanded = expanded === entry.id;
          return (
            <div
              key={entry.id}
              className="bg-white rounded-xl border border-[hsl(214,20%,90%)] overflow-hidden hover:border-[hsl(214,20%,80%)] transition-all"
            >
              <button
                className="w-full flex items-center gap-3.5 p-4 text-left"
                onClick={() => setExpanded(isExpanded ? null : entry.id)}
              >
                {/* Category badge */}
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg capitalize flex-shrink-0 ${AUDIT_CATEGORY_COLORS[entry.eventCategory]}`}>
                  {entry.eventCategory}
                </span>

                {/* User */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-7 h-7 rounded-full bg-[#1B4F8A] flex items-center justify-center text-white text-[9px] font-bold">
                    {getInitials(entry.userName)}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs font-semibold text-[hsl(215,25%,18%)] leading-tight">{entry.userName}</p>
                    <p className="text-xs text-[hsl(215,15%,52%)]">{entry.userEmail}</p>
                  </div>
                </div>

                {/* Event */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[hsl(215,25%,18%)] truncate">{entry.event}</p>
                </div>

                {/* Time */}
                <div className="text-right flex-shrink-0 flex items-center gap-2">
                  <span className="text-xs text-[hsl(215,15%,52%)]">{formatRelative(entry.timestamp)}</span>
                  <Icon name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} className="text-[hsl(215,15%,52%)]" />
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-[hsl(214,20%,92%)] pt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[hsl(215,15%,52%)] font-semibold uppercase tracking-wider mb-1">Timestamp</p>
                    <p className="text-[hsl(215,25%,18%)]">{formatDateTime(entry.timestamp)}</p>
                  </div>
                  <div>
                    <p className="text-[hsl(215,15%,52%)] font-semibold uppercase tracking-wider mb-1">IP Address</p>
                    <p className="text-[hsl(215,25%,18%)] font-mono">{entry.ipAddress}</p>
                  </div>
                  <div>
                    <p className="text-[hsl(215,15%,52%)] font-semibold uppercase tracking-wider mb-1">User Agent</p>
                    <p className="text-[hsl(215,25%,18%)]">{entry.userAgent}</p>
                  </div>
                  <div>
                    <p className="text-[hsl(215,15%,52%)] font-semibold uppercase tracking-wider mb-1">Role</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[entry.userRole] || 'bg-slate-100 text-slate-600'}`}>
                      {entry.userRole}
                    </span>
                  </div>
                  {entry.before && (
                    <div>
                      <p className="text-[hsl(215,15%,52%)] font-semibold uppercase tracking-wider mb-1">Before</p>
                      <p className="text-red-600 font-mono bg-red-50 px-2 py-1 rounded">{entry.before}</p>
                    </div>
                  )}
                  {entry.after && (
                    <div>
                      <p className="text-[hsl(215,15%,52%)] font-semibold uppercase tracking-wider mb-1">After</p>
                      <p className="text-emerald-700 font-mono bg-emerald-50 px-2 py-1 rounded">{entry.after}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-[hsl(215,15%,52%)]">
            <Icon name="ShieldCheckIcon" size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No audit entries match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Role-Based Access ───────────────────────────────────────────────────

function RoleAccessTab() {
  const roleDescriptions: Record<UserRole, { desc: string; color: string; icon: string }> = {
    agent: { desc: 'Front-line staff managing enquiries, clients, and viewings', color: 'bg-blue-50 border-blue-200 text-blue-700', icon: 'UserIcon' },
    manager: { desc: 'Team leads with oversight of agents and access to reports', color: 'bg-amber-50 border-amber-200 text-amber-700', icon: 'BriefcaseIcon' },
    admin: { desc: 'Full system access including user management and audit logs', color: 'bg-[#8B1A2B]/5 border-[#8B1A2B]/20 text-[#8B1A2B]', icon: 'ShieldIcon' },
  };

  return (
    <div>
      <SectionHeader
        title="Role-Based Access Management"
        subtitle="Permission matrix defining what each role can access and perform"
      />

      {/* Role cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {(Object.entries(roleDescriptions) as [UserRole, typeof roleDescriptions[UserRole]][]).map(([role, config]) => {
          const permCount = ROLE_PERMISSIONS.filter((p) => p[role]).length;
          return (
            <div key={role} className={`rounded-xl border p-4 ${config.color}`}>
              <div className="flex items-center gap-2.5 mb-2">
                <Icon name={config.icon as Parameters<typeof Icon>[0]['name']} size={18} />
                <span className="font-bold text-sm capitalize">{role}</span>
              </div>
              <p className="text-xs opacity-80 leading-relaxed mb-3">{config.desc}</p>
              <p className="text-xs font-semibold">{permCount} / {ROLE_PERMISSIONS.length} permissions</p>
            </div>
          );
        })}
      </div>

      {/* Permission matrix */}
      <div className="bg-white rounded-xl border border-[hsl(214,20%,90%)] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[hsl(214,20%,90%)] bg-[hsl(210,15%,97%)]">
              <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider w-1/2">Module / Permission</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-blue-600 uppercase tracking-wider">Agent</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-amber-600 uppercase tracking-wider">Manager</th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-[#8B1A2B] uppercase tracking-wider">Admin</th>
            </tr>
          </thead>
          <tbody>
            {ROLE_PERMISSIONS.map((perm, idx) => (
              <tr key={perm.module} className={`border-b border-[hsl(214,20%,92%)] last:border-0 ${idx % 2 === 0 ? '' : 'bg-[hsl(210,15%,98%)]'}`}>
                <td className="py-3 px-4 text-sm text-[hsl(215,25%,18%)] font-medium">{perm.module}</td>
                {(['agent', 'manager', 'admin'] as UserRole[]).map((role) => (
                  <td key={role} className="py-3 px-4 text-center">
                    {perm[role] ? (
                      <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100">
                        <Icon name="CheckIcon" size={12} className="text-emerald-600" />
                      </div>
                    ) : (
                      <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[hsl(210,15%,94%)]">
                        <Icon name="XIcon" size={12} className="text-[hsl(215,15%,65%)]" />
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 px-1">
        <div className="flex items-center gap-1.5 text-xs text-[hsl(215,15%,52%)]">
          <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center">
            <Icon name="CheckIcon" size={10} className="text-emerald-600" />
          </div>
          Permitted
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[hsl(215,15%,52%)]">
          <div className="w-4 h-4 rounded-full bg-[hsl(210,15%,94%)] flex items-center justify-center">
            <Icon name="XIcon" size={10} className="text-[hsl(215,15%,65%)]" />
          </div>
          Restricted
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: string; description: string }[] = [
  { id: 'activity', label: 'Team Activity', icon: 'ActivityIcon', description: 'Live action feed' },
  { id: 'transactions', label: 'Transactions', icon: 'ArrowLeftRightIcon', description: 'Property deals' },
  { id: 'audit', label: 'Audit Trails', icon: 'ShieldCheckIcon', description: 'Security events' },
  { id: 'roles', label: 'Role Access', icon: 'ShieldIcon', description: 'Permission matrix' },
];

export default function AdminLogsClient() {
  const [activeTab, setActiveTab] = useState<TabId>('activity');

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-[#8B1A2B]/10 flex items-center justify-center">
                <Icon name="ShieldCheckIcon" size={16} className="text-[#8B1A2B]" />
              </div>
              <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Admin Operations Centre</h1>
            </div>
            <p className="text-sm text-[hsl(215,15%,52%)] ml-10.5">
              Operational visibility across team activity, transactions, security events, and access control
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#8B1A2B]/10 text-[#8B1A2B] text-xs font-semibold border border-[#8B1A2B]/20">
            <Icon name="LockIcon" size={11} />
            Admin Only
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[hsl(210,15%,94%)] rounded-xl mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-[#8B1A2B] shadow-sm'
                  : 'text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)]'
              }`}
            >
              <Icon name={tab.icon as Parameters<typeof Icon>[0]['name']} size={15} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'activity' && <TeamActivityTab />}
          {activeTab === 'transactions' && <TransactionHistoryTab />}
          {activeTab === 'audit' && <UserAuditTab />}
          {activeTab === 'roles' && <RoleAccessTab />}
        </div>
      </div>
    </AppLayout>
  );
}
