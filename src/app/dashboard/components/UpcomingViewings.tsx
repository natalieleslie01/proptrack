import React from 'react';
import Icon from '@/components/ui/AppIcon';

const viewings = [
  { id: 'view-001', time: '10:00', date: '21 Apr', unit: '15C, The Arch', district: 'West Kowloon', agent: 'Cris Yan', type: 'Sale' },
  { id: 'view-002', time: '11:30', date: '21 Apr', unit: '8B, Island Crest', district: 'Mid-Levels', agent: 'Nicola Baird', type: 'Let' },
  { id: 'view-003', time: '14:00', date: '22 Apr', unit: '22F, Harbour Grand', district: 'North Point', agent: 'Natalie Leslie', type: 'Let' },
  { id: 'view-004', time: '15:30', date: '22 Apr', unit: '3A, Pacific Place', district: 'Admiralty', agent: 'Cris Yan', type: 'Sale' },
  { id: 'view-005', time: '10:30', date: '23 Apr', unit: '11D, Mong Kok Ctr', district: 'Mong Kok', agent: 'Nicola Baird', type: 'Let' },
];

export default function UpcomingViewings() {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[hsl(214,20%,88%)]">
        <h2 className="text-sm font-semibold text-[hsl(215,25%,18%)]">Upcoming Viewings</h2>
        <div className="flex items-center gap-2">
          <span className="badge bg-[#1B4F8A]/10 text-[#1B4F8A] border border-[#1B4F8A]/20">24 this week</span>
          <button className="p-1 rounded hover:bg-[hsl(210,15%,94%)] transition-colors" title="Print viewing schedule">
            <Icon name="PrinterIcon" size={14} className="text-[hsl(215,15%,52%)]" />
          </button>
        </div>
      </div>
      <div className="divide-y divide-[hsl(214,20%,92%)]">
        {viewings?.map((v) => (
          <div key={v?.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[hsl(210,15%,97%)] transition-colors">
            <div className="text-center min-w-[40px]">
              <p className="text-xs font-semibold text-[#1B4F8A] font-mono">{v?.time}</p>
              <p className="text-[10px] text-[hsl(215,15%,52%)]">{v?.date}</p>
            </div>
            <div className="w-px h-8 bg-[hsl(214,20%,88%)]" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[hsl(215,25%,18%)] truncate">{v?.unit}</p>
              <p className="text-xs text-[hsl(215,15%,52%)] truncate">{v?.district} · {v?.agent}</p>
            </div>
            <span className={`badge text-[10px] ${v?.type === 'Sale' ? 'bg-violet-50 text-violet-700 border border-violet-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
              {v?.type}
            </span>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 border-t border-[hsl(214,20%,88%)]">
        <button className="btn-ghost w-full justify-center text-xs py-1.5">
          <Icon name="CalendarIcon" size={13} />
          View Full Schedule
        </button>
      </div>
    </div>
  );
}