'use client';

import React, { useState, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';
import AppLayout from '@/components/AppLayout';
import { mockProperties, agentNames } from '@/app/property-management/components/mockData';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'viewing' | 'lease_start' | 'lease_end' | 'renewal' | 'maintenance';
  property: string;
  agent?: string;
  time?: string;
  detail?: string;
}

const EVENT_COLORS: Record<CalendarEvent['type'], { bg: string; text: string; dot: string }> = {
  viewing: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  lease_start: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  lease_end: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  renewal: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  maintenance: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
};

const EVENT_LABELS: Record<CalendarEvent['type'], string> = {
  viewing: 'Viewing',
  lease_start: 'Lease Start',
  lease_end: 'Lease End',
  renewal: 'Renewal',
  maintenance: 'Maintenance',
};

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  if (dateStr.includes('/')) {
    const [d, m, y] = dateStr.split('/').map(Number);
    if (!d || !m || !y) return null;
    return new Date(y, m - 1, d);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function toYMD(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildEvents(): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const today = new Date();

  mockProperties.forEach((p) => {
    const addr = `${p.unit}, ${p.building}`;
    if (p.tenant) {
      const leaseStart = parseDate(p.tenant.leaseStart);
      const leaseEnd = parseDate(p.tenant.leaseEnd);
      if (leaseStart) {
        events.push({ id: `ls-${p.id}`, title: `Lease Start: ${p.tenant.name}`, date: toYMD(leaseStart), type: 'lease_start', property: addr, detail: `Monthly rent: HK$${p.monthlyRent?.toLocaleString() ?? 'N/A'}` });
      }
      if (leaseEnd) {
        events.push({ id: `le-${p.id}`, title: `Lease End: ${p.tenant.name}`, date: toYMD(leaseEnd), type: 'lease_end', property: addr, detail: `Tenant: ${p.tenant.name}` });
        const days = Math.ceil((leaseEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (days > 0 && days < 90) {
          const renewalDate = new Date(leaseEnd);
          renewalDate.setDate(renewalDate.getDate() - 30);
          events.push({ id: `rn-${p.id}`, title: `Renewal Due: ${addr}`, date: toYMD(renewalDate), type: 'renewal', property: addr, detail: `Lease ends in ${days} days` });
        }
      }
    }
  });

  // Add some mock viewings
  const viewingDates = [0, 1, 2, 3, 5, 7, 8, 10, 12, 14].map((offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return toYMD(d);
  });
  const times = ['09:00', '10:30', '11:00', '14:00', '15:30', '16:00'];
  const props = mockProperties.slice(0, 10);
  viewingDates.forEach((date, i) => {
    const prop = props[i % props.length];
    events.push({
      id: `v-${i}`,
      title: `Viewing: ${prop.unit}, ${prop.building}`,
      date,
      type: 'viewing',
      property: `${prop.unit}, ${prop.building}`,
      agent: agentNames[i % agentNames.length],
      time: times[i % times.length],
      detail: `Agent: ${agentNames[i % agentNames.length]}`,
    });
  });

  // Mock maintenance
  const maintDates = [1, 3, 6, 9].map((offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return toYMD(d);
  });
  maintDates.forEach((date, i) => {
    const prop = props[(i + 3) % props.length];
    events.push({ id: `m-${i}`, title: `Maintenance: ${prop.unit}`, date, type: 'maintenance', property: `${prop.unit}, ${prop.building}`, detail: ['Plumbing repair', 'AC service', 'Electrical check', 'Deep clean'][i] });
  });

  return events;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarClient() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week' | 'list'>('month');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const events = useMemo(() => buildEvents(), []);

  const filteredEvents = useMemo(() => {
    if (filterType === 'all') return events;
    return events.filter((e) => e.type === filterType);
  }, [events, filterType]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarDays: Array<{ date: Date; ymd: string; isCurrentMonth: boolean }> = [];
  for (let i = 0; i < firstDay; i++) {
    const d = new Date(year, month, -firstDay + i + 1);
    calendarDays.push({ date: d, ymd: toYMD(d), isCurrentMonth: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    calendarDays.push({ date: d, ymd: toYMD(d), isCurrentMonth: true });
  }
  const remaining = 42 - calendarDays.length;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    calendarDays.push({ date: d, ymd: toYMD(d), isCurrentMonth: false });
  }

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    filteredEvents.forEach((e) => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [filteredEvents]);

  const todayYMD = toYMD(new Date());

  const selectedDayEvents = selectedDay ? (eventsByDate[selectedDay] ?? []) : [];

  // List view: upcoming 30 days
  const listEvents = useMemo(() => {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 30);
    return filteredEvents
      .filter((e) => {
        const d = new Date(e.date);
        return d >= today && d <= end;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredEvents]);

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Calendar</h1>
            <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">Viewings, lease dates, renewals and maintenance schedule</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(['month', 'list'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors capitalize ${
                  view === v ? 'bg-[#8B1A2B] text-white' : 'bg-white border border-[hsl(214,20%,88%)] text-[hsl(215,15%,52%)] hover:bg-[hsl(210,15%,94%)]'
                }`}
              >
                {v === 'month' ? 'Month' : 'Upcoming'}
              </button>
            ))}
          </div>
        </div>

        {/* Legend + Filter */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-[hsl(215,15%,52%)]">Filter:</span>
          <button
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${filterType === 'all' ? 'bg-[hsl(215,25%,18%)] text-white' : 'bg-[hsl(210,20%,97%)] text-[hsl(215,15%,52%)]'}`}
          >
            All
          </button>
          {(Object.keys(EVENT_COLORS) as CalendarEvent['type'][]).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${filterType === type ? `${EVENT_COLORS[type].bg} ${EVENT_COLORS[type].text}` : 'bg-[hsl(210,20%,97%)] text-[hsl(215,15%,52%)]'}`}
            >
              <span className={`w-2 h-2 rounded-full ${EVENT_COLORS[type].dot}`} />
              {EVENT_LABELS[type]}
            </button>
          ))}
        </div>

        {view === 'month' && (
          <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
            {/* Month Nav */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[hsl(214,20%,88%)]">
              <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors">
                <Icon name="ChevronLeftIcon" size={16} />
              </button>
              <h2 className="font-bold text-[hsl(215,25%,18%)]">{MONTHS[month]} {year}</h2>
              <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors">
                <Icon name="ChevronRightIcon" size={16} />
              </button>
            </div>
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-[hsl(214,20%,88%)]">
              {DAYS.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide">
                  <span className="hidden sm:inline">{d}</span>
                  <span className="sm:hidden">{d[0]}</span>
                </div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {calendarDays.map(({ date, ymd, isCurrentMonth }, idx) => {
                const dayEvents = eventsByDate[ymd] ?? [];
                const isToday = ymd === todayYMD;
                const isSelected = ymd === selectedDay;
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDay(isSelected ? null : ymd)}
                    className={`min-h-[80px] sm:min-h-[100px] p-1 sm:p-2 border-b border-r border-[hsl(214,20%,88%)] cursor-pointer transition-colors ${
                      isCurrentMonth ? 'bg-white hover:bg-[hsl(210,20%,97%)]' : 'bg-[hsl(210,20%,97%)] opacity-50'
                    } ${isSelected ? 'ring-2 ring-inset ring-[#1B4F8A]' : ''}`}
                  >
                    <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold mb-1 ${
                      isToday ? 'bg-[#8B1A2B] text-white' : 'text-[hsl(215,25%,18%)]'
                    }`}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 2).map((e) => (
                        <div key={e.id} className={`${EVENT_COLORS[e.type].bg} ${EVENT_COLORS[e.type].text} text-[10px] px-1 py-0.5 rounded truncate font-medium`}>
                          <span className="hidden sm:inline">{e.time ? `${e.time} ` : ''}{e.title}</span>
                          <span className="sm:hidden">{EVENT_LABELS[e.type][0]}</span>
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px] text-[hsl(215,15%,52%)] px-1">+{dayEvents.length - 2} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected day events */}
        {selectedDay && selectedDayEvents.length > 0 && view === 'month' && (
          <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-4">
            <h3 className="font-semibold text-[hsl(215,25%,18%)] mb-3 text-sm">
              Events on {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            <div className="space-y-2">
              {selectedDayEvents.map((e) => (
                <div key={e.id} className={`flex items-start gap-3 p-3 rounded-lg ${EVENT_COLORS[e.type].bg}`}>
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${EVENT_COLORS[e.type].dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${EVENT_COLORS[e.type].text}`}>{e.title}</p>
                    <p className="text-xs text-[hsl(215,15%,52%)]">{e.property}</p>
                    {e.detail && <p className="text-xs text-[hsl(215,15%,52%)]">{e.detail}</p>}
                    {e.time && <p className="text-xs text-[hsl(215,15%,52%)]">⏰ {e.time}</p>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${EVENT_COLORS[e.type].bg} ${EVENT_COLORS[e.type].text}`}>
                    {EVENT_LABELS[e.type]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* List view */}
        {view === 'list' && (
          <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] overflow-hidden">
            <div className="px-5 py-3 border-b border-[hsl(214,20%,88%)]">
              <h2 className="font-bold text-[hsl(215,25%,18%)] text-sm">Upcoming 30 Days</h2>
            </div>
            {listEvents.length === 0 ? (
              <div className="text-center py-12 text-[hsl(215,15%,52%)]">No upcoming events</div>
            ) : (
              <div className="divide-y divide-[hsl(214,20%,88%)]">
                {listEvents.map((e) => (
                  <div key={e.id} className="flex items-center gap-4 px-5 py-3 hover:bg-[hsl(210,20%,97%)] transition-colors">
                    <div className="w-12 text-center flex-shrink-0">
                      <p className="text-xs text-[hsl(215,15%,52%)]">{new Date(e.date + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' })}</p>
                      <p className="text-lg font-bold text-[hsl(215,25%,18%)]">{new Date(e.date + 'T00:00:00').getDate()}</p>
                    </div>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${EVENT_COLORS[e.type].dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[hsl(215,25%,18%)] truncate">{e.title}</p>
                      <p className="text-xs text-[hsl(215,15%,52%)] truncate">{e.property}{e.time ? ` · ${e.time}` : ''}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${EVENT_COLORS[e.type].bg} ${EVENT_COLORS[e.type].text}`}>
                      {EVENT_LABELS[e.type]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
