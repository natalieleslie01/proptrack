'use client';

import React, { useState, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';
import AppLayout from '@/components/AppLayout';
import { mockProperties } from '@/app/property-management/components/mockData';
import { toast } from 'sonner';
import { useRole } from '@/hooks/useRole';
import { useCallback } from 'react';
import { useLeaseRenewalsRealtime, RealtimeEvent } from '@/hooks/useRealtimeSync';

type RenewalStatus = 'pending' | 'negotiating' | 'agreed' | 'documents_sent' | 'signed' | 'declined';

interface LeaseRenewal {
  id: string;
  propertyRef: string;
  propertyAddress: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
  landlordName: string;
  currentLeaseEnd: string;
  daysRemaining: number;
  currentRent: number;
  proposedNewRent: number;
  agreedNewRent?: number;
  newLeaseStart?: string;
  newLeaseEnd?: string;
  status: RenewalStatus;
  assignedAgent: string;
  notes: string;
}

const STATUS_CONFIG: Record<RenewalStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#d97706', bg: '#fffbeb' },
  negotiating: { label: 'Negotiating', color: '#2563eb', bg: '#eff6ff' },
  agreed: { label: 'Agreed', color: '#059669', bg: '#f0fdf4' },
  documents_sent: { label: 'Docs Sent', color: '#7c3aed', bg: '#f5f3ff' },
  signed: { label: 'Signed', color: '#0d9488', bg: '#f0fdfa' },
  declined: { label: 'Declined', color: '#dc2626', bg: '#fef2f2' },
};

function getDaysRemaining(leaseEnd: string): number {
  try {
    const [d, m, y] = leaseEnd.split('/').map(Number);
    const end = new Date(y, m - 1, d);
    const now = new Date();
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return 999;
  }
}

function buildRenewals(): LeaseRenewal[] {
  const agents = ['Alice Tam', 'Marcus Wong', 'Sophia Liu', 'David Cheung', 'Rachel Chan'];
  return mockProperties
    .filter((p) => p.tenant && p.tenant.leaseEnd)
    .map((p, i) => {
      const days = getDaysRemaining(p.tenant!.leaseEnd);
      const rent = p.monthlyRent ?? 18000;
      const statuses: RenewalStatus[] = ['pending', 'negotiating', 'agreed', 'documents_sent', 'signed', 'declined'];
      const status = days < 0 ? 'declined' : days < 30 ? 'negotiating' : days < 90 ? 'pending' : 'agreed';
      return {
        id: p.id,
        propertyRef: p.id,
        propertyAddress: `${p.unit}, ${p.building}`,
        tenantName: p.tenant!.name,
        tenantEmail: p.tenant!.email,
        tenantPhone: p.tenant!.phone,
        landlordName: p.landlord.name,
        currentLeaseEnd: p.tenant!.leaseEnd,
        daysRemaining: days,
        currentRent: rent,
        proposedNewRent: Math.round(rent * 1.05 / 100) * 100,
        agreedNewRent: status === 'agreed' || status === 'signed' ? Math.round(rent * 1.03 / 100) * 100 : undefined,
        status: status as RenewalStatus,
        assignedAgent: agents[i % agents.length],
        notes: '',
      };
    })
    .filter((r) => r.daysRemaining < 180)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 20);
}

