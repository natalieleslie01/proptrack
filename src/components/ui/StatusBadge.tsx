'use client';

import React from 'react';

type StatusType =
  | 0 | 1 | 2 | 3 | 4 | 9 | 99
  | 'vacant' | 'vacant-soon' | 'with-ta' | 'active' | 'expiring-soon' | 'expired' | 'draft' | 'pending' | 'completed' | 'agent' | 'manager' | 'admin';

const numericStatusConfig: Record<number, { label: string; className: string }> = {
  0:  { label: 'Active',      className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  1:  { label: 'Leased',      className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  2:  { label: 'Self Occupy', className: 'bg-slate-100 text-slate-600 border border-slate-200' },
  3:  { label: 'No Contact',  className: 'bg-red-50 text-red-600 border border-red-200' },
  4:  { label: 'Sold',        className: 'bg-violet-50 text-violet-700 border border-violet-200' },
  9:  { label: 'Unknown',     className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  99: { label: 'Blank',       className: 'bg-gray-100 text-gray-500 border border-gray-200' },
};

const stringStatusConfig: Record<string, { label: string; className: string }> = {
  // Occupancy status
  'vacant':       { label: 'Vacant',       className: 'bg-red-50 text-red-600 border border-red-200' },
  'vacant-soon':  { label: 'Vacant Soon',  className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  'with-ta':      { label: 'With TA',      className: 'bg-teal-50 text-teal-700 border border-teal-200' },
  // Other
  'active':       { label: 'Active',       className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  'expiring-soon':{ label: 'Expiring Soon',className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  'expired':      { label: 'Expired',      className: 'bg-red-50 text-red-600 border border-red-200' },
  'draft':        { label: 'Draft',        className: 'bg-gray-100 text-gray-600 border border-gray-200' },
  'pending':      { label: 'Pending',      className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  'completed':    { label: 'Completed',    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  'agent':        { label: 'Agent',        className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  'manager':      { label: 'Manager',      className: 'bg-violet-50 text-violet-700 border border-violet-200' },
  'admin':        { label: 'Admin',        className: 'bg-[#1B4F8A]/10 text-[#1B4F8A] border border-[#1B4F8A]/20' },
};

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  let config: { label: string; className: string };
  if (typeof status === 'number') {
    config = numericStatusConfig[status] ?? { label: String(status), className: 'bg-gray-100 text-gray-600 border border-gray-200' };
  } else {
    config = stringStatusConfig[status] ?? { label: status, className: 'bg-gray-100 text-gray-600 border border-gray-200' };
  }
  return (
    <span className={`badge ${config.className} ${className}`}>
      {config.label}
    </span>
  );
}