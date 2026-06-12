'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';

interface KeyRecord {
  id: string;
  property_ref: string | null;
  property_label: string;
  key_number: string | null;
  key_type: string;
  held_by: string | null;
  collected_date: string | null;
  returned_date: string | null;
  notes: string | null;
  status: string;
  key_status: string | null;
  sole_agent: string | null;
  sole_agent_name: string | null;
  sole_agent_valid_from: string | null;
  sole_agent_valid_to: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  held: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  returned: 'bg-gray-100 text-gray-600 border-gray-200',
  missing: 'bg-red-100 text-red-700 border-red-200',
};

const KEY_STATUS_COLORS: Record<string, string> = {
  Yes: 'bg-blue-100 text-blue-700 border-blue-200',
  No: 'bg-gray-100 text-gray-500 border-gray-200',
  Other: 'bg-amber-100 text-amber-700 border-amber-200',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function isExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  return d >= now && d <= in30;
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export default function KeyInventoryClient() {
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [keyStatusFilter, setKeyStatusFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<KeyRecord>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('key_log')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) setKeys(data as KeyRecord[]);
    } catch (err) {
      console.error('Key inventory fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const allAgents = Array.from(new Set(keys.map(k => k.held_by).filter(Boolean))) as string[];

  const filtered = keys.filter(k => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      k.property_label.toLowerCase().includes(q) ||
      (k.property_ref || '').toLowerCase().includes(q) ||
      (k.key_number || '').toLowerCase().includes(q) ||
      (k.held_by || '').toLowerCase().includes(q) ||
      (k.key_type || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || k.status === statusFilter;
    const matchKeyStatus = keyStatusFilter === 'all' || k.key_status === keyStatusFilter;
    const matchAgent = agentFilter === 'all' || k.held_by === agentFilter;
    return matchSearch && matchStatus && matchKeyStatus && matchAgent;
  });

  const stats = {
    total: keys.length,
    held: keys.filter(k => k.status === 'held').length,
    returned: keys.filter(k => k.status === 'returned').length,
    missing: keys.filter(k => k.status === 'missing').length,
    expiringSoon: keys.filter(k => isExpiringSoon(k.sole_agent_valid_to)).length,
  };

  function startEdit(key: KeyRecord) {
    setEditingId(key.id);
    setEditValues({ ...key });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValues({});
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('key_log')
        .update({
          key_number: editValues.key_number,
          key_type: editValues.key_type,
          held_by: editValues.held_by,
          status: editValues.status,
          key_status: editValues.key_status,
          sole_agent: editValues.sole_agent,
          sole_agent_name: editValues.sole_agent_name,
          sole_agent_valid_from: editValues.sole_agent_valid_from || null,
          sole_agent_valid_to: editValues.sole_agent_valid_to || null,
          notes: editValues.notes,
          returned_date: editValues.returned_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (!error) {
        setSaveMsg('Saved');
        setTimeout(() => setSaveMsg(null), 2000);
        setEditingId(null);
        fetchKeys();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard" className="text-[hsl(215,15%,52%)] hover:text-[#1B4F8A] transition-colors">
              <Icon name="ArrowLeftIcon" size={16} />
            </Link>
            <h1 className="text-2xl font-bold text-[hsl(215,25%,18%)]">Key Inventory</h1>
          </div>
          <p className="text-sm text-[hsl(215,15%,52%)]">
            Manage and track all property keys across the portfolio
          </p>
        </div>
        {saveMsg && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
            <Icon name="CheckCircleIcon" size={15} />
            {saveMsg}
          </span>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total Keys', value: stats.total, icon: 'KeyIcon', color: 'bg-[#1B4F8A]/10 text-[#1B4F8A]', border: 'border-[hsl(214,20%,88%)]' },
          { label: 'Currently Held', value: stats.held, icon: 'KeyRoundIcon', color: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200' },
          { label: 'Returned', value: stats.returned, icon: 'CornerDownLeftIcon', color: 'bg-gray-100 text-gray-600', border: 'border-gray-200' },
          { label: 'Missing', value: stats.missing, icon: 'AlertCircleIcon', color: 'bg-red-100 text-red-700', border: 'border-red-200' },
          { label: 'Expiring ≤30d', value: stats.expiringSoon, icon: 'ClockIcon', color: 'bg-amber-100 text-amber-700', border: 'border-amber-200' },
        ].map(s => (
          <div key={s.label} className={`card border ${s.border} p-4 flex items-center gap-3`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.color}`}>
              <Icon name={s.icon as Parameters<typeof Icon>[0]['name']} size={18} />
            </div>
            <div>
              <p className="text-xl font-bold text-[hsl(215,25%,18%)] tabular-nums">{loading ? '—' : s.value}</p>
              <p className="text-xs text-[hsl(215,15%,52%)]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="SearchIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
          <input
            type="text"
            placeholder="Search property, key number, holder…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-base pl-9 w-full text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="input-base w-auto text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="held">Held</option>
          <option value="returned">Returned</option>
          <option value="missing">Missing</option>
        </select>
        <select
          value={keyStatusFilter}
          onChange={e => setKeyStatusFilter(e.target.value)}
          className="input-base w-auto text-sm"
        >
          <option value="all">All Key Status</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
          <option value="Other">Other</option>
        </select>
        <select
          value={agentFilter}
          onChange={e => setAgentFilter(e.target.value)}
          className="input-base w-auto text-sm"
        >
          <option value="all">All Holders</option>
          {allAgents.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <span className="text-xs text-[hsl(215,15%,52%)] ml-auto">
          {filtered.length} of {keys.length} records
        </span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(214,20%,88%)] bg-[hsl(210,15%,97%)]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Property</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Key #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Key Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Holder</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Sole Agent</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Valid From</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Valid To</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">Notes</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(214,20%,92%)]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 11 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-[hsl(215,15%,52%)]">
                    <Icon name="KeyIcon" size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="font-medium">No key records found</p>
                    <p className="text-xs mt-1">Try adjusting your search or filters</p>
                  </td>
                </tr>
              ) : (
                filtered.map(key => {
                  const isEditing = editingId === key.id;
                  const validToExpiring = isExpiringSoon(key.sole_agent_valid_to);
                  const validToExpired = isExpired(key.sole_agent_valid_to);

                  return (
                    <tr key={key.id} className={`hover:bg-[hsl(210,15%,98%)] transition-colors ${isEditing ? 'bg-blue-50/40' : ''}`}>
                      {/* Property */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-[hsl(215,25%,18%)] leading-tight">{key.property_label}</p>
                        {key.property_ref && (
                          <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">{key.property_ref}</p>
                        )}
                      </td>

                      {/* Key Number */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValues.key_number || ''}
                            onChange={e => setEditValues(v => ({ ...v, key_number: e.target.value }))}
                            className="input-base text-sm w-24"
                            placeholder="K-000"
                          />
                        ) : (
                          <span className="font-mono text-sm text-[hsl(215,25%,18%)]">{key.key_number || '—'}</span>
                        )}
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValues.key_type || ''}
                            onChange={e => setEditValues(v => ({ ...v, key_type: e.target.value }))}
                            className="input-base text-sm w-28"
                          />
                        ) : (
                          <span className="text-[hsl(215,25%,18%)]">{key.key_type}</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={editValues.status || 'held'}
                            onChange={e => setEditValues(v => ({ ...v, status: e.target.value }))}
                            className="input-base text-sm w-28"
                          >
                            <option value="held">Held</option>
                            <option value="returned">Returned</option>
                            <option value="missing">Missing</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[key.status] || STATUS_COLORS.held}`}>
                            {key.status.charAt(0).toUpperCase() + key.status.slice(1)}
                          </span>
                        )}
                      </td>

                      {/* Key Status */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={editValues.key_status || ''}
                            onChange={e => setEditValues(v => ({ ...v, key_status: e.target.value || null }))}
                            className="input-base text-sm w-24"
                          >
                            <option value="">—</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                            <option value="Other">Other</option>
                          </select>
                        ) : key.key_status ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${KEY_STATUS_COLORS[key.key_status] || ''}`}>
                            {key.key_status}
                          </span>
                        ) : (
                          <span className="text-[hsl(215,15%,52%)]">—</span>
                        )}
                      </td>

                      {/* Holder */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValues.held_by || ''}
                            onChange={e => setEditValues(v => ({ ...v, held_by: e.target.value }))}
                            className="input-base text-sm w-32"
                            placeholder="Agent name"
                          />
                        ) : (
                          <span className="text-[hsl(215,25%,18%)]">{key.held_by || '—'}</span>
                        )}
                      </td>

                      {/* Sole Agent */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="space-y-1">
                            <select
                              value={editValues.sole_agent || ''}
                              onChange={e => setEditValues(v => ({ ...v, sole_agent: e.target.value || null }))}
                              className="input-base text-sm w-32"
                            >
                              <option value="">—</option>
                              <option value="Homes R Us">Homes R Us</option>
                              <option value="Other">Other</option>
                            </select>
                            {editValues.sole_agent === 'Other' && (
                              <input
                                type="text"
                                value={editValues.sole_agent_name || ''}
                                onChange={e => setEditValues(v => ({ ...v, sole_agent_name: e.target.value }))}
                                className="input-base text-sm w-32"
                                placeholder="Agent name"
                              />
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="text-[hsl(215,25%,18%)]">{key.sole_agent || '—'}</span>
                            {key.sole_agent === 'Other' && key.sole_agent_name && (
                              <p className="text-xs text-[hsl(215,15%,52%)]">{key.sole_agent_name}</p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Valid From */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editValues.sole_agent_valid_from || ''}
                            onChange={e => setEditValues(v => ({ ...v, sole_agent_valid_from: e.target.value }))}
                            className="input-base text-sm w-36"
                          />
                        ) : (
                          <span className="text-[hsl(215,25%,18%)]">{formatDate(key.sole_agent_valid_from)}</span>
                        )}
                      </td>

                      {/* Valid To */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editValues.sole_agent_valid_to || ''}
                            onChange={e => setEditValues(v => ({ ...v, sole_agent_valid_to: e.target.value }))}
                            className="input-base text-sm w-36"
                          />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className={`text-sm ${validToExpired ? 'text-red-600 font-medium' : validToExpiring ? 'text-amber-600 font-medium' : 'text-[hsl(215,25%,18%)]'}`}>
                              {formatDate(key.sole_agent_valid_to)}
                            </span>
                            {validToExpired && <Icon name="AlertCircleIcon" size={13} className="text-red-500 flex-shrink-0" />}
                            {!validToExpired && validToExpiring && <Icon name="ClockIcon" size={13} className="text-amber-500 flex-shrink-0" />}
                          </div>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="px-4 py-3 max-w-[160px]">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValues.notes || ''}
                            onChange={e => setEditValues(v => ({ ...v, notes: e.target.value }))}
                            className="input-base text-sm w-36"
                            placeholder="Notes…"
                          />
                        ) : (
                          <span className="text-xs text-[hsl(215,15%,52%)] line-clamp-2">{key.notes || '—'}</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => saveEdit(key.id)}
                              disabled={saving}
                              className="btn-primary py-1 px-2.5 text-xs"
                            >
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="btn-secondary py-1 px-2.5 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(key)}
                            className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] text-[hsl(215,15%,52%)] hover:text-[#1B4F8A] transition-colors"
                            title="Edit"
                          >
                            <Icon name="PencilIcon" size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
