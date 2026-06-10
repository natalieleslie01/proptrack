'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import KeyEntryModal, { KeyLogEntry } from './KeyEntryModal';

const STATUS_STYLES: Record<string, string> = {
  held:     'bg-amber-50 text-amber-700 border border-amber-200',
  returned: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  missing:  'bg-red-50 text-red-700 border border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
  held:     'Held',
  returned: 'Returned',
  missing:  'Missing',
};

export default function KeyLog() {
  const [entries, setEntries] = useState<KeyLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'held' | 'returned' | 'missing'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<KeyLogEntry | null>(null);

  const fetchEntries = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('key_log')
      .select('id, property_label, property_ref, key_number, key_type, held_by, collected_date, returned_date, status, notes')
      .order('collected_date', { ascending: false })
      .limit(50);
    setEntries((data as KeyLogEntry[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const openNew = () => {
    setEditEntry(null);
    setModalOpen(true);
  };

  const openEdit = (entry: KeyLogEntry) => {
    setEditEntry(entry);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setLoading(true);
    fetchEntries();
  };

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.status === filter);
  const heldCount    = entries.filter((e) => e.status === 'held').length;
  const missingCount = entries.filter((e) => e.status === 'missing').length;

  return (
    <>
      <div className="card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[hsl(214,20%,88%)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1B4F8A]/10 flex items-center justify-center">
              <Icon name="KeyIcon" size={14} className="text-[#1B4F8A]" />
            </div>
            <h2 className="text-sm font-semibold text-[hsl(215,25%,18%)]">Key Log</h2>
          </div>
          <div className="flex items-center gap-2">
            {missingCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                {missingCount} missing
              </span>
            )}
            <span className="text-xs text-[hsl(215,15%,52%)]">{heldCount} held</span>
            <button
              onClick={openNew}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1B4F8A] text-white text-[11px] font-semibold hover:bg-[#163f6e] transition-colors"
            >
              <Icon name="PlusIcon" size={12} />
              Log Movement
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-1">
          {(['all', 'held', 'returned', 'missing'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors capitalize ${
                filter === tab
                  ? 'bg-[#1B4F8A] text-white'
                  : 'text-[hsl(215,15%,52%)] hover:bg-[hsl(210,15%,96%)]'
              }`}
            >
              {tab === 'all' ? `All (${entries.length})` : `${STATUS_LABELS[tab]} (${entries.filter((e) => e.status === tab).length})`}
            </button>
          ))}
        </div>

        {/* Entries */}
        <div className="divide-y divide-[hsl(214,20%,92%)] max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#1B4F8A] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Icon name="KeyIcon" size={24} className="text-[hsl(215,15%,72%)]" />
              <p className="text-xs text-[hsl(215,15%,52%)]">No key log entries</p>
              <button
                onClick={openNew}
                className="text-[11px] text-[#1B4F8A] font-medium hover:underline"
              >
                Record the first movement
              </button>
            </div>
          ) : (
            filtered.map((entry) => (
              <div
                key={entry.id}
                onClick={() => openEdit(entry)}
                className="flex items-start gap-3 px-4 py-3 hover:bg-[hsl(210,15%,97%)] transition-colors cursor-pointer group"
              >
                <div className="w-7 h-7 rounded-full bg-[#1B4F8A]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon name="KeyIcon" size={13} className="text-[#1B4F8A]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-[hsl(215,25%,18%)] leading-snug truncate">
                      {entry.property_label}
                    </p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${STATUS_STYLES[entry.status]}`}>
                        {STATUS_LABELS[entry.status]}
                      </span>
                      <Icon name="PencilSquareIcon" size={11} className="text-[hsl(215,15%,65%)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {entry.key_number && (
                      <span className="text-[10px] text-[hsl(215,15%,52%)]">#{entry.key_number}</span>
                    )}
                    <span className="text-[10px] text-[hsl(215,15%,52%)]">{entry.key_type}</span>
                    {entry.held_by && (
                      <span className="text-[10px] text-[hsl(215,15%,52%)]">· {entry.held_by}</span>
                    )}
                    {entry.collected_date && (
                      <span className="text-[10px] text-[hsl(215,15%,52%)]">
                        · {new Date(entry.collected_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {' '}
                        {new Date(entry.collected_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  {entry.notes && (
                    <p className="text-[10px] text-[hsl(215,15%,62%)] mt-0.5 italic truncate">{entry.notes}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <KeyEntryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        editEntry={editEntry}
      />
    </>
  );
}
