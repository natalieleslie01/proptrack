'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';

interface AlertItem {
  id: string;
  property: string;
  detail: string;
  agent: string;
  urgency: 'critical' | 'high' | 'medium';
  dueLabel?: string;
  href: string;
}

interface AlertCategory {
  id: string;
  label: string;
  icon: string;
  count: number;
  color: string;
  bgColor: string;
  borderColor: string;
  iconBg: string;
  items: AlertItem[];
}

const alertCategories: AlertCategory[] = [
  {
    id: 'unconfirmed-viewings',
    label: 'Unconfirmed Viewings',
    icon: 'CalendarXIcon',
    count: 5,
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconBg: 'bg-red-100 text-red-600',
    items: [
      { id: 'uv-001', property: '15C The Arch, West Kowloon', detail: 'Viewing at 10:00 today — no client confirmation received', agent: 'Cris Yan', urgency: 'critical', dueLabel: 'Today 10:00', href: '/agent-viewings' },
      { id: 'uv-002', property: '8B Island Crest, Mid-Levels', detail: 'Viewing at 11:30 today — awaiting tenant confirmation', agent: 'Nicola Baird', urgency: 'critical', dueLabel: 'Today 11:30', href: '/agent-viewings' },
      { id: 'uv-003', property: '22F Harbour Grand, North Point', detail: 'Viewing at 14:00 tomorrow — client not yet confirmed', agent: 'Natalie Leslie', urgency: 'high', dueLabel: 'Tomorrow 14:00', href: '/agent-viewings' },
      { id: 'uv-004', property: '3A Pacific Place, Admiralty', detail: 'Viewing at 15:30 tomorrow — awaiting confirmation', agent: 'Cris Yan', urgency: 'high', dueLabel: 'Tomorrow 15:30', href: '/agent-viewings' },
      { id: 'uv-005', property: '11D Mong Kok Centre', detail: 'Viewing in 2 days — no response from client', agent: 'Nicola Baird', urgency: 'medium', dueLabel: 'In 2 days', href: '/agent-viewings' },
    ],
  },
  {
    id: 'overdue-workflow',
    label: 'Overdue Tenancy Workflow Steps',
    icon: 'ClipboardXIcon',
    count: 4,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    iconBg: 'bg-orange-100 text-orange-600',
    items: [
      { id: 'ow-001', property: '12B Harbour View, Wan Chai', detail: 'Step 4: Tenancy Agreement signing — overdue by 3 days', agent: 'Nicola Baird', urgency: 'critical', dueLabel: '3 days overdue', href: '/active-tenancies' },
      { id: 'ow-002', property: '7F The Masterpiece, Tsim Sha Tsui', detail: 'Step 6: Stamp duty submission — overdue by 1 day', agent: 'Natalie Leslie', urgency: 'critical', dueLabel: '1 day overdue', href: '/active-tenancies' },
      { id: 'ow-003', property: '18D Island Crest, Mid-Levels', detail: 'Step 3: Landlord countersignature — due today', agent: 'Cris Yan', urgency: 'high', dueLabel: 'Due today', href: '/active-tenancies' },
      { id: 'ow-004', property: '5A The Arch, West Kowloon', detail: 'Step 5: Deposit receipt issued — overdue by 2 days', agent: 'Nicola Baird', urgency: 'critical', dueLabel: '2 days overdue', href: '/active-tenancies' },
    ],
  },
  {
    id: 'lease-expiries',
    label: 'Upcoming Lease Expiries',
    icon: 'CalendarClockIcon',
    count: 6,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    iconBg: 'bg-amber-100 text-amber-600',
    items: [
      { id: 'le-001', property: '3B Sheung Wan Plaza', detail: 'Lease expires in 7 days — renewal not yet initiated', agent: 'Nicola Baird', urgency: 'critical', dueLabel: 'Expires 28 Apr', href: '/active-tenancies' },
      { id: 'le-002', property: '9C Taikoo Shing, Quarry Bay', detail: 'Lease expires in 14 days — tenant undecided on renewal', agent: 'Cris Yan', urgency: 'critical', dueLabel: 'Expires 5 May', href: '/active-tenancies' },
      { id: 'le-003', property: '21A Laguna City, Kowloon Bay', detail: 'Lease expires in 21 days — awaiting landlord decision', agent: 'Natalie Leslie', urgency: 'high', dueLabel: 'Expires 12 May', href: '/active-tenancies' },
      { id: 'le-004', property: '6D Kornhill, Quarry Bay', detail: 'Lease expires in 28 days — renewal terms not agreed', agent: 'Nicola Baird', urgency: 'high', dueLabel: 'Expires 19 May', href: '/active-tenancies' },
      { id: 'le-005', property: '14B Heng Fa Chuen', detail: 'Lease expires in 45 days — no contact made yet', agent: 'Cris Yan', urgency: 'medium', dueLabel: 'Expires 5 Jun', href: '/active-tenancies' },
      { id: 'le-006', property: '2F Mei Foo Sun Chuen', detail: 'Lease expires in 58 days — early renewal recommended', agent: 'Natalie Leslie', urgency: 'medium', dueLabel: 'Expires 18 Jun', href: '/active-tenancies' },
    ],
  },
  {
    id: 'missing-documents',
    label: 'Missing Documents',
    icon: 'FileXIcon',
    count: 7,
    color: 'text-violet-700',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    iconBg: 'bg-violet-100 text-violet-600',
    items: [
      { id: 'md-001', property: '10A The Harbourside, Kowloon', detail: 'HKID copy missing from tenancy file', agent: 'Natalie Leslie', urgency: 'critical', dueLabel: 'Required now', href: '/property-management' },
      { id: 'md-002', property: '17C Sorrento, West Kowloon', detail: 'Signed CR109 form not uploaded', agent: 'Nicola Baird', urgency: 'critical', dueLabel: 'Required now', href: '/property-management' },
      { id: 'md-003', property: '4B The Cullinan, West Kowloon', detail: 'Proof of income not received from tenant', agent: 'Cris Yan', urgency: 'high', dueLabel: 'Overdue 5 days', href: '/property-management' },
      { id: 'md-004', property: '8F One Silversea, Tai Kok Tsui', detail: 'Landlord authorisation letter missing', agent: 'Nicola Baird', urgency: 'high', dueLabel: 'Overdue 2 days', href: '/property-management' },
      { id: 'md-005', property: '25D Belcher\'s Hill, Kennedy Town', detail: 'Tenancy agreement (executed copy) not filed', agent: 'Natalie Leslie', urgency: 'high', dueLabel: 'Overdue 1 day', href: '/property-management' },
      { id: 'md-006', property: '13A Residence Bel-Air, Pok Fu Lam', detail: 'Stamp duty receipt not uploaded', agent: 'Cris Yan', urgency: 'medium', dueLabel: 'Due this week', href: '/property-management' },
      { id: 'md-007', property: '6C Island South, Wong Chuk Hang', detail: 'Building management consent form outstanding', agent: 'Nicola Baird', urgency: 'medium', dueLabel: 'Due this week', href: '/property-management' },
    ],
  },
  {
    id: 'unfollowed-enquiries',
    label: 'Unfollowed-Up Enquiries',
    icon: 'MessageSquareXIcon',
    count: 5,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconBg: 'bg-blue-100 text-blue-600',
    items: [
      { id: 'ue-001', property: 'Enquiry: 3-bed Mid-Levels', detail: 'Mr. James Ho — no follow-up in 4 days, budget HK$55,000/mo', agent: 'Nicola Baird', urgency: 'critical', dueLabel: '4 days no contact', href: '/enquiries' },
      { id: 'ue-002', property: 'Enquiry: Seaview unit, Island East', detail: 'Ms. Priya Sharma — no follow-up in 3 days, viewing requested', agent: 'Cris Yan', urgency: 'critical', dueLabel: '3 days no contact', href: '/enquiries' },
      { id: 'ue-003', property: 'Enquiry: 2-bed Kowloon Tong', detail: 'Mr. & Mrs. Chan — no follow-up in 2 days, pre-approved', agent: 'Natalie Leslie', urgency: 'high', dueLabel: '2 days no contact', href: '/enquiries' },
      { id: 'ue-004', property: 'Enquiry: Commercial unit, Wan Chai', detail: 'ABC Holdings Ltd — no follow-up in 2 days, urgent requirement', agent: 'Nicola Baird', urgency: 'high', dueLabel: '2 days no contact', href: '/enquiries' },
      { id: 'ue-005', property: 'Enquiry: Studio, Causeway Bay', detail: 'Ms. Linda Yip — no follow-up in 1 day, first-time renter', agent: 'Cris Yan', urgency: 'medium', dueLabel: '1 day no contact', href: '/enquiries' },
    ],
  },
];