export default function LeaseRenewalClient() {
  const [renewals, setRenewals] = useState<LeaseRenewal[]>(buildRenewals);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selected, setSelected] = useState<LeaseRenewal | null>(null);
  const { isAdminOrManager } = useRole();
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<RenewalStatus>('pending');
  const [editAgreedRent, setEditAgreedRent] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // ── Realtime sync — notify when another window changes lease renewal data ──
  useLeaseRenewalsRealtime(
    useCallback((event: RealtimeEvent, row: Record<string, unknown>) => {
      if (event === 'INSERT') {
        toast.info(`New lease renewal record added`, { id: `lease-insert-${row.id}` });
      } else if (event === 'UPDATE') {
        toast.info(`Lease renewal updated: ${(row.property_ref as string) ?? 'unknown property'}`, { id: `lease-update-${row.id}` });
        setRenewals((prev) =>
          prev.map((r) =>
            r.id === (row.id as string)
              ? {
                  ...r,
                  status: (row.status as RenewalStatus) ?? r.status,
                  notes: (row.notes as string) ?? r.notes,
                  agreedNewRent: (row.agreed_new_rent as number) ?? r.agreedNewRent,
                }
              : r
          )
        );
      } else if (event === 'DELETE') {
        toast.warning(`Lease renewal record removed`, { id: `lease-delete-${row.id}` });
        setRenewals((prev) => prev.filter((r) => r.id !== (row.id as string)));
      }
    }, [])
  );

  const filtered = useMemo(() => {
    if (filterStatus === 'all') return renewals;
    return renewals.filter((r) => r.status === filterStatus);
  }, [renewals, filterStatus]);

  function openDetail(r: LeaseRenewal) {
    setSelected(r);
    setEditNotes(r.notes);
    setEditStatus(r.status);
    setEditAgreedRent(r.agreedNewRent?.toString() ?? '');
  }

  function saveChanges() {
    if (!selected) return;
    setRenewals((prev) =>
      prev.map((r) =>
        r.id === selected.id
          ? { ...r, notes: editNotes, status: editStatus, agreedNewRent: editAgreedRent ? Number(editAgreedRent) : undefined }
          : r
      )
    );
    setSelected(null);
    toast.success('Renewal record updated');
  }

  async function sendLeaseExpiryEmail(r: LeaseRenewal) {
    setSendingEmail(true);
    try {
      const res = await fetch('/api/send-lease-expiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantName: r.tenantName,
          tenantEmail: r.tenantEmail,
          propertyAddress: r.propertyAddress,
          propertyRef: r.propertyRef,
          leaseEndDate: r.currentLeaseEnd,
          daysRemaining: r.daysRemaining,
          agentName: r.assignedAgent,
        }),
      });
      if (res.ok) toast.success(`Lease expiry notice sent to ${r.tenantName}`);
      else toast.error('Failed to send email');
    } catch {
      toast.error('Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  }

  const urgencyBadge = (days: number) => {
    if (days < 0) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Expired</span>;
    if (days <= 30) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Critical</span>;
    if (days <= 60) return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">Urgent</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">Upcoming</span>;
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Lease Renewals</h1>
            <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">Track and manage expiring tenancies and renewal negotiations</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(['all', 'pending', 'negotiating', 'agreed', 'documents_sent', 'signed', 'declined'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filterStatus === s
                    ? 'bg-[#8B1A2B] text-white'
                    : 'bg-white border border-[hsl(214,20%,88%)] text-[hsl(215,15%,52%)] hover:bg-[hsl(210,15%,94%)]'
                }`}
              >
                {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
                {s !== 'all' && (
                  <span className="ml-1.5 opacity-70">{renewals.filter((r) => r.status === s).length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Expiring < 30 days', count: renewals.filter((r) => r.daysRemaining >= 0 && r.daysRemaining <= 30).length, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'Expiring 30–60 days', count: renewals.filter((r) => r.daysRemaining > 30 && r.daysRemaining <= 60).length, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Renewals Agreed', count: renewals.filter((r) => r.status === 'agreed' || r.status === 'signed').length, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Pending Action', count: renewals.filter((r) => r.status === 'pending').length, color: 'text-blue-600', bg: 'bg-blue-50' },
          ].map((card) => (
            <div key={card.label} className={`${card.bg} rounded-xl p-4`}>
              <p className={`text-2xl font-bold ${card.color}`}>{card.count}</p>
              <p className="text-xs text-[hsl(215,15%,52%)] mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[hsl(210,20%,97%)] border-b border-[hsl(214,20%,88%)]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Property</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hidden sm:table-cell">Tenant</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Lease End</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hidden md:table-cell">Urgency</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hidden lg:table-cell">Current Rent</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide hidden md:table-cell">Agent</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(214,20%,88%)]">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-[hsl(215,15%,52%)]">No renewals found</td>
                  </tr>
                )}
                {filtered.map((r) => {
                  const sc = STATUS_CONFIG[r.status];
                  return (
                    <tr key={r.id} className="hover:bg-[hsl(210,20%,97%)] transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[hsl(215,25%,18%)] text-xs">{r.propertyAddress}</p>
                        <p className="text-xs text-[hsl(215,15%,52%)]">{r.propertyRef.slice(0, 8)}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <p className="font-medium text-[hsl(215,25%,18%)] text-xs">{r.tenantName}</p>
                        <p className="text-xs text-[hsl(215,15%,52%)]">{r.tenantPhone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-[hsl(215,25%,18%)]">{r.currentLeaseEnd}</p>
                        <p className="text-xs text-[hsl(215,15%,52%)]">{r.daysRemaining > 0 ? `${r.daysRemaining}d left` : 'Expired'}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">{urgencyBadge(r.daysRemaining)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <p className="text-xs font-semibold text-[hsl(215,25%,18%)]">HK${r.currentRent.toLocaleString()}</p>
                        <p className="text-xs text-[hsl(215,15%,52%)]">Proposed: HK${r.proposedNewRent.toLocaleString()}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color: sc.color, background: sc.bg }}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-xs text-[hsl(215,25%,18%)]">{r.assignedAgent}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => isAdminOrManager ? openDetail(r) : toast.error('Managers and Admins can edit lease renewals')}
                            className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
                            title={isAdminOrManager ? 'Edit renewal' : 'Edit requires Manager or Admin role'}
                          >
                            <Icon name="PencilIcon" size={14} className={isAdminOrManager ? 'text-[hsl(215,15%,52%)]' : 'text-gray-300'} />
                          </button>
                          <button
                            onClick={() => sendLeaseExpiryEmail(r)}
                            disabled={sendingEmail}
                            className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                            title="Send expiry notice"
                          >
                            <Icon name="MailIcon" size={14} className="text-blue-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-[hsl(214,20%,88%)]">
              <div>
                <h2 className="font-bold text-[hsl(215,25%,18%)]">Lease Renewal</h2>
                <p className="text-sm text-[hsl(215,15%,52%)]">{selected.propertyAddress}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-[hsl(210,15%,94%)]">
                <Icon name="XIcon" size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3">
                  <p className="text-xs text-[hsl(215,15%,52%)]">Tenant</p>
                  <p className="font-semibold">{selected.tenantName}</p>
                </div>
                <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3">
                  <p className="text-xs text-[hsl(215,15%,52%)]">Lease End</p>
                  <p className="font-semibold">{selected.currentLeaseEnd}</p>
                </div>
                <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3">
                  <p className="text-xs text-[hsl(215,15%,52%)]">Current Rent</p>
                  <p className="font-semibold">HK${selected.currentRent.toLocaleString()}</p>
                </div>
                <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3">
                  <p className="text-xs text-[hsl(215,15%,52%)]">Proposed Rent</p>
                  <p className="font-semibold">HK${selected.proposedNewRent.toLocaleString()}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as RenewalStatus)}
                  className="w-full border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                >
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5">Agreed New Rent (HKD)</label>
                <input
                  type="number"
                  value={editAgreedRent}
                  onChange={(e) => setEditAgreedRent(e.target.value)}
                  placeholder="e.g. 19000"
                  className="w-full border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5">Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  placeholder="Add renewal notes..."
                  className="w-full border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-[hsl(214,20%,88%)]">
              <button
                onClick={() => sendLeaseExpiryEmail(selected)}
                disabled={sendingEmail}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 text-blue-600 text-sm font-semibold hover:bg-blue-50 transition-colors"
              >
                <Icon name="MailIcon" size={14} />
                Send Notice
              </button>
              <div className="flex-1" />
              <button onClick={() => setSelected(null)} className="px-4 py-2 rounded-lg border border-[hsl(214,20%,88%)] text-sm font-semibold hover:bg-[hsl(210,15%,94%)]">
                Cancel
              </button>
              <button onClick={saveChanges} className="px-4 py-2 rounded-lg bg-[#8B1A2B] text-white text-sm font-semibold hover:bg-[#6d1522] transition-colors">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
