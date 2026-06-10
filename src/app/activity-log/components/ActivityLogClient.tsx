'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type EntityType =
  | 'property' |'contact' |'form' |'tenancy' |'maintenance' |'viewing' |'enquiry' |'lease_renewal' |'commission' |'client';

type ActionType =
  | 'created' |'updated' |'deleted' |'status_changed' |'contact_added' |'contact_updated' |'contact_removed' |'form_generated' |'form_submitted' |'document_uploaded' |'note_added' |'assigned' |'archived';

interface ActivityLogEntry {
  id: string;
  entity_type: EntityType;
  action_type: ActionType;
  entity_id: string | null;
  entity_ref: string | null;
  entity_label: string | null;
  user_id: string | null;
  user_name: string;
  user_role: string;
  description: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ENTITY_COLORS: Record<EntityType, string> = {
  property: 'bg-violet-50 text-violet-700 border border-violet-200',
  contact: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  form: 'bg-amber-50 text-amber-700 border border-amber-200',
  tenancy: 'bg-blue-50 text-blue-700 border border-blue-200',
  maintenance: 'bg-orange-50 text-orange-700 border border-orange-200',
  viewing: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  enquiry: 'bg-sky-50 text-sky-700 border border-sky-200',
  lease_renewal: 'bg-teal-50 text-teal-700 border border-teal-200',
  commission: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  client: 'bg-pink-50 text-pink-700 border border-pink-200',
};

const ENTITY_ICONS: Record<EntityType, string> = {
  property: 'BuildingIcon',
  contact: 'UserIcon',
  form: 'FileTextIcon',
  tenancy: 'KeyIcon',
  maintenance: 'WrenchIcon',
  viewing: 'CalendarIcon',
  enquiry: 'InboxIcon',
  lease_renewal: 'RefreshCwIcon',
  commission: 'BadgeDollarSignIcon',
  client: 'UsersIcon',
};

const ACTION_COLORS: Record<ActionType, string> = {
  created: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  updated: 'bg-blue-50 text-blue-700 border border-blue-200',
  deleted: 'bg-red-50 text-red-700 border border-red-200',
  status_changed: 'bg-amber-50 text-amber-700 border border-amber-200',
  contact_added: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  contact_updated: 'bg-sky-50 text-sky-700 border border-sky-200',
  contact_removed: 'bg-rose-50 text-rose-700 border border-rose-200',
  form_generated: 'bg-violet-50 text-violet-700 border border-violet-200',
  form_submitted: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  document_uploaded: 'bg-teal-50 text-teal-700 border border-teal-200',
  note_added: 'bg-slate-100 text-slate-700 border border-slate-200',
  assigned: 'bg-orange-50 text-orange-700 border border-orange-200',
  archived: 'bg-gray-100 text-gray-600 border border-gray-200',
};

const ROLE_COLORS: Record<string, string> = {
  agent: 'bg-blue-50 text-blue-700 border border-blue-200',
  manager: 'bg-amber-50 text-amber-700 border border-amber-200',
  admin: 'bg-[#8B1A2B]/10 text-[#8B1A2B] border border-[#8B1A2B]/20',
};

const ACTION_LABELS: Record<ActionType, string> = {
  created: 'Created',
  updated: 'Updated',
  deleted: 'Deleted',
  status_changed: 'Status Changed',
  contact_added: 'Contact Added',
  contact_updated: 'Contact Updated',
  contact_removed: 'Contact Removed',
  form_generated: 'Form Generated',
  form_submitted: 'Form Submitted',
  document_uploaded: 'Document Uploaded',
  note_added: 'Note Added',
  assigned: 'Assigned',
  archived: 'Archived',
};

const ENTITY_LABELS: Record<EntityType, string> = {
  property: 'Property',
  contact: 'Contact',
  form: 'Form',
  tenancy: 'Tenancy',
  maintenance: 'Maintenance',
  viewing: 'Viewing',
  enquiry: 'Enquiry',
  lease_renewal: 'Lease Renewal',
  commission: 'Commission',
  client: 'Client',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-HK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ActivityLogClient() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      let query = supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (entityFilter !== 'all') {
        query = query.eq('entity_type', entityFilter);
      }
      if (actionFilter !== 'all') {
        query = query.eq('action_type', actionFilter);
      }
      if (dateFrom) {
        query = query.gte('created_at', new Date(dateFrom).toISOString());
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query = query.lte('created_at', end.toISOString());
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setEntries(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load activity log');
    } finally {
      setLoading(false);
    }
  }, [entityFilter, actionFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Client-side search + user filter
  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      e.description.toLowerCase().includes(q) ||
      (e.entity_ref || '').toLowerCase().includes(q) ||
      (e.entity_label || '').toLowerCase().includes(q) ||
      e.user_name.toLowerCase().includes(q);
    const matchUser = !userFilter || e.user_name.toLowerCase().includes(userFilter.toLowerCase());
    return matchSearch && matchUser;
  });

