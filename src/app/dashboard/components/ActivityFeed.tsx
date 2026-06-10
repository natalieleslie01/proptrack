import React from 'react';
import Icon from '@/components/ui/AppIcon';

const activities = [
  { id: 'act-001', type: 'form', icon: 'FileCheckIcon', color: 'text-emerald-600 bg-emerald-50', message: 'CR109 filed for 12B Harbour View', agent: 'Nicola Baird', time: '32m ago' },
  { id: 'act-002', type: 'tenancy', icon: 'KeyIcon', color: 'text-[#1B4F8A] bg-[#1B4F8A]/10', message: 'New tenancy: 18D Island Crest, HK$56,000/mo', agent: 'Cris Yan', time: '1h ago' },
  { id: 'act-003', type: 'alert', icon: 'AlertCircleIcon', color: 'text-red-600 bg-red-50', message: 'Lease overdue: 3B Sheung Wan Plaza', agent: 'System', time: '2h ago' },
  { id: 'act-004', type: 'sale', icon: 'TagIcon', color: 'text-violet-600 bg-violet-50', message: 'Sold: 5A The Masterpiece — HK$18.2M', agent: 'Natalie Leslie', time: '3h ago' },
  { id: 'act-005', type: 'update', icon: 'PencilIcon', color: 'text-amber-600 bg-amber-50', message: 'Landlord contact updated: Mrs. Helen Fong', agent: 'Nicola Baird', time: '4h ago' },
  { id: 'act-006', type: 'viewing', icon: 'CalendarPlusIcon', color: 'text-blue-600 bg-blue-50', message: 'Viewing scheduled: 22F Harbour Grand, 22 Apr', agent: 'Cris Yan', time: '5h ago' },
];

export default function ActivityFeed() {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[hsl(214,20%,88%)]">
        <h2 className="text-sm font-semibold text-[hsl(215,25%,18%)]">Recent Activity</h2>
        <span className="text-xs text-[hsl(215,15%,52%)]">Today</span>
      </div>
      <div className="divide-y divide-[hsl(214,20%,92%)]">
        {activities.map((act) => (
          <div key={act.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[hsl(210,15%,97%)] transition-colors">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${act.color}`}>
              <Icon name={act.icon as Parameters<typeof Icon>[0]['name']} size={13} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[hsl(215,25%,18%)] leading-snug">{act.message}</p>
              <p className="text-[10px] text-[hsl(215,15%,52%)] mt-0.5">{act.agent} · {act.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}