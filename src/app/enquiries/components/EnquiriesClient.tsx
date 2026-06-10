'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import EmailComposer from './EmailComposer';
import { useRole } from '@/hooks/useRole';

// ─── Types ────────────────────────────────────────────────────────────────────

type FollowUpStatus = 'pending' | 'replied' | 'closed';

interface Agent {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface Enquiry {
  id: string;
  visitor_name: string;
  visitor_email: string;
  visitor_phone: string | null;
  message: string;
  property_ref: string | null;
  property_id: string | null;
  is_read: boolean;
  assigned_agent_id: string | null;
  follow_up_status: FollowUpStatus | null;
  created_at: string;
  properties?: {
    address: string | null;
    listing_type: string | null;
    asking_price: number | null;
    monthly_rent: number | null;
  } | null;
  assigned_agent?: {
    full_name: string;
    email: string;
  } | null;
}

type StatusFilter = 'all' | 'unread' | 'read';
type FollowUpFilter = 'all' | 'pending' | 'replied' | 'closed';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-HK', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatPrice(price: number | null, type: string | null) {
  if (!price) return null;
  if (type === 'for-rent') return `HK$${price.toLocaleString()}/mo`;
  return `HK$${price.toLocaleString()}`;
}

const FOLLOW_UP_CONFIG: Record<FollowUpStatus, { label: string; bg: string; text: string; dot: string }> = {
  pending: {
    label: 'Pending',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
  },
  replied: {
    label: 'Replied',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
  },
  closed: {
    label: 'Closed',
    bg: 'bg-green-50',
    text: 'text-green-700',
    dot: 'bg-green-500',
  },
};

