'use client';
import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

interface KeyEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editEntry?: KeyLogEntry | null;
}

export interface KeyLogEntry {
  id: string;
  property_label: string;
  property_ref: string | null;
  key_number: string | null;
  key_type: string;
  held_by: string | null;
  collected_date: string | null;
  returned_date: string | null;
  status: 'held' | 'returned' | 'missing';
  notes: string | null;
}

const KEY_TYPES = ['Master Key', 'Front Door', 'Back Door', 'Mailbox', 'Garage', 'Pool Gate', 'Other'];

function nowLocalISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function KeyEntryModal({ isOpen, onClose, onSaved, editEntry }: KeyEntryModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    property_label: '',
    property_ref: '',
    key_number: '',
    key_type: 'Front Door',
    held_by: '',
    collected_date: nowLocalISO(),
    returned_date: '',
    status: 'held\' as \'held\' | \'returned\' | \'missing',
    notes: '',
  });

  useEffect(() => {
    if (editEntry) {
      setForm({
        property_label: editEntry.property_label ?? '',
        property_ref: editEntry.property_ref ?? '',
        key_number: editEntry.key_number ?? '',
        key_type: editEntry.key_type ?? 'Front Door',
        held_by: editEntry.held_by ?? '',
        collected_date: editEntry.collected_date
          ? editEntry.collected_date.slice(0, 16)
          : nowLocalISO(),
        returned_date: editEntry.returned_date
          ? editEntry.returned_date.slice(0, 16)
          : '',
        status: editEntry.status ?? 'held',
        notes: editEntry.notes ?? '',
      });
    } else {
      setForm({
        property_label: '',
        property_ref: '',
        key_number: '',
        key_type: 'Front Door',
        held_by: '',
        collected_date: nowLocalISO(),
        returned_date: '',
        status: 'held',
        notes: '',
      });
    }
    setError(null);
  }, [editEntry, isOpen]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'status' && value === 'returned' && !form.returned_date) {
      setForm((prev) => ({ ...prev, [field]: value, returned_date: nowLocalISO() }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.property_label.trim()) {
      setError('Property label is required.');
      return;
    }
    if (!form.held_by.trim() && form.status !== 'returned') {
      setError('Please enter who collected the key.');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      property_label: form.property_label.trim(),
      property_ref: form.property_ref.trim() || null,
      key_number: form.key_number.trim() || null,
      key_type: form.key_type,
      held_by: form.held_by.trim() || null,
      collected_date: form.collected_date || null,
      returned_date: form.returned_date || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };

    const supabase = createClient();
    const { error: err } = editEntry
      ? await supabase.from('key_log').update(payload).eq('id', editEntry.id)
      : await supabase.from('key_log').insert([payload]);

    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSaved();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(214,20%,88%)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#1B4F8A]/10 flex items-center justify-center">
              <Icon name="KeyIcon" size={16} className="text-[#1B4F8A]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[hsl(215,25%,18%)]">
                {editEntry ? 'Edit Key Entry' : 'Record Key Movement'}
              </h2>
              <p className="text-[11px] text-[hsl(215,15%,52%)]">
                {editEntry ? 'Update key log details' : 'Log a check-out or return'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[hsl(215,15%,52%)] hover:bg-[hsl(210,15%,95%)] transition-colors"
          >
            <Icon name="XMarkIcon" size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Status toggle */}
          <div>
            <label className="block text-[11px] font-semibold text-[hsl(215,15%,40%)] uppercase tracking-wide mb-1.5">
              Action
            </label>
            <div className="flex gap-2">
              {(['held', 'returned', 'missing'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleChange('status', s)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all capitalize ${
                    form.status === s
                      ? s === 'held' ?'bg-amber-500 text-white border-amber-500'
                        : s === 'returned' ?'bg-emerald-500 text-white border-emerald-500' :'bg-red-500 text-white border-red-500' :'bg-white text-[hsl(215,15%,52%)] border-[hsl(214,20%,88%)] hover:bg-[hsl(210,15%,96%)]'
                  }`}
                >
                  {s === 'held' ? '🔑 Check-Out' : s === 'returned' ? '✅ Return' : '⚠️ Missing'}
                </button>
              ))}
            </div>
          </div>

          {/* Property */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-[hsl(215,15%,40%)] uppercase tracking-wide mb-1">
                Destination Property <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.property_label}
                onChange={(e) => handleChange('property_label', e.target.value)}
                placeholder="e.g. 12A Seabee Lane, Discovery Bay"
                className="w-full px-3 py-2 text-xs border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 focus:border-[#1B4F8A] placeholder-[hsl(215,15%,70%)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[hsl(215,15%,40%)] uppercase tracking-wide mb-1">
                Property Ref
              </label>
              <input
                type="text"
                value={form.property_ref}
                onChange={(e) => handleChange('property_ref', e.target.value)}
                placeholder="e.g. DB-001"
                className="w-full px-3 py-2 text-xs border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 focus:border-[#1B4F8A] placeholder-[hsl(215,15%,70%)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[hsl(215,15%,40%)] uppercase tracking-wide mb-1">
                Key Number
              </label>
              <input
                type="text"
                value={form.key_number}
                onChange={(e) => handleChange('key_number', e.target.value)}
                placeholder="e.g. K-042"
                className="w-full px-3 py-2 text-xs border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 focus:border-[#1B4F8A] placeholder-[hsl(215,15%,70%)]"
              />
            </div>
          </div>

          {/* Key type */}
          <div>
            <label className="block text-[11px] font-semibold text-[hsl(215,15%,40%)] uppercase tracking-wide mb-1">
              Key Type
            </label>
            <select
              value={form.key_type}
              onChange={(e) => handleChange('key_type', e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 focus:border-[#1B4F8A] bg-white"
            >
              {KEY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Collected by */}
          <div>
            <label className="block text-[11px] font-semibold text-[hsl(215,15%,40%)] uppercase tracking-wide mb-1">
              Collected By {form.status !== 'returned' && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              value={form.held_by}
              onChange={(e) => handleChange('held_by', e.target.value)}
              placeholder="Name of person collecting the key"
              className="w-full px-3 py-2 text-xs border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 focus:border-[#1B4F8A] placeholder-[hsl(215,15%,70%)]"
            />
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[hsl(215,15%,40%)] uppercase tracking-wide mb-1">
                Check-Out Time
              </label>
              <input
                type="datetime-local"
                value={form.collected_date}
                onChange={(e) => handleChange('collected_date', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 focus:border-[#1B4F8A]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[hsl(215,15%,40%)] uppercase tracking-wide mb-1">
                Return Time
              </label>
              <input
                type="datetime-local"
                value={form.returned_date}
                onChange={(e) => handleChange('returned_date', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 focus:border-[#1B4F8A]"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-semibold text-[hsl(215,15%,40%)] uppercase tracking-wide mb-1">
              Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Any additional details..."
              rows={2}
              className="w-full px-3 py-2 text-xs border border-[hsl(214,20%,88%)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 focus:border-[#1B4F8A] placeholder-[hsl(215,15%,70%)] resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <Icon name="ExclamationCircleIcon" size={14} className="text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold border border-[hsl(214,20%,88%)] text-[hsl(215,15%,40%)] hover:bg-[hsl(210,15%,96%)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-[#1B4F8A] text-white hover:bg-[#163f6e] transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Icon name="CheckIcon" size={13} />
                  {editEntry ? 'Update Entry' : 'Record Movement'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
