'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import Link from 'next/link';

const expiringLeases = [
  { id: 'lease-001', unit: '12B, Harbour View Mansion', district: 'Wan Chai', tenant: 'Zhang Wei Holdings', landlord: 'Mrs. Helen Fong', monthlyRent: 28500, leaseEnd: '15/05/2026', daysLeft: 24, status: 'expiring-soon' as const, agentNote: 'Tenant confirmed renewal interest' },
  { id: 'lease-002', unit: '8F, Pacific Place Tower 3', district: 'Admiralty', tenant: 'Meridian Consulting Ltd', landlord: 'Pacific Assets Co.', monthlyRent: 95000, leaseEnd: '31/05/2026', daysLeft: 40, status: 'expiring-soon' as const, agentNote: 'Awaiting revised rent proposal' },
  { id: 'lease-003', unit: '22A, The Masterpiece', district: 'Tsim Sha Tsui', tenant: 'Mr. & Mrs. Ng Ka Fai', landlord: 'TST Properties Ltd', monthlyRent: 42000, leaseEnd: '08/05/2026', daysLeft: 17, status: 'expiring-soon' as const, agentNote: 'CR109 Form pending — urgent' },
  { id: 'lease-004', unit: '5C, Mong Kok Centre', district: 'Mong Kok', tenant: 'Bright Star Trading', landlord: 'Mr. Chan Siu Ming', monthlyRent: 18900, leaseEnd: '22/05/2026', daysLeft: 31, status: 'expiring-soon' as const, agentNote: 'Tenant vacating — relisting required' },
  { id: 'lease-005', unit: '18D, Island Crest', district: 'Mid-Levels', tenant: 'Dr. Sarah Whitfield', landlord: 'Island Investments', monthlyRent: 56000, leaseEnd: '03/06/2026', daysLeft: 43, status: 'expiring-soon' as const, agentNote: 'Renewal negotiation in progress' },
  { id: 'lease-006', unit: '3B, Sheung Wan Plaza', district: 'Sheung Wan', tenant: 'Lotus Retail Group', landlord: 'Mr. Leung Wai Kin', monthlyRent: 34200, leaseEnd: '28/04/2026', daysLeft: 7, status: 'expired' as const, agentNote: 'OVERDUE — form not filed' },
  { id: 'lease-007', unit: '11F, Causeway Bay Mansion', district: 'Causeway Bay', tenant: 'Ms. Priya Sharma', landlord: 'CBay Estates Ltd', monthlyRent: 22800, leaseEnd: '19/05/2026', daysLeft: 28, status: 'expiring-soon' as const, agentNote: 'Second term offer AR1 to send' },
  { id: 'lease-008', unit: '7A, Kowloon Station', district: 'West Kowloon', tenant: 'GlobalTech HK Ltd', landlord: 'KStone Holdings', monthlyRent: 78000, leaseEnd: '14/06/2026', daysLeft: 54, status: 'expiring-soon' as const, agentNote: 'Commercial — stamp duty due' },
];

// Demo recipients — agents and managers who receive alerts
const ALERT_RECIPIENTS = [
  { name: 'Sarah Lam', email: 'sarah.lam@homesrus.hk', role: 'agent' as const },
  { name: 'Michael Chan', email: 'michael.chan@homesrus.hk', role: 'manager' as const },
];

type AlertWindow = 7 | 14 | 30;
type SendStatus = 'idle' | 'sending' | 'success' | 'error';

function DaysLeftBadge({ days }: { days: number }) {
  if (days <= 10) return <span className="font-mono text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">{days}d</span>;
  if (days <= 30) return <span className="font-mono text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">{days}d</span>;
  return <span className="font-mono text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{days}d</span>;
}