const urgencyDot: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-amber-400',
};

const urgencyLabel: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
};

export default function ActionAlerts() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('unconfirmed-viewings');

  const totalAlerts = alertCategories.reduce((sum, cat) => sum + cat.count, 0);

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(214,20%,88%)] bg-red-50/40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
            <Icon name="BellRingIcon" size={16} className="text-red-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[hsl(215,25%,18%)]">Action Alerts</h2>
            <p className="text-[11px] text-[hsl(215,15%,52%)]">Priority tasks requiring immediate attention</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
            {totalAlerts} open
          </span>
        </div>
      </div>

      {/* Category Summary Strip */}
      <div className="grid grid-cols-5 divide-x divide-[hsl(214,20%,88%)] border-b border-[hsl(214,20%,88%)]">
        {alertCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
            className={`flex flex-col items-center gap-1 py-3 px-2 transition-colors hover:bg-[hsl(210,15%,96%)] ${
              expandedCategory === cat.id ? `${cat.bgColor}` : 'bg-white'
            }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${expandedCategory === cat.id ? cat.iconBg : 'bg-[hsl(210,15%,94%)] text-[hsl(215,15%,52%)]'}`}>
              <Icon name={cat.icon as Parameters<typeof Icon>[0]['name']} size={14} />
            </div>
            <span className={`text-lg font-bold tabular-nums leading-none ${expandedCategory === cat.id ? cat.color : 'text-[hsl(215,25%,18%)]'}`}>
              {cat.count}
            </span>
            <span className="text-[9px] font-medium text-[hsl(215,15%,52%)] text-center leading-tight px-1 hidden sm:block">
              {cat.label.split(' ').slice(0, 2).join(' ')}
            </span>
          </button>
        ))}
      </div>

      {/* Expanded Category Detail */}
      {expandedCategory && (() => {
        const cat = alertCategories.find((c) => c.id === expandedCategory);
        if (!cat) return null;
        return (
          <div>
            {/* Category Header */}
            <div className={`flex items-center justify-between px-4 py-2.5 ${cat.bgColor} border-b ${cat.borderColor}`}>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center ${cat.iconBg}`}>
                  <Icon name={cat.icon as Parameters<typeof Icon>[0]['name']} size={13} />
                </div>
                <span className={`text-xs font-bold ${cat.color}`}>{cat.label}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cat.iconBg}`}>
                  {cat.count} items
                </span>
              </div>
              <Link
                href={cat.items[0]?.href ?? '/dashboard'}
                className={`text-[10px] font-semibold ${cat.color} hover:underline flex items-center gap-1`}
              >
                View all
                <Icon name="ArrowRightIcon" size={10} />
              </Link>
            </div>

            {/* Alert Items */}
            <div className="divide-y divide-[hsl(214,20%,92%)]">
              {cat.items.map((item) => (
                <div key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[hsl(210,15%,97%)] transition-colors group">
                  {/* Urgency dot */}
                  <div className="flex flex-col items-center gap-1 pt-1 flex-shrink-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${urgencyDot[item.urgency]}`} />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[hsl(215,25%,18%)] truncate">{item.property}</p>
                    <p className="text-[11px] text-[hsl(215,15%,52%)] mt-0.5 leading-snug">{item.detail}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-[hsl(215,15%,60%)]">
                        <Icon name="UserIcon" size={9} className="inline mr-0.5" />
                        {item.agent}
                      </span>
                    </div>
                  </div>
                  {/* Right: urgency + due label + action */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      item.urgency === 'critical' ? 'bg-red-100 text-red-700' :
                      item.urgency === 'high'? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {urgencyLabel[item.urgency]}
                    </span>
                    {item.dueLabel && (
                      <span className="text-[10px] font-medium text-[hsl(215,15%,52%)] whitespace-nowrap">{item.dueLabel}</span>
                    )}
                    <Link
                      href={item.href}
                      className="text-[10px] font-semibold text-[#1B4F8A] hover:underline opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
                    >
                      Action
                      <Icon name="ArrowRightIcon" size={9} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[hsl(214,20%,88%)] bg-[hsl(210,15%,98%)] flex items-center justify-between">
        <p className="text-[11px] text-[hsl(215,15%,52%)]">
          <Icon name="RefreshCwIcon" size={10} className="inline mr-1" />
          Updated just now
        </p>
        <div className="flex items-center gap-3">
          {alertCategories.map((cat) => (
            <span key={cat.id} className="flex items-center gap-1 text-[10px] text-[hsl(215,15%,52%)]">
              <span className={`w-1.5 h-1.5 rounded-full ${cat.iconBg.split(' ')[1]}`} />
              {cat.count}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