function FollowUpBadge({ status }: { status: FollowUpStatus | null }) {
  const s = status ?? 'pending';
  const cfg = FOLLOW_UP_CONFIG[s];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EnquiriesClient() {
  const supabase = createClient();

  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Enquiry | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const { isAdminOrManager } = useRole();

  // ── Fetch agents ───────────────────────────────────────────────────────────

  const fetchAgents = useCallback(async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, role')
      .eq('is_active', true)
      .order('full_name');
    if (data) setAgents(data as Agent[]);
  }, [supabase]);

  // ── Fetch enquiries ────────────────────────────────────────────────────────

  const fetchEnquiries = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('enquiries')
      .select(`
        id, visitor_name, visitor_email, visitor_phone,
        message, property_ref, property_id, is_read,
        assigned_agent_id, follow_up_status, created_at,
        properties ( address, listing_type, asking_price, monthly_rent ),
        assigned_agent:user_profiles!enquiries_assigned_agent_id_fkey ( full_name, email )
      `)
      .order('created_at', { ascending: false });

    if (err) {
      setError('Failed to load enquiries. Please try again.');
    } else {
      setEnquiries((data as Enquiry[]) ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchEnquiries();
    fetchAgents();
  }, [fetchEnquiries, fetchAgents]);

  // ── Realtime subscription ──────────────────────────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel('enquiries-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'enquiries' },
        async (payload) => {
          // Fetch the full enquiry with relations
          const { data } = await supabase
            .from('enquiries')
            .select(`
              id, visitor_name, visitor_email, visitor_phone,
              message, property_ref, property_id, is_read,
              assigned_agent_id, follow_up_status, created_at,
              properties ( address, listing_type, asking_price, monthly_rent ),
              assigned_agent:user_profiles!enquiries_assigned_agent_id_fkey ( full_name, email )
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setEnquiries((prev) => [data as Enquiry, ...prev]);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'enquiries' },
        async (payload) => {
          const updatedId = payload.new.id as string;

          // Fetch the full updated enquiry with relations
          const { data } = await supabase
            .from('enquiries')
            .select(`
              id, visitor_name, visitor_email, visitor_phone,
              message, property_ref, property_id, is_read,
              assigned_agent_id, follow_up_status, created_at,
              properties ( address, listing_type, asking_price, monthly_rent ),
              assigned_agent:user_profiles!enquiries_assigned_agent_id_fkey ( full_name, email )
            `)
            .eq('id', updatedId)
            .single();

          if (data) {
            const updated = data as Enquiry;
            setEnquiries((prev) =>
              prev.map((q) => (q.id === updatedId ? updated : q))
            );
            setSelected((prev) => (prev?.id === updatedId ? updated : prev));
          }
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // ── Mark read/unread ───────────────────────────────────────────────────────

  const toggleRead = async (enquiry: Enquiry, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMarkingId(enquiry.id);
    const { error: err } = await supabase
      .from('enquiries')
      .update({ is_read: !enquiry.is_read })
      .eq('id', enquiry.id);

    if (!err) {
      setEnquiries((prev) =>
        prev.map((q) => (q.id === enquiry.id ? { ...q, is_read: !q.is_read } : q))
      );
      if (selected?.id === enquiry.id) {
        setSelected((prev) => prev ? { ...prev, is_read: !prev.is_read } : prev);
      }
    }
    setMarkingId(null);
  };

  // ── Assign agent ───────────────────────────────────────────────────────────

  const assignAgent = async (enquiryId: string, agentId: string | null, e?: React.ChangeEvent) => {
    e?.stopPropagation?.();
    setUpdatingId(enquiryId);
    const { error: err } = await supabase
      .from('enquiries')
      .update({ assigned_agent_id: agentId || null })
      .eq('id', enquiryId);

    if (!err) {
      const agent = agents.find((a) => a.id === agentId) ?? null;
      const patch = {
        assigned_agent_id: agentId || null,
        assigned_agent: agent ? { full_name: agent.full_name, email: agent.email } : null,
      };
      setEnquiries((prev) => prev.map((q) => (q.id === enquiryId ? { ...q, ...patch } : q)));
      if (selected?.id === enquiryId) setSelected((prev) => prev ? { ...prev, ...patch } : prev);
    }
    setUpdatingId(null);
  };

  // ── Update follow-up status ────────────────────────────────────────────────

  const updateFollowUpStatus = async (enquiryId: string, status: FollowUpStatus, e?: React.ChangeEvent) => {
    e?.stopPropagation?.();
    setUpdatingId(enquiryId);
    const { error: err } = await supabase
      .from('enquiries')
      .update({ follow_up_status: status })
      .eq('id', enquiryId);

    if (!err) {
      setEnquiries((prev) =>
        prev.map((q) => (q.id === enquiryId ? { ...q, follow_up_status: status } : q))
      );
      if (selected?.id === enquiryId) setSelected((prev) => prev ? { ...prev, follow_up_status: status } : prev);
    }
    setUpdatingId(null);
  };

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = enquiries.filter((q) => {
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'unread' && !q.is_read) ||
      (statusFilter === 'read' && q.is_read);

    const matchFollowUp =
      followUpFilter === 'all' || (q.follow_up_status ??'pending') === followUpFilter;

    const term = search.toLowerCase();
    const matchSearch =
      !term ||
      q.visitor_name.toLowerCase().includes(term) ||
      q.visitor_email.toLowerCase().includes(term) ||
      (q.visitor_phone ?? '').includes(term) ||
      (q.property_ref ?? '').toLowerCase().includes(term) ||
      q.message.toLowerCase().includes(term) ||
      (q.assigned_agent?.full_name ?? '').toLowerCase().includes(term);

    return matchStatus && matchFollowUp && matchSearch;
  });

  const unreadCount = enquiries.filter((q) => !q.is_read).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(215,25%,18%)]">Enquiries</h1>
          <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">
            Visitor enquiries from the Homes R Us website
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="inline-flex items-center gap-1.5 bg-[#8B1A2B]/10 text-[#8B1A2B] text-sm font-semibold px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-[#8B1A2B] animate-pulse" />
              {unreadCount} new
            </span>
          )}
          <span
            title={realtimeConnected ? 'Live updates active' : 'Connecting to live updates…'}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full border ${
              realtimeConnected
                ? 'bg-green-50 text-green-700 border-green-200' :'bg-gray-50 text-gray-500 border-gray-200'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                realtimeConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}
            />
            {realtimeConnected ? 'Live' : 'Connecting…'}
          </span>
          <button
            onClick={fetchEnquiries}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[hsl(214,20%,88%)] bg-white text-sm text-[hsl(215,25%,18%)] hover:bg-[hsl(210,15%,94%)] transition-colors"
          >
            <Icon name="RefreshCwIcon" size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Icon name="SearchIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(215,15%,52%)]" />
          <input
            type="text"
            placeholder="Search name, email, agent…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-9 text-sm w-full"
          />
        </div>

        {/* Read status pills */}
        <div className="flex items-center gap-1.5 bg-[hsl(210,15%,94%)] rounded-lg p-1">
          {(['all', 'unread', 'read'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors capitalize ${
                statusFilter === s
                  ? 'bg-white text-[#8B1A2B] shadow-sm'
                  : 'text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Follow-up status pills */}
        <div className="flex items-center gap-1.5 bg-[hsl(210,15%,94%)] rounded-lg p-1">
          {(['all', 'pending', 'replied', 'closed'] as FollowUpFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setFollowUpFilter(s)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors capitalize ${
                followUpFilter === s
                  ? 'bg-white text-[#8B1A2B] shadow-sm'
                  : 'text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3 text-[hsl(215,15%,52%)]">
            <Icon name="LoaderIcon" size={28} className="animate-spin text-[#8B1A2B]" />
            <span className="text-sm">Loading enquiries…</span>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3 text-center">
            <Icon name="AlertCircleIcon" size={32} className="text-red-400" />
            <p className="text-sm text-[hsl(215,15%,52%)]">{error}</p>
            <button onClick={fetchEnquiries} className="btn-primary text-sm px-4 py-2">
              Retry
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3 text-[hsl(215,15%,52%)]">
            <Icon name="InboxIcon" size={36} className="opacity-40" />
            <p className="text-sm">
              {search || statusFilter !== 'all' || followUpFilter !== 'all' ?'No enquiries match your filters.' :'No enquiries yet.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-5 items-start">
          {/* Table */}
          <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[hsl(214,20%,88%)] bg-[hsl(210,15%,97%)]">
                    <th className="text-left px-4 py-3 font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide text-xs">Visitor</th>
                    <th className="text-left px-4 py-3 font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide text-xs">Property</th>
                    <th className="text-left px-4 py-3 font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide text-xs">Assigned To</th>
                    <th className="text-left px-4 py-3 font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide text-xs">Follow-up</th>
                    <th className="text-left px-4 py-3 font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide text-xs">Date</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(214,20%,93%)]">
                  {filtered.map((q) => {
                    const isSelected = selected?.id === q.id;
                    const propLabel = q.properties?.address ?? q.property_ref ?? null;
                    const priceLabel = q.properties
                      ? formatPrice(
                          q.properties.listing_type === 'for-rent'
                            ? q.properties.monthly_rent
                            : q.properties.asking_price,
                          q.properties.listing_type
                        )
                      : null;

                    return (
                      <tr
                        key={q.id}
                        onClick={() => setSelected(isSelected ? null : q)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#8B1A2B]/5'
                            : q.is_read
                            ? 'hover:bg-[hsl(210,15%,97%)]'
                            : 'bg-[#F5EFE6]/60 hover:bg-[#F5EFE6]'
                        }`}
                      >
                        {/* Visitor */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {!q.is_read && (
                              <span className="w-2 h-2 rounded-full bg-[#8B1A2B] flex-shrink-0" />
                            )}
                            <div className={q.is_read ? 'ml-4' : ''}>
                              <p className={`font-medium text-[hsl(215,25%,18%)] ${!q.is_read ? 'font-semibold' : ''}`}>
                                {q.visitor_name}
                              </p>
                              <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">{q.visitor_email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Property */}
                        <td className="px-4 py-3">
                          {propLabel ? (
                            <div>
                              <p className="text-[hsl(215,25%,18%)] font-medium truncate max-w-[150px]">{propLabel}</p>
                              {priceLabel && (
                                <p className="text-xs text-[#8B1A2B] font-semibold mt-0.5">{priceLabel}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[hsl(215,15%,52%)] italic text-xs">General</span>
                          )}
                        </td>

                        {/* Assigned agent */}
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          {isAdminOrManager ? (
                          <select
                            value={q.assigned_agent_id ?? ''}
                            onChange={(e) => assignAgent(q.id, e.target.value, e as any)}
                            disabled={updatingId === q.id}
                            className="text-xs border border-[hsl(214,20%,88%)] rounded-lg px-2 py-1.5 bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-1 focus:ring-[#8B1A2B] disabled:opacity-50 max-w-[130px]"
                          >
                            <option value="">Unassigned</option>
                            {agents.map((a) => (
                              <option key={a.id} value={a.id}>{a.full_name}</option>
                            ))}
                          </select>
                          ) : (
                            <span className="text-xs text-[hsl(215,15%,52%)]">
                              {q.assigned_agent?.full_name ?? 'Unassigned'}
                            </span>
                          )}
                        </td>

                        {/* Follow-up status */}
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={q.follow_up_status ?? 'pending'}
                            onChange={(e) => updateFollowUpStatus(q.id, e.target.value as FollowUpStatus, e as any)}
                            disabled={updatingId === q.id}
                            className="text-xs border border-[hsl(214,20%,88%)] rounded-lg px-2 py-1.5 bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-1 focus:ring-[#8B1A2B] disabled:opacity-50"
                          >
                            <option value="pending">Pending</option>
                            <option value="replied">Replied</option>
                            <option value="closed">Closed</option>
                          </select>
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-[hsl(215,25%,18%)]">{formatDate(q.created_at)}</p>
                          <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">{formatTime(q.created_at)}</p>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => toggleRead(q, e)}
                            disabled={markingId === q.id}
                            title={q.is_read ? 'Mark as unread' : 'Mark as read'}
                            className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)] disabled:opacity-40"
                          >
                            <Icon name={q.is_read ? 'MailIcon' : 'MailOpenIcon'} size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 border-t border-[hsl(214,20%,88%)] bg-[hsl(210,15%,97%)]">
              <p className="text-xs text-[hsl(215,15%,52%)]">
                Showing {filtered.length} of {enquiries.length} enquiries
              </p>
            </div>
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden sticky top-4">
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(214,20%,88%)] bg-[hsl(210,15%,97%)]">
                <h2 className="font-semibold text-[hsl(215,25%,18%)] text-sm">Enquiry Detail</h2>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors text-[hsl(215,15%,52%)]"
                >
                  <Icon name="XIcon" size={16} />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Visitor info */}
                <div>
                  <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-2">Visitor Details</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-[#8B1A2B]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[#8B1A2B] font-bold text-sm">
                          {selected.visitor_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-[hsl(215,25%,18%)] text-sm">{selected.visitor_name}</p>
                        <p className="text-xs text-[hsl(215,15%,52%)]">{formatDate(selected.created_at)} · {formatTime(selected.created_at)}</p>
                      </div>
                    </div>

                    <a
                      href={`mailto:${selected.visitor_email}`}
                      className="flex items-center gap-2 text-sm text-[#8B1A2B] hover:underline"
                    >
                      <Icon name="MailIcon" size={14} />
                      {selected.visitor_email}
                    </a>

                    {selected.visitor_phone && (
                      <a
                        href={`tel:${selected.visitor_phone}`}
                        className="flex items-center gap-2 text-sm text-[hsl(215,25%,18%)] hover:text-[#8B1A2B] transition-colors"
                      >
                        <Icon name="PhoneIcon" size={14} className="text-[hsl(215,15%,52%)]" />
                        {selected.visitor_phone}
                      </a>
                    )}
                  </div>
                </div>

                {/* Property interest */}
                {(selected.properties?.address || selected.property_ref) && (
                  <div>
                    <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-2">Property Interest</p>
                    <div className="bg-[#F5EFE6] rounded-lg p-3 space-y-1.5">
                      <p className="text-sm font-medium text-[hsl(215,25%,18%)]">
                        {selected.properties?.address ?? selected.property_ref}
                      </p>
                      {selected.properties?.listing_type && (
                        <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-[#8B1A2B]/10 text-[#8B1A2B] capitalize">
                          {selected.properties.listing_type.replace(/-/g, ' ')}
                        </span>
                      )}
                      {selected.properties && (
                        <p className="text-sm font-semibold text-[#8B1A2B]">
                          {formatPrice(
                            selected.properties.listing_type === 'for-rent'
                              ? selected.properties.monthly_rent
                              : selected.properties.asking_price,
                            selected.properties.listing_type
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Message */}
                <div>
                  <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-2">Message</p>
                  <p className="text-sm text-[hsl(215,25%,18%)] leading-relaxed bg-[hsl(210,15%,97%)] rounded-lg p-3 border border-[hsl(214,20%,88%)]">
                    {selected.message}
                  </p>
                </div>

                {/* Assignment & Follow-up */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Assignment & Follow-up</p>

                  {/* Assign agent */}
                  <div>
                    <label className="block text-xs text-[hsl(215,15%,52%)] mb-1.5 font-medium">
                      <Icon name="UserIcon" size={12} className="inline mr-1" />
                      Assigned Agent
                    </label>
                    <select
                      value={selected.assigned_agent_id ?? ''}
                      onChange={(e) => assignAgent(selected.id, e.target.value)}
                      disabled={updatingId === selected.id}
                      className="w-full text-sm border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/30 focus:border-[#8B1A2B] disabled:opacity-50"
                    >
                      <option value="">— Unassigned —</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.full_name} {a.role !== 'agent' ? `(${a.role})` : ''}
                        </option>
                      ))}
                    </select>
                    {selected.assigned_agent && (
                      <p className="text-xs text-[hsl(215,15%,52%)] mt-1">
                        {selected.assigned_agent.email}
                      </p>
                    )}
                  </div>

                  {/* Follow-up status */}
                  <div>
                    <label className="block text-xs text-[hsl(215,15%,52%)] mb-1.5 font-medium">
                      <Icon name="ClipboardListIcon" size={12} className="inline mr-1" />
                      Follow-up Status
                    </label>
                    <div className="flex items-center gap-2">
                      {(['pending', 'replied', 'closed'] as FollowUpStatus[]).map((s) => {
                        const cfg = FOLLOW_UP_CONFIG[s];
                        const isActive = (selected.follow_up_status ?? 'pending') === s;
                        return (
                          <button
                            key={s}
                            onClick={() => updateFollowUpStatus(selected.id, s)}
                            disabled={updatingId === selected.id}
                            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all border disabled:opacity-50 ${
                              isActive
                                ? `${cfg.bg} ${cfg.text} border-current`
                                : 'bg-white text-[hsl(215,15%,52%)] border-[hsl(214,20%,88%)] hover:bg-[hsl(210,15%,97%)]'
                            }`}
                          >
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Read status + action */}
                <div className="flex items-center justify-between pt-1">
                  <FollowUpBadge status={selected.follow_up_status} />
                  <button
                    onClick={() => toggleRead(selected)}
                    disabled={markingId === selected.id}
                    className="flex items-center gap-1.5 text-xs font-medium text-[hsl(215,15%,52%)] hover:text-[#8B1A2B] transition-colors disabled:opacity-40"
                  >
                    <Icon name={selected.is_read ? 'MailIcon' : 'MailOpenIcon'} size={13} />
                    {selected.is_read ? 'Mark as unread' : 'Mark as read'}
                  </button>
                </div>

                {/* Email composer */}
                <EmailComposer
                  visitorName={selected.visitor_name}
                  visitorEmail={selected.visitor_email}
                  propertyRef={selected.property_ref}
                  propertyAddress={selected.properties?.address}
                  onEmailSent={() => updateFollowUpStatus(selected.id, 'replied')}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}