function AlertWindowButton({
  window,
  count,
  status,
  onClick,
}: {
  window: AlertWindow;
  count: number;
  status: SendStatus;
  onClick: () => void;
}) {
  const colors: Record<AlertWindow, { bg: string; text: string; border: string; hover: string }> = {
    7: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', hover: 'hover:bg-red-100' },
    14: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', hover: 'hover:bg-amber-100' },
    30: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', hover: 'hover:bg-blue-100' },
  };
  const c = colors[window];
  const isDisabled = status === 'sending' || count === 0;

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      title={count === 0 ? `No leases expiring within ${window} days` : `Send alert for ${count} lease${count !== 1 ? 's' : ''} expiring within ${window} days`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition-colors
        ${c.bg} ${c.text} ${c.border}
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : `${c.hover} cursor-pointer`}
      `}
    >
      {status === 'sending' ? (
        <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : status === 'success' ? (
        <Icon name="CheckIcon" size={12} />
      ) : status === 'error' ? (
        <Icon name="AlertCircleIcon" size={12} />
      ) : (
        <Icon name="MailIcon" size={12} />
      )}
      {window}d
      {count > 0 && (
        <span className={`ml-0.5 px-1 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`}>
          {count}
        </span>
      )}
    </button>
  );
}

export default function ExpiringLeasesTable() {
  const [sendStatus, setSendStatus] = useState<Record<AlertWindow, SendStatus>>({
    7: 'idle',
    14: 'idle',
    30: 'idle',
  });
  const [lastSent, setLastSent] = useState<Record<AlertWindow, string | null>>({
    7: null,
    14: null,
    30: null,
  });

  const leasesForWindow = (window: AlertWindow) =>
    expiringLeases.filter((l) => l.daysLeft <= window);

  const handleSendAlert = async (alertWindow: AlertWindow) => {
    const leases = leasesForWindow(alertWindow);
    if (leases.length === 0) return;

    setSendStatus((prev) => ({ ...prev, [alertWindow]: 'sending' }));

    try {
      const results = await Promise.all(
        ALERT_RECIPIENTS.map((recipient) =>
          fetch('/api/send-lease-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipientName: recipient.name,
              recipientEmail: recipient.email,
              recipientRole: recipient.role,
              leases: leases.map((l) => ({
                unit: l.unit,
                district: l.district,
                tenant: l.tenant,
                monthlyRent: l.monthlyRent,
                leaseEnd: l.leaseEnd,
                daysLeft: l.daysLeft,
                agentNote: l.agentNote,
              })),
              alertWindow,
            }),
          }).then((r) => r.json())
        )
      );

      const allOk = results.every((r) => r.success);
      setSendStatus((prev) => ({ ...prev, [alertWindow]: allOk ? 'success' : 'error' }));
      setLastSent((prev) => ({
        ...prev,
        [alertWindow]: allOk
          ? new Date().toLocaleTimeString('en-HK', { hour: '2-digit', minute: '2-digit' })
          : null,
      }));

      // Reset to idle after 4 seconds
      setTimeout(() => {
        setSendStatus((prev) => ({ ...prev, [alertWindow]: 'idle' }));
      }, 4000);
    } catch {
      setSendStatus((prev) => ({ ...prev, [alertWindow]: 'error' }));
      setTimeout(() => {
        setSendStatus((prev) => ({ ...prev, [alertWindow]: 'idle' }));
      }, 4000);
    }
  };

  const alertWindows: AlertWindow[] = [7, 14, 30];

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(214,20%,88%)]">
        <div>
          <h2 className="text-base font-semibold text-[hsl(215,25%,18%)]">Expiring Leases</h2>
          <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">Next 60 days · 47 total requiring action</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className="badge bg-red-50 text-red-700 border border-red-200">1 Overdue</span>

          {/* Alert send buttons */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[hsl(215,15%,52%)] mr-0.5 hidden sm:inline">Alert:</span>
            {alertWindows.map((w) => (
              <AlertWindowButton
                key={w}
                window={w}
                count={leasesForWindow(w).length}
                status={sendStatus[w]}
                onClick={() => handleSendAlert(w)}
              />
            ))}
          </div>

          <Link href="/property-management">
            <button className="btn-ghost py-1.5 text-xs">View All</button>
          </Link>
        </div>
      </div>

      {/* Last sent status bar */}
      {alertWindows.some((w) => lastSent[w] !== null) && (
        <div className="px-5 py-2 bg-green-50 border-b border-green-100 flex items-center gap-2">
          <Icon name="CheckCircleIcon" size={13} className="text-green-600 flex-shrink-0" />
          <p className="text-xs text-green-700">
            Alerts sent to {ALERT_RECIPIENTS.length} recipient{ALERT_RECIPIENTS.length !== 1 ? 's' : ''} (agents &amp; managers):{' '}
            {alertWindows
              .filter((w) => lastSent[w])
              .map((w) => `${w}-day at ${lastSent[w]}`)
              .join(', ')}
          </p>
        </div>
      )}

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[hsl(214,20%,88%)] bg-[hsl(210,20%,97%)]">
              {['Unit / Address', 'District', 'Tenant', 'Monthly Rent', 'Lease End', 'Days Left', 'Status', 'Actions'].map((col) => (
                <th key={`col-${col}`} className="px-4 py-2.5 text-left text-xs font-semibold text-[hsl(215,15%,52%)] whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {expiringLeases.map((lease, idx) => (
              <tr
                key={lease.id}
                className={`border-b border-[hsl(214,20%,88%)] hover:bg-[hsl(210,15%,97%)] transition-colors ${idx % 2 === 0 ? '' : 'bg-[hsl(210,20%,98%)]'} ${lease.status === 'expired' ? 'bg-red-50/40 hover:bg-red-50/60' : ''}`}
              >
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-[hsl(215,25%,18%)] truncate max-w-[160px]">{lease.unit}</p>
                  <p className="text-xs text-[hsl(215,15%,52%)] truncate max-w-[160px]">{lease.agentNote}</p>
                </td>
                <td className="px-4 py-3 text-sm text-[hsl(215,25%,18%)] whitespace-nowrap">{lease.district}</td>
                <td className="px-4 py-3 text-sm text-[hsl(215,25%,18%)] whitespace-nowrap max-w-[140px] truncate">{lease.tenant}</td>
                <td className="px-4 py-3 text-sm font-mono font-semibold text-[hsl(215,25%,18%)] tabular-nums whitespace-nowrap">
                  HK${lease.monthlyRent.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm font-mono text-[hsl(215,25%,18%)] whitespace-nowrap">{lease.leaseEnd}</td>
                <td className="px-4 py-3">
                  <DaysLeftBadge days={lease.daysLeft} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={lease.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 rounded hover:bg-[hsl(210,15%,94%)] transition-colors" title="Generate CR109 Form">
                      <Icon name="FileTextIcon" size={14} className="text-[#1B4F8A]" />
                    </button>
                    <button className="p-1.5 rounded hover:bg-[hsl(210,15%,94%)] transition-colors" title="View property">
                      <Icon name="ExternalLinkIcon" size={14} className="text-[hsl(215,15%,52%)]" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}