  // Summary counts
  const propertyCnt = entries.filter((e) => e.entity_type === 'property').length;
  const contactCnt = entries.filter((e) => e.entity_type === 'contact').length;
  const formCnt = entries.filter((e) => e.entity_type === 'form').length;
  const todayCnt = entries.filter((e) => {
    const d = new Date(e.created_at);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Activity Log</h1>
          <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">
            Complete audit trail of all property, contact, and form changes
          </p>
        </div>
        <button
          onClick={fetchEntries}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] hover:bg-[hsl(210,15%,94%)] transition-colors"
        >
          <Icon name="RefreshCwIcon" size={14} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Entries', value: entries.length, icon: 'ActivityIcon', color: 'text-[#1B4F8A]', bg: 'bg-blue-50' },
          { label: 'Today', value: todayCnt, icon: 'CalendarIcon', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Property Changes', value: propertyCnt, icon: 'BuildingIcon', color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Contact Changes', value: contactCnt + formCnt, icon: 'UserIcon', color: 'text-cyan-600', bg: 'bg-cyan-50' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-[hsl(214,20%,90%)] p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
              <Icon name={stat.icon as Parameters<typeof Icon>[0]['name']} size={16} className={stat.color} />
            </div>
            <div>
              <p className="text-xs text-[hsl(215,15%,52%)]">{stat.label}</p>
              <p className={`text-base font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5 mb-5 p-3.5 bg-[hsl(210,15%,97%)] rounded-xl border border-[hsl(214,20%,90%)]">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="SearchIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description, property ref, user…"
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] placeholder-[hsl(215,15%,70%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] bg-white transition-colors"
          />
        </div>

        {/* Entity type */}
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] bg-white transition-colors"
        >
          <option value="all">All Categories</option>
          <option value="property">Property</option>
          <option value="contact">Contact</option>
          <option value="form">Form</option>
          <option value="tenancy">Tenancy</option>
          <option value="maintenance">Maintenance</option>
          <option value="viewing">Viewing</option>
          <option value="enquiry">Enquiry</option>
          <option value="lease_renewal">Lease Renewal</option>
          <option value="commission">Commission</option>
          <option value="client">Client</option>
        </select>

        {/* Action type */}
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] bg-white transition-colors"
        >
          <option value="all">All Actions</option>
          <option value="created">Created</option>
          <option value="updated">Updated</option>
          <option value="deleted">Deleted</option>
          <option value="status_changed">Status Changed</option>
          <option value="contact_added">Contact Added</option>
          <option value="contact_updated">Contact Updated</option>
          <option value="contact_removed">Contact Removed</option>
          <option value="form_generated">Form Generated</option>
          <option value="form_submitted">Form Submitted</option>
          <option value="document_uploaded">Document Uploaded</option>
          <option value="note_added">Note Added</option>
          <option value="assigned">Assigned</option>
          <option value="archived">Archived</option>
        </select>

        {/* User filter */}
        <div className="relative min-w-[160px]">
          <Icon name="UserIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
          <input
            type="text"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            placeholder="Filter by user…"
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] placeholder-[hsl(215,15%,70%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] bg-white transition-colors"
          />
        </div>

        {/* Date range */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] bg-white transition-colors"
          title="From date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[hsl(214,20%,88%)] text-sm text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] bg-white transition-colors"
          title="To date"
        />

        {/* Clear filters */}
        {(search || entityFilter !== 'all' || actionFilter !== 'all' || userFilter || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setSearch('');
              setEntityFilter('all');
              setActionFilter('all');
              setUserFilter('');
              setDateFrom('');
              setDateTo('');
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[hsl(215,15%,52%)] hover:text-[#8B1A2B] hover:bg-[#8B1A2B]/5 transition-colors"
          >
            <Icon name="XIcon" size={13} />
            Clear
          </button>
        )}

        <span className="ml-auto text-xs text-[hsl(215,15%,52%)] font-medium bg-white border border-[hsl(214,20%,88%)] px-2.5 py-1 rounded-full">
          {filtered.length} records
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#8B1A2B] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[hsl(215,15%,52%)]">Loading activity log…</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Icon name="AlertCircleIcon" size={32} className="mx-auto mb-3 text-red-400" />
            <p className="text-sm font-medium text-red-600">{error}</p>
            <button
              onClick={fetchEntries}
              className="mt-3 text-sm text-[#8B1A2B] hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[hsl(214,20%,90%)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[hsl(214,20%,90%)] bg-[hsl(210,15%,97%)]">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider whitespace-nowrap">Timestamp</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider whitespace-nowrap">User</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider whitespace-nowrap">Category</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider whitespace-nowrap">Action</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider whitespace-nowrap">Reference</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Description</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider whitespace-nowrap">Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <React.Fragment key={entry.id}>
                    <tr className="border-b border-[hsl(214,20%,92%)] hover:bg-[hsl(210,15%,98%)] transition-colors last:border-0">
                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <p className="text-xs font-medium text-[hsl(215,25%,18%)]">{formatRelative(entry.created_at)}</p>
                        <p className="text-xs text-[hsl(215,15%,60%)] mt-0.5">{formatDateTime(entry.created_at)}</p>
                      </td>

                      {/* User */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#1B4F8A] flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                            {getInitials(entry.user_name)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[hsl(215,25%,18%)]">{entry.user_name}</p>
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full capitalize ${ROLE_COLORS[entry.user_role] || 'bg-slate-100 text-slate-600'}`}>
                              {entry.user_role}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${ENTITY_COLORS[entry.entity_type]}`}>
                          <Icon name={ENTITY_ICONS[entry.entity_type] as Parameters<typeof Icon>[0]['name']} size={11} />
                          {ENTITY_LABELS[entry.entity_type]}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${ACTION_COLORS[entry.action_type]}`}>
                          {ACTION_LABELS[entry.action_type]}
                        </span>
                      </td>

                      {/* Reference */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {entry.entity_ref ? (
                          <span className="text-sm font-mono font-semibold text-[#1B4F8A]">{entry.entity_ref}</span>
                        ) : (
                          <span className="text-xs text-[hsl(215,15%,65%)]">—</span>
                        )}
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4 max-w-xs">
                        <p className="text-sm text-[hsl(215,25%,18%)] line-clamp-2">{entry.description}</p>
                      </td>

                      {/* Expand toggle */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {(entry.before_state || entry.after_state || entry.metadata) ? (
                          <button
                            onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                            className="flex items-center gap-1 text-xs text-[hsl(215,15%,52%)] hover:text-[#8B1A2B] transition-colors"
                          >
                            <Icon name={expandedId === entry.id ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={13} />
                            {expandedId === entry.id ? 'Hide' : 'View'}
                          </button>
                        ) : (
                          <span className="text-xs text-[hsl(215,15%,70%)]">—</span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {expandedId === entry.id && (
                      <tr className="bg-[hsl(210,15%,97%)] border-b border-[hsl(214,20%,90%)]">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {entry.before_state && (
                              <div>
                                <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1.5">Before</p>
                                <pre className="text-xs bg-white border border-[hsl(214,20%,88%)] rounded-lg p-3 overflow-auto max-h-40 text-[hsl(215,25%,18%)]">
                                  {JSON.stringify(entry.before_state, null, 2)}
                                </pre>
                              </div>
                            )}
                            {entry.after_state && (
                              <div>
                                <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1.5">After</p>
                                <pre className="text-xs bg-white border border-[hsl(214,20%,88%)] rounded-lg p-3 overflow-auto max-h-40 text-[hsl(215,25%,18%)]">
                                  {JSON.stringify(entry.after_state, null, 2)}
                                </pre>
                              </div>
                            )}
                            {entry.metadata && (
                              <div>
                                <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider mb-1.5">Metadata</p>
                                <pre className="text-xs bg-white border border-[hsl(214,20%,88%)] rounded-lg p-3 overflow-auto max-h-40 text-[hsl(215,25%,18%)]">
                                  {JSON.stringify(entry.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && !loading && (
              <div className="text-center py-16 text-[hsl(215,15%,52%)]">
                <Icon name="ActivityIcon" size={36} className="mx-auto mb-3 opacity-25" />
                <p className="text-sm font-medium">No activity records match your filters</p>
                <p className="text-xs mt-1 opacity-70">Try adjusting the filters or date range</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
