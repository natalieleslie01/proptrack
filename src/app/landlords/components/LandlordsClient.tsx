'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useRole } from '@/hooks/useRole';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Landlord {
  id: string;
  full_name: string;
  mobile: string | null;
  email: string | null;
  company_name: string | null;
  notes: string | null;
  created_at: string;
  property_count?: number;
}

interface LandlordForm {
  full_name: string;
  mobile: string;
  email: string;
  company_name: string;
  notes: string;
}

type SortKey = 'full_name' | 'company_name' | 'mobile' | 'created_at';
type SortDir = 'asc' | 'desc';

const EMPTY_FORM: LandlordForm = {
  full_name: '',
  mobile: '',
  email: '',
  company_name: '',
  notes: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function LandlordsClient() {
  const supabase = createClient();
  const { role } = useRole();

  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('full_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LandlordForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchLandlords = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('landlords')
        .select('*')
        .order(sortKey, { ascending: sortDir === 'asc' });

      if (fetchError) {
        // Table may not exist yet — show empty state gracefully
        setLandlords([]);
      } else {
        setLandlords(data || []);
      }
    } catch {
      setLandlords([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, sortKey, sortDir]);

  useEffect(() => {
    fetchLandlords();
  }, [fetchLandlords]);

  // ─── Filtered list ──────────────────────────────────────────────────────────

  const filtered = landlords.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.full_name?.toLowerCase().includes(q) ||
      l.company_name?.toLowerCase().includes(q) ||
      l.mobile?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q)
    );
  });

  // ─── Sort toggle ────────────────────────────────────────────────────────────

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // ─── Modal helpers ──────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (l: Landlord) => {
    setEditingId(l.id);
    setForm({
      full_name: l.full_name,
      mobile: l.mobile || '',
      email: l.email || '',
      company_name: l.company_name || '',
      notes: l.notes || '',
    });
    setError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  // ─── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      setError('Full name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        mobile: form.mobile.trim() || null,
        email: form.email.trim() || null,
        company_name: form.company_name.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (editingId) {
        const { error: updateError } = await supabase
          .from('landlords')
          .update(payload)
          .eq('id', editingId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('landlords')
          .insert(payload);
        if (insertError) throw insertError;
      }
      closeModal();
      fetchLandlords();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save landlord.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('landlords').delete().eq('id', id);
      setDeleteConfirm(null);
      fetchLandlords();
    } catch {
      // silently ignore
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <Icon name="ChevronsUpDownIcon" size={13} className="text-[hsl(215,15%,65%)]" />;
    return sortDir === 'asc'
      ? <Icon name="ChevronUpIcon" size={13} className="text-[#8B1A2B]" />
      : <Icon name="ChevronDownIcon" size={13} className="text-[#8B1A2B]" />;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(214,20%,88%)] bg-white flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Landlords</h1>
          <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">Property owners and portfolio contacts</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-[#8B1A2B] hover:bg-[#7a1626] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Icon name="PlusIcon" size={16} />
          Add Landlord
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-[hsl(214,20%,88%)] flex-shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Icon name="SearchIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
          <input
            type="text"
            placeholder="Search landlords…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B]"
          />
        </div>
        <span className="text-sm text-[hsl(215,15%,52%)]">
          {filtered.length} {filtered.length === 1 ? 'landlord' : 'landlords'}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-[#8B1A2B] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="w-14 h-14 rounded-full bg-[hsl(210,15%,94%)] flex items-center justify-center mb-3">
              <Icon name="UserIcon" size={24} className="text-[hsl(215,15%,52%)]" />
            </div>
            <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">No landlords found</p>
            <p className="text-xs text-[hsl(215,15%,52%)] mt-1">
              {search ? 'Try a different search term.' : 'Add your first landlord to get started.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[hsl(210,15%,97%)] border-b border-[hsl(214,20%,88%)]">
                  <th className="text-left px-4 py-3 font-semibold text-[hsl(215,15%,40%)]">
                    <button className="flex items-center gap-1.5" onClick={() => handleSort('full_name')}>
                      Name <SortIcon col="full_name" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[hsl(215,15%,40%)]">
                    <button className="flex items-center gap-1.5" onClick={() => handleSort('company_name')}>
                      Company <SortIcon col="company_name" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[hsl(215,15%,40%)]">
                    <button className="flex items-center gap-1.5" onClick={() => handleSort('mobile')}>
                      Mobile <SortIcon col="mobile" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[hsl(215,15%,40%)]">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-[hsl(215,15%,40%)]">Notes</th>
                  <th className="text-left px-4 py-3 font-semibold text-[hsl(215,15%,40%)]">
                    <button className="flex items-center gap-1.5" onClick={() => handleSort('created_at')}>
                      Added <SortIcon col="created_at" />
                    </button>
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, idx) => (
                  <tr
                    key={l.id}
                    className={`border-b border-[hsl(214,20%,92%)] hover:bg-[hsl(210,15%,98%)] transition-colors ${idx % 2 === 0 ? '' : 'bg-[hsl(210,15%,99%)]'}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#8B1A2B]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-[#8B1A2B]">
                            {l.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </span>
                        </div>
                        <span className="font-medium text-[hsl(215,25%,18%)]">{l.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[hsl(215,15%,40%)]">{l.company_name || <span className="text-[hsl(215,15%,65%)]">—</span>}</td>
                    <td className="px-4 py-3 text-[hsl(215,15%,40%)]">{l.mobile || <span className="text-[hsl(215,15%,65%)]">—</span>}</td>
                    <td className="px-4 py-3 text-[hsl(215,15%,40%)]">{l.email || <span className="text-[hsl(215,15%,65%)]">—</span>}</td>
                    <td className="px-4 py-3 text-[hsl(215,15%,40%)] max-w-[200px]">
                      {l.notes ? (
                        <span className="truncate block" title={l.notes}>{l.notes}</span>
                      ) : (
                        <span className="text-[hsl(215,15%,65%)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[hsl(215,15%,52%)] whitespace-nowrap">
                      {new Date(l.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(l)}
                          className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)] transition-colors"
                          title="Edit"
                        >
                          <Icon name="PencilIcon" size={14} />
                        </button>
                        {(role === 'admin' || role === 'manager') && (
                          deleteConfirm === l.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(l.id)}
                                className="px-2 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-1 text-xs bg-[hsl(210,15%,94%)] text-[hsl(215,25%,18%)] rounded-md hover:bg-[hsl(210,15%,88%)] transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(l.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-[hsl(215,15%,52%)] hover:text-red-600 transition-colors"
                              title="Delete"
                            >
                              <Icon name="Trash2Icon" size={14} />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(214,20%,88%)]">
              <h2 className="text-base font-bold text-[hsl(215,25%,18%)]">
                {editingId ? 'Edit Landlord' : 'Add Landlord'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors">
                <Icon name="XIcon" size={16} className="text-[hsl(215,15%,52%)]" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                  <Icon name="AlertCircleIcon" size={14} />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[hsl(215,15%,40%)] mb-1.5">Full Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder="e.g. John Smith"
                  className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[hsl(215,15%,40%)] mb-1.5">Company Name</label>
                <input
                  type="text"
                  value={form.company_name}
                  onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                  placeholder="e.g. Smith Properties Ltd"
                  className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[hsl(215,15%,40%)] mb-1.5">Mobile</label>
                  <input
                    type="tel"
                    value={form.mobile}
                    onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                    placeholder="+852 9XXX XXXX"
                    className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[hsl(215,15%,40%)] mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="john@example.com"
                    className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[hsl(215,15%,40%)] mb-1.5">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional notes about this landlord…"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20 focus:border-[#8B1A2B] resize-none"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[hsl(214,20%,88%)]">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-[hsl(215,25%,18%)] bg-[hsl(210,15%,94%)] hover:bg-[hsl(210,15%,88%)] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#8B1A2B] hover:bg-[#7a1626] rounded-lg transition-colors disabled:opacity-60"
              >
                {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {editingId ? 'Save Changes' : 'Add Landlord'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
