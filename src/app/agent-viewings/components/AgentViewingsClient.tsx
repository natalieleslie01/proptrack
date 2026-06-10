'use client';

import React, { useState, useCallback, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import Icon from '@/components/ui/AppIcon';
import { useViewingsRealtime, usePropertiesRealtime, RealtimeEvent } from '@/hooks/useRealtimeSync';
import { toast } from 'sonner';

interface Viewing {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  endTime: string;
  property: {
    ref: string;
    address: string;
    village: string;
    phase: string;
    beds: number;
    baths: number;
    sqft: number;
    type: 'Sale' | 'Rent' | 'Sale & Rent';
    price: string;
  };
  client: {
    name: string;
    email: string;
    phone: string;
  };
  agent: string;
  status: 'Confirmed' | 'Pending' | 'Cancelled';
  notes?: string;
}

const VIEWINGS: Viewing[] = [
  {
    id: 'v-001',
    date: '2026-04-28',
    time: '09:30',
    endTime: '10:15',
    property: { ref: 'DB-003', address: 'Seabee Lane, Flat 12B', village: 'Discovery Bay', phase: 'Phase 3', beds: 3, baths: 2, sqft: 1050, type: 'Sale', price: 'HK$9,800,000' },
    client: { name: 'James Whitfield', email: 'james.whitfield@email.com', phone: '+852 9123 4567' },
    agent: 'Cris Yan',
    status: 'Confirmed',
    notes: 'Client is relocating from UK, very motivated buyer.',
  },
  {
    id: 'v-002',
    date: '2026-04-28',
    time: '11:00',
    endTime: '11:45',
    property: { ref: 'DB-007', address: 'Siena One, Tower 2, 8F', village: 'Discovery Bay', phase: 'Phase 7', beds: 2, baths: 2, sqft: 820, type: 'Rent', price: 'HK$22,000/mo' },
    client: { name: 'Priya Sharma', email: 'priya.sharma@corp.hk', phone: '+852 9234 5678' },
    agent: 'Nicola Baird',
    status: 'Confirmed',
  },
  {
    id: 'v-003',
    date: '2026-04-28',
    time: '14:30',
    endTime: '15:15',
    property: { ref: 'DB-019', address: 'Headland Drive, Villa 4', village: 'Discovery Bay', phase: 'Headland', beds: 4, baths: 3, sqft: 1800, type: 'Sale', price: 'HK$18,500,000' },
    client: { name: 'Robert Chen', email: 'rchen@finance.com', phone: '+852 9345 6789' },
    agent: 'Natalie Leslie',
    status: 'Pending',
    notes: 'Second viewing — client wants to bring architect.',
  },
  {
    id: 'v-004',
    date: '2026-04-29',
    time: '10:00',
    endTime: '10:45',
    property: { ref: 'DB-025', address: 'Siena Two, Tower 1, 15C', village: 'Discovery Bay', phase: 'Phase 7', beds: 3, baths: 2, sqft: 1100, type: 'Sale & Rent', price: 'HK$11,200,000' },
    client: { name: 'Sophie Laurent', email: 'sophie.laurent@gmail.com', phone: '+852 9456 7890' },
    agent: 'Cris Yan',
    status: 'Confirmed',
  },
  {
    id: 'v-005',
    date: '2026-04-29',
    time: '13:00',
    endTime: '13:45',
    property: { ref: 'DB-033', address: 'Greenbelt, Block C, 3A', village: 'Discovery Bay', phase: 'Phase 5', beds: 2, baths: 1, sqft: 750, type: 'Rent', price: 'HK$18,500/mo' },
    client: { name: 'Michael Tanaka', email: 'm.tanaka@tech.co', phone: '+852 9567 8901' },
    agent: 'Nicola Baird',
    status: 'Confirmed',
  },
  {
    id: 'v-006',
    date: '2026-04-30',
    time: '09:00',
    endTime: '09:45',
    property: { ref: 'DB-041', address: 'Bijou Hamlet, House 7', village: 'Discovery Bay', phase: 'Phase 11', beds: 5, baths: 4, sqft: 2400, type: 'Sale', price: 'HK$28,000,000' },
    client: { name: 'Catherine Ho', email: 'catherine.ho@law.hk', phone: '+852 9678 9012' },
    agent: 'Natalie Leslie',
    status: 'Confirmed',
    notes: 'High-net-worth client, prefers discretion.',
  },
  {
    id: 'v-007',
    date: '2026-04-30',
    time: '15:00',
    endTime: '15:45',
    property: { ref: 'DB-016', address: 'Parkvale, Block B, 6D', village: 'Discovery Bay', phase: 'Phase 3', beds: 3, baths: 2, sqft: 980, type: 'Rent', price: 'HK$26,000/mo' },
    client: { name: 'Daniel Park', email: 'dpark@consultinging.com', phone: '+852 9789 0123' },
    agent: 'Cris Yan',
    status: 'Pending',
  },
  {
    id: 'v-008',
    date: '2026-05-01',
    time: '11:30',
    endTime: '12:15',
    property: { ref: 'DB-022', address: 'Positano, Tower 3, 20A', village: 'Discovery Bay', phase: 'Phase 9', beds: 2, baths: 2, sqft: 870, type: 'Sale', price: 'HK$8,400,000' },
    client: { name: 'Emma Wilson', email: 'emma.wilson@media.com', phone: '+852 9890 1234' },
    agent: 'Nicola Baird',
    status: 'Confirmed',
  },
];

const STATUS_COLORS: Record<string, string> = {
  Confirmed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  Cancelled: 'bg-red-50 text-red-700 border border-red-200',
};

const TYPE_COLORS: Record<string, string> = {
  Sale: 'bg-violet-50 text-violet-700 border border-violet-200',
  Rent: 'bg-blue-50 text-blue-700 border border-blue-200',
  'Sale & Rent': 'bg-teal-50 text-teal-700 border border-teal-200',
};

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTodayStr(): string {
  return toDateStr(new Date());
}

function getDatesForDay(dateStr: string): string[] {
  return [dateStr];
}

function getDatesForWeek(dateStr: string): string[] {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const nd = new Date(monday);
    nd.setDate(monday.getDate() + i);
    dates.push(toDateStr(nd));
  }
  return dates;
}

function getDatesForMonth(dateStr: string): string[] {
  const d = new Date(dateStr + 'T00:00:00');
  const year = d.getFullYear();
  const month = d.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dates: string[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
  }
  return dates;
}

function formatDateLabel(dateStr: string): { day: string; weekday: string; month: string } {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    day: d.getDate().toString(),
    weekday: d.toLocaleDateString('en-GB', { weekday: 'short' }),
    month: d.toLocaleDateString('en-GB', { month: 'short' }),
  };
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatMonthYear(year: number, month: number): string {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

// Mini calendar picker component
interface MiniCalendarProps {
  selectedDate: string;
  onSelect: (date: string) => void;
  viewingDates: Set<string>;
}

function MiniCalendar({ selectedDate, onSelect, viewingDates }: MiniCalendarProps) {
  const today = getTodayStr();
  const selDate = new Date(selectedDate + 'T00:00:00');
  const [calYear, setCalYear] = useState(selDate.getFullYear());
  const [calMonth, setCalMonth] = useState(selDate.getMonth());

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const startOffset = (firstDayOfMonth + 6) % 7; // Mon-based

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  const goToday = () => {
    const t = new Date();
    setCalYear(t.getFullYear());
    setCalMonth(t.getMonth());
    onSelect(today);
  };

  const days: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  return (
    <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-3 min-w-[220px]">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-[hsl(210,15%,94%)] transition-colors">
          <Icon name="ChevronLeftIcon" size={14} className="text-[hsl(215,15%,52%)]" />
        </button>
        <span className="text-xs font-semibold text-[hsl(215,25%,18%)]">{formatMonthYear(calYear, calMonth)}</span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-[hsl(210,15%,94%)] transition-colors">
          <Icon name="ChevronRightIcon" size={14} className="text-[hsl(215,15%,52%)]" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-semibold text-[hsl(215,15%,52%)] py-0.5">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />;
          const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === today;
          const hasViewings = viewingDates.has(dateStr);
          return (
            <button
              key={dateStr}
              onClick={() => onSelect(dateStr)}
              className={`relative flex flex-col items-center justify-center h-7 w-full rounded-md text-[11px] font-medium transition-all
                ${isSelected ? 'bg-[#8B1A2B] text-white' : isToday ? 'bg-[#8B1A2B]/10 text-[#8B1A2B] font-bold' : 'hover:bg-[hsl(210,15%,94%)] text-[hsl(215,25%,18%)]'}
              `}
            >
              {day}
              {hasViewings && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#8B1A2B]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Today button */}
      <button
        onClick={goToday}
        className="mt-2 w-full text-[10px] font-semibold text-[#8B1A2B] hover:bg-[#8B1A2B]/5 py-1 rounded-md transition-colors"
      >
        Today
      </button>
    </div>
  );
}

type CalendarViewMode = 'day' | 'week' | 'month';

export default function AgentViewingsClient() {
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [calendarMode, setCalendarMode] = useState<CalendarViewMode>('week');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [selectedViewing, setSelectedViewing] = useState<Viewing | null>(null);
  const [bulkEmailState, setBulkEmailState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [bulkEmailMessage, setBulkEmailMessage] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [filterAgent, setFilterAgent] = useState<string>('All');
  const [pdfSendState, setPdfSendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [showBulkPdfModal, setShowBulkPdfModal] = useState(false);
  const [bulkPdfState, setBulkPdfState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [bulkPdfMessage, setBulkPdfMessage] = useState('');
  const [realtimeBadge, setRealtimeBadge] = useState<string | null>(null);
  const [showMiniCal, setShowMiniCal] = useState(false);

  // ── Real-time: viewings ────────────────────────────────────────────────────
  const handleViewingChange = useCallback((event: RealtimeEvent, row: Record<string, unknown>) => {
    const dateStr = (row.viewing_date as string) ?? '';
    if (event === 'INSERT') {
      toast.info(`New viewing scheduled${dateStr ? ` on ${dateStr}` : ''}`, { id: `av-insert-${row.id}` });
      setRealtimeBadge('New viewing added');
    } else if (event === 'UPDATE') {
      toast.success(`Viewing updated${dateStr ? ` (${dateStr})` : ''}`, { id: `av-update-${row.id}` });
      setRealtimeBadge('Viewing updated');
    } else if (event === 'DELETE') {
      toast.warning('A viewing was cancelled', { id: `av-delete-${row.id}` });
      setRealtimeBadge('Viewing cancelled');
    }
    setTimeout(() => setRealtimeBadge(null), 4000);
  }, []);

  // ── Real-time: properties ──────────────────────────────────────────────────
  const handlePropertyChange = useCallback((event: RealtimeEvent, row: Record<string, unknown>) => {
    if (event === 'UPDATE') {
      const ref = (row.property_ref as string) ?? '';
      toast.success(`Property updated${ref ? `: ${ref}` : ''}`, { id: `av-prop-update-${row.id}` });
    }
  }, []);

  useViewingsRealtime(handleViewingChange);
  usePropertiesRealtime(handlePropertyChange);

  const agents = ['All', ...Array.from(new Set(VIEWINGS.map((v) => v.agent)))];
  const filteredViewings = VIEWINGS.filter((v) => filterAgent === 'All' || v.agent === filterAgent);

  // Dates to show in the date strip based on calendarMode
  const dates = useMemo(() => {
    if (calendarMode === 'day') return getDatesForDay(selectedDate);
    if (calendarMode === 'week') return getDatesForWeek(selectedDate);
    return getDatesForMonth(selectedDate);
  }, [calendarMode, selectedDate]);

  const viewingDates = useMemo(() => new Set(VIEWINGS.map(v => v.date)), []);

  const viewingsByDate = useMemo(() => {
    return dates.reduce<Record<string, Viewing[]>>((acc, d) => {
      acc[d] = filteredViewings.filter((v) => v.date === d);
      return acc;
    }, {});
  }, [dates, filteredViewings]);

  const calendarViewings = filteredViewings.filter((v) => v.date === selectedDate);
  const listViewings = filteredViewings;

  // Navigation helpers
  function navigatePrev() {
    const d = new Date(selectedDate + 'T00:00:00');
    if (calendarMode === 'day') d.setDate(d.getDate() - 1);
    else if (calendarMode === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setSelectedDate(toDateStr(d));
  }

  function navigateNext() {
    const d = new Date(selectedDate + 'T00:00:00');
    if (calendarMode === 'day') d.setDate(d.getDate() + 1);
    else if (calendarMode === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setSelectedDate(toDateStr(d));
  }

  function getNavLabel(): string {
    if (calendarMode === 'day') return formatDateFull(selectedDate);
    if (calendarMode === 'week') {
      const weekDates = getDatesForWeek(selectedDate);
      const first = weekDates[0];
      const last = weekDates[6];
      const fd = new Date(first + 'T00:00:00');
      const ld = new Date(last + 'T00:00:00');
      const sameMonth = fd.getMonth() === ld.getMonth();
      if (sameMonth) {
        return `${fd.getDate()} – ${ld.getDate()} ${ld.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
      }
      return `${fd.getDate()} ${fd.toLocaleDateString('en-GB', { month: 'short' })} – ${ld.getDate()} ${ld.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`;
    }
    // month
    const d = new Date(selectedDate + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  async function handleBulkEmail() {
    setBulkEmailState('sending');
    const targets = filteredViewings.filter((v) => v.status !== 'Cancelled');
    let successCount = 0;
    let failCount = 0;

    for (const viewing of targets) {
      const body = `Dear ${viewing.client.name},\n\nThis is a reminder of your upcoming property viewing:\n\n📍 Property: ${viewing.property.address}, ${viewing.property.village}\nRef: ${viewing.property.ref}\n📅 Date: ${formatDateFull(viewing.date)}\n⏰ Time: ${viewing.time} – ${viewing.endTime}\n👤 Agent: ${viewing.agent}\n💰 ${viewing.property.price}\n\n${viewing.notes ? `Notes: ${viewing.notes}\n\n` : ''}Please contact us if you need to reschedule.\n\nBest regards,\nHomes R Us Team`;

      try {
        const res = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: viewing.client.email,
            subject: `Viewing Reminder: ${viewing.property.address} on ${formatDateFull(viewing.date)} at ${viewing.time}`,
            body,
            fromName: 'Homes R Us',
          }),
        });
        if (res.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    if (failCount === 0) {
      setBulkEmailState('sent');
      setBulkEmailMessage(`✓ ${successCount} reminder${successCount !== 1 ? 's' : ''} sent successfully.`);
    } else {
      setBulkEmailState('error');
      setBulkEmailMessage(`${successCount} sent, ${failCount} failed. Check email settings.`);
    }
  }

  async function handleSendSchedulePdf(viewing: Viewing) {
    setPdfSendState('sending');
    try {
      const res = await fetch('/api/send-viewing-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: viewing.client,
          property: viewing.property,
          date: viewing.date,
          time: viewing.time,
          endTime: viewing.endTime,
          agent: viewing.agent,
          status: viewing.status,
          notes: viewing.notes,
        }),
      });
      if (res.ok) {
        setPdfSendState('sent');
      } else {
        setPdfSendState('error');
      }
    } catch {
      setPdfSendState('error');
    }
  }

  async function handleBulkPdf() {
    setBulkPdfState('sending');
    const targets = filteredViewings.filter((v) => v.status !== 'Cancelled');
    let successCount = 0;
    let failCount = 0;

    for (const viewing of targets) {
      try {
        const res = await fetch('/api/send-viewing-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client: viewing.client,
            property: viewing.property,
            date: viewing.date,
            time: viewing.time,
            endTime: viewing.endTime,
            agent: viewing.agent,
            status: viewing.status,
            notes: viewing.notes,
          }),
        });
        if (res.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    if (failCount === 0) {
      setBulkPdfState('sent');
      setBulkPdfMessage(`✓ ${successCount} schedule${successCount !== 1 ? 's' : ''} sent successfully.`);
    } else {
      setBulkPdfState('error');
      setBulkPdfMessage(`${successCount} sent, ${failCount} failed. Check email settings.`);
    }
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-full min-h-screen bg-[hsl(210,20%,97%)]">
        {/* Header */}
        <div className="bg-white border-b border-[hsl(214,20%,88%)] px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Agent Viewings</h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <p className="text-sm text-[hsl(215,15%,52%)]">
                  {filteredViewings.filter((v) => v.status !== 'Cancelled').length} upcoming viewings scheduled
                </p>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
                {realtimeBadge && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[9px] font-semibold animate-pulse">
                    <Icon name="RefreshCwIcon" size={9} />
                    {realtimeBadge}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Agent filter */}
              <select
                value={filterAgent}
                onChange={(e) => setFilterAgent(e.target.value)}
                className="text-sm border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 bg-white text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/20"
              >
                {agents.map((a) => (
                  <option key={a} value={a}>{a === 'All' ? 'All Agents' : a}</option>
                ))}
              </select>

              {/* View toggle: Calendar / List */}
              <div className="flex items-center bg-[hsl(210,15%,94%)] rounded-lg p-1">
                <button
                  onClick={() => setView('calendar')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'calendar' ? 'bg-white text-[#8B1A2B] shadow-sm' : 'text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)]'}`}
                >
                  <Icon name="CalendarIcon" size={14} />
                  Calendar
                </button>
                <button
                  onClick={() => setView('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'list' ? 'bg-white text-[#8B1A2B] shadow-sm' : 'text-[hsl(215,15%,52%)] hover:text-[hsl(215,25%,18%)]'}`}
                >
                  <Icon name="ListIcon" size={14} />
                  List
                </button>
              </div>

              {/* Bulk send schedule PDFs */}
              <button
                onClick={() => { setShowBulkPdfModal(true); setBulkPdfState('idle'); setBulkPdfMessage(''); }}
                className="flex items-center gap-2 px-4 py-2 bg-[#1B4F8A] text-white text-sm font-medium rounded-lg hover:bg-[#163f6e] transition-colors"
              >
                <Icon name="FileTextIcon" size={14} />
                Send Schedule PDFs
              </button>

              {/* Bulk email */}
              <button
                onClick={() => { setShowBulkModal(true); setBulkEmailState('idle'); setBulkEmailMessage(''); }}
                className="flex items-center gap-2 px-4 py-2 bg-[#8B1A2B] text-white text-sm font-medium rounded-lg hover:bg-[#7a1625] transition-colors"
              >
                <Icon name="MailIcon" size={14} />
                Send Reminders
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6">
          {/* ── CALENDAR VIEW ── */}
          {view === 'calendar' && (
            <div className="flex gap-5 h-full">
              {/* Left sidebar: mini calendar + date strip */}
              <div className="flex flex-col gap-3 min-w-[220px]">
                {/* Mini calendar picker */}
                <MiniCalendar
                  selectedDate={selectedDate}
                  onSelect={(d) => { setSelectedDate(d); setShowMiniCal(false); }}
                  viewingDates={viewingDates}
                />

                {/* Day/Week/Month toggle */}
                <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-1 flex flex-col gap-0.5">
                  {(['day', 'week', 'month'] as CalendarViewMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setCalendarMode(mode)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                        calendarMode === mode
                          ? 'bg-[#8B1A2B] text-white'
                          : 'text-[hsl(215,15%,52%)] hover:bg-[hsl(210,15%,94%)] hover:text-[hsl(215,25%,18%)]'
                      }`}
                    >
                      <Icon
                        name={mode === 'day' ? 'CalendarDaysIcon' : mode === 'week' ? 'CalendarIcon' : 'LayoutGridIcon'}
                        size={14}
                      />
                      {mode}
                    </button>
                  ))}
                </div>

                {/* Date strip for week/month modes */}
                {calendarMode === 'week' && (
                  <div className="flex flex-col gap-1.5">
                    {dates.map((d) => {
                      const { day, weekday, month } = formatDateLabel(d);
                      const count = viewingsByDate[d]?.length ?? 0;
                      const isSelected = d === selectedDate;
                      const isToday = d === getTodayStr();
                      return (
                        <button
                          key={d}
                          onClick={() => setSelectedDate(d)}
                          className={`flex items-center gap-2 py-2 px-3 rounded-xl border transition-all ${
                            isSelected
                              ? 'bg-[#8B1A2B] border-[#8B1A2B] text-white shadow-md'
                              : isToday
                              ? 'bg-[#8B1A2B]/5 border-[#8B1A2B]/30 text-[hsl(215,25%,18%)]'
                              : 'bg-white border-[hsl(214,20%,88%)] text-[hsl(215,25%,18%)] hover:border-[#8B1A2B]/40'
                          }`}
                        >
                          <span className={`text-[10px] font-semibold uppercase w-7 ${isSelected ? 'text-white/80' : 'text-[hsl(215,15%,52%)]'}`}>{weekday}</span>
                          <span className="text-sm font-bold">{day}</span>
                          <span className={`text-[10px] ${isSelected ? 'text-white/70' : 'text-[hsl(215,15%,52%)]'}`}>{month}</span>
                          {count > 0 && (
                            <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-[#8B1A2B]/10 text-[#8B1A2B]'}`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Main content area */}
              <div className="flex-1 min-w-0">
                {/* Navigation bar */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={navigatePrev}
                      className="p-1.5 rounded-lg border border-[hsl(214,20%,88%)] bg-white hover:bg-[hsl(210,15%,94%)] transition-colors"
                    >
                      <Icon name="ChevronLeftIcon" size={14} className="text-[hsl(215,15%,52%)]" />
                    </button>
                    <button
                      onClick={() => setSelectedDate(getTodayStr())}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[hsl(214,20%,88%)] bg-white hover:bg-[hsl(210,15%,94%)] text-[hsl(215,25%,18%)] transition-colors"
                    >
                      Today
                    </button>
                    <button
                      onClick={navigateNext}
                      className="p-1.5 rounded-lg border border-[hsl(214,20%,88%)] bg-white hover:bg-[hsl(210,15%,94%)] transition-colors"
                    >
                      <Icon name="ChevronRightIcon" size={14} className="text-[hsl(215,15%,52%)]" />
                    </button>
                    <h2 className="text-sm font-semibold text-[hsl(215,25%,18%)] ml-1">{getNavLabel()}</h2>
                  </div>
                  <span className="text-sm text-[hsl(215,15%,52%)]">
                    {calendarMode === 'day'
                      ? `${calendarViewings.length} viewing${calendarViewings.length !== 1 ? 's' : ''}`
                      : `${dates.reduce((sum, d) => sum + (viewingsByDate[d]?.length ?? 0), 0)} viewings`}
                  </span>
                </div>

                {/* Day mode: show selected day's viewings */}
                {calendarMode === 'day' && (
                  <>
                    {calendarViewings.length === 0 ? (
                      <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] flex flex-col items-center justify-center py-16 text-center">
                        <Icon name="CalendarIcon" size={36} className="text-[hsl(214,20%,80%)] mb-3" />
                        <p className="text-sm font-medium text-[hsl(215,25%,18%)]">No viewings scheduled</p>
                        <p className="text-xs text-[hsl(215,15%,52%)] mt-1">Select another date or adjust the agent filter</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {calendarViewings.map((v) => (
                          <ViewingCard key={v.id} viewing={v} onClick={() => setSelectedViewing(v)} />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Week mode: show selected day's viewings (date strip on left handles week nav) */}
                {calendarMode === 'week' && (
                  <>
                    {calendarViewings.length === 0 ? (
                      <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] flex flex-col items-center justify-center py-16 text-center">
                        <Icon name="CalendarIcon" size={36} className="text-[hsl(214,20%,80%)] mb-3" />
                        <p className="text-sm font-medium text-[hsl(215,25%,18%)]">No viewings on this day</p>
                        <p className="text-xs text-[hsl(215,15%,52%)] mt-1">Select another day from the week strip</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {calendarViewings.map((v) => (
                          <ViewingCard key={v.id} viewing={v} onClick={() => setSelectedViewing(v)} />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Month mode: show all days with viewings in a grouped list */}
                {calendarMode === 'month' && (
                  <div className="flex flex-col gap-5">
                    {dates.filter(d => (viewingsByDate[d]?.length ?? 0) > 0).length === 0 ? (
                      <div className="bg-white rounded-xl border border-[hsl(214,20%,88%)] flex flex-col items-center justify-center py-16 text-center">
                        <Icon name="CalendarIcon" size={36} className="text-[hsl(214,20%,80%)] mb-3" />
                        <p className="text-sm font-medium text-[hsl(215,25%,18%)]">No viewings this month</p>
                        <p className="text-xs text-[hsl(215,15%,52%)] mt-1">Navigate to another month or adjust the agent filter</p>
                      </div>
                    ) : (
                      dates.map((d) => {
                        const dayViewings = viewingsByDate[d];
                        if (!dayViewings || dayViewings.length === 0) return null;
                        const isToday = d === getTodayStr();
                        return (
                          <div key={d}>
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className={`text-sm font-semibold ${isToday ? 'text-[#8B1A2B]' : 'text-[hsl(215,25%,18%)]'}`}>
                                {formatDateFull(d)}
                                {isToday && <span className="ml-2 text-[10px] bg-[#8B1A2B]/10 text-[#8B1A2B] px-1.5 py-0.5 rounded-full font-bold">Today</span>}
                              </h3>
                              <span className="text-xs bg-[#8B1A2B]/10 text-[#8B1A2B] font-semibold px-2 py-0.5 rounded-full">{dayViewings.length}</span>
                            </div>
                            <div className="flex flex-col gap-2">
                              {dayViewings.map((v) => (
                                <ViewingCard key={v.id} viewing={v} onClick={() => setSelectedViewing(v)} />
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── LIST VIEW ── */}
          {view === 'list' && (
            <div className="flex flex-col gap-6">
              {Array.from(new Set(listViewings.map(v => v.date))).sort().map((d) => {
                const dayViewings = listViewings.filter(v => v.date === d);
                if (dayViewings.length === 0) return null;
                return (
                  <div key={d}>
                    <div className="flex items-center gap-3 mb-3">
                      <h2 className="text-sm font-semibold text-[hsl(215,25%,18%)]">{formatDateFull(d)}</h2>
                      <span className="text-xs bg-[#8B1A2B]/10 text-[#8B1A2B] font-semibold px-2 py-0.5 rounded-full">{dayViewings.length}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {dayViewings.map((v) => (
                        <ViewingCard key={v.id} viewing={v} onClick={() => setSelectedViewing(v)} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── VIEWING DETAIL MODAL ── */}
      {selectedViewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(214,20%,88%)]">
              <div>
                <h2 className="text-base font-bold text-[hsl(215,25%,18%)]">Viewing Details</h2>
                <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">{selectedViewing.property.ref}</p>
              </div>
              <button onClick={() => { setSelectedViewing(null); setPdfSendState('idle'); }} className="p-2 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors">
                <Icon name="XIcon" size={16} className="text-[hsl(215,15%,52%)]" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Time slot */}
              <div className="flex items-center gap-3 bg-[hsl(210,20%,97%)] rounded-xl p-4">
                <div className="w-10 h-10 rounded-full bg-[#8B1A2B]/10 flex items-center justify-center flex-shrink-0">
                  <Icon name="ClockIcon" size={18} className="text-[#8B1A2B]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{selectedViewing.time} – {selectedViewing.endTime}</p>
                  <p className="text-xs text-[hsl(215,15%,52%)]">{formatDateFull(selectedViewing.date)}</p>
                </div>
                <span className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[selectedViewing.status]}`}>
                  {selectedViewing.status}
                </span>
              </div>

              {/* Property */}
              <div>
                <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-2">Property</p>
                <div className="bg-[hsl(210,20%,97%)] rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{selectedViewing.property.address}</p>
                      <p className="text-xs text-[hsl(215,15%,52%)]">{selectedViewing.property.village} · {selectedViewing.property.phase}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${TYPE_COLORS[selectedViewing.property.type]}`}>
                      {selectedViewing.property.type}
                    </span>
                  </div>
                  <p className="text-base font-bold text-[#1B4F8A]">{selectedViewing.property.price}</p>
                  <div className="flex items-center gap-4 text-xs text-[hsl(215,15%,52%)]">
                    <span className="flex items-center gap-1"><Icon name="BedDoubleIcon" size={12} />{selectedViewing.property.beds} bed</span>
                    <span className="flex items-center gap-1"><Icon name="ShowerHeadIcon" size={12} />{selectedViewing.property.baths} bath</span>
                    <span className="flex items-center gap-1"><Icon name="SquareIcon" size={12} />{selectedViewing.property.sqft} ft²</span>
                  </div>
                </div>
              </div>

              {/* Client */}
              <div>
                <p className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-2">Client</p>
                <div className="bg-[hsl(210,20%,97%)] rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#1B4F8A]/10 flex items-center justify-center text-[#1B4F8A] font-bold text-sm flex-shrink-0">
                      {selectedViewing.client.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">{selectedViewing.client.name}</p>
                      <p className="text-xs text-[hsl(215,15%,52%)]">{selectedViewing.client.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[hsl(215,15%,52%)]">
                    <Icon name="PhoneIcon" size={12} />
                    <span>{selectedViewing.client.phone}</span>
                  </div>
                </div>
              </div>

              {/* Agent */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-[hsl(215,15%,52%)]">Assigned Agent</span>
                <span className="font-semibold text-[hsl(215,25%,18%)]">{selectedViewing.agent}</span>
              </div>

              {/* Notes */}
              {selectedViewing.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1">Notes</p>
                  <p className="text-xs text-amber-800">{selectedViewing.notes}</p>
                </div>
              )}
            </div>

            <div className="px-6 pb-5 flex flex-col gap-2">
              {pdfSendState === 'idle' && (
                <button
                  onClick={() => handleSendSchedulePdf(selectedViewing)}
                  className="w-full py-2.5 bg-[#1B4F8A] text-white text-sm font-semibold rounded-xl hover:bg-[#163f6e] transition-colors flex items-center justify-center gap-2"
                >
                  <Icon name="FileTextIcon" size={14} />
                  Send Schedule PDF to Client
                </button>
              )}
              {pdfSendState === 'sending' && (
                <div className="w-full py-2.5 bg-[#1B4F8A]/10 rounded-xl flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-[#1B4F8A]/30 border-t-[#1B4F8A] rounded-full animate-spin" />
                  <span className="text-sm font-medium text-[#1B4F8A]">Sending schedule…</span>
                </div>
              )}
              {pdfSendState === 'sent' && (
                <div className="w-full py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center gap-2">
                  <Icon name="CheckIcon" size={14} className="text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-700">Schedule sent to {selectedViewing.client.name}</span>
                </div>
              )}
              {pdfSendState === 'error' && (
                <div className="w-full py-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-center gap-2">
                  <Icon name="AlertCircleIcon" size={14} className="text-red-600" />
                  <span className="text-sm font-semibold text-red-700">Failed to send. Try again.</span>
                </div>
              )}
              <button
                onClick={() => { setSelectedViewing(null); setPdfSendState('idle'); }}
                className="w-full py-2.5 rounded-xl border border-[hsl(214,20%,88%)] text-sm font-medium text-[hsl(215,25%,18%)] hover:bg-[hsl(210,15%,94%)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BULK EMAIL MODAL ── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(214,20%,88%)]">
              <div>
                <h2 className="text-base font-bold text-[hsl(215,25%,18%)]">Send Viewing Reminders</h2>
                <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">Email all clients with confirmed or pending viewings</p>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="p-2 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors">
                <Icon name="XIcon" size={16} className="text-[hsl(215,15%,52%)]" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {bulkEmailState === 'idle' && (
                <>
                  <div className="bg-[hsl(210,20%,97%)] rounded-xl p-4 space-y-2">
                    <p className="text-sm font-semibold text-[hsl(215,25%,18%)]">Recipients</p>
                    {filteredViewings.filter((v) => v.status !== 'Cancelled').map((v) => (
                      <div key={v.id} className="flex items-center justify-between text-xs">
                        <span className="text-[hsl(215,25%,18%)] font-medium">{v.client.name}</span>
                        <span className="text-[hsl(215,15%,52%)]">{v.client.email}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-[hsl(215,15%,52%)]">
                    Each client will receive a personalised reminder with their property address, date, time, and assigned agent.
                  </p>
                  <button
                    onClick={handleBulkEmail}
                    className="w-full py-2.5 bg-[#8B1A2B] text-white text-sm font-semibold rounded-xl hover:bg-[#7a1625] transition-colors flex items-center justify-center gap-2"
                  >
                    <Icon name="SendIcon" size={14} />
                    Send {filteredViewings.filter((v) => v.status !== 'Cancelled').length} Reminders
                  </button>
                </>
              )}

              {bulkEmailState === 'sending' && (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="w-10 h-10 border-4 border-[#8B1A2B]/20 border-t-[#8B1A2B] rounded-full animate-spin" />
                  <p className="text-sm font-medium text-[hsl(215,25%,18%)]">Sending reminders…</p>
                </div>
              )}

              {(bulkEmailState === 'sent' || bulkEmailState === 'error') && (
                <div className={`flex flex-col items-center py-8 gap-3 text-center ${bulkEmailState === 'sent' ? 'text-emerald-700' : 'text-red-700'}`}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bulkEmailState === 'sent' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                    <Icon name={bulkEmailState === 'sent' ? 'CheckIcon' : 'AlertCircleIcon'} size={24} />
                  </div>
                  <p className="text-sm font-semibold">{bulkEmailMessage}</p>
                  <button
                    onClick={() => setShowBulkModal(false)}
                    className="mt-2 px-6 py-2 rounded-xl border border-[hsl(214,20%,88%)] text-sm font-medium text-[hsl(215,25%,18%)] hover:bg-[hsl(210,15%,94%)] transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── BULK SCHEDULE PDF MODAL ── */}
      {showBulkPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[hsl(214,20%,88%)]">
              <div>
                <h2 className="text-base font-bold text-[hsl(215,25%,18%)]">Send Viewing Schedule PDFs</h2>
                <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">Send formatted schedule emails to all clients</p>
              </div>
              <button onClick={() => setShowBulkPdfModal(false)} className="p-2 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors">
                <Icon name="XIcon" size={16} className="text-[hsl(215,15%,52%)]" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {bulkPdfState === 'idle' && (
                <>
                  <div className="bg-[hsl(210,20%,97%)] rounded-xl p-4 space-y-2">
                    <p className="text-sm font-semibold text-[hsl(215,25%,18%)] mb-3">Recipients</p>
                    {filteredViewings.filter((v) => v.status !== 'Cancelled').map((v) => (
                      <div key={v.id} className="flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[hsl(215,25%,18%)] font-medium">{v.client.name}</span>
                          <span className="text-[hsl(215,15%,52%)] ml-2">· {v.property.ref}</span>
                        </div>
                        <span className="text-[hsl(215,15%,52%)]">{v.client.email}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-[hsl(215,15%,52%)]">
                    Each client will receive a formatted viewing schedule with property details, time slot, and agent contact information.
                  </p>
                  <button
                    onClick={handleBulkPdf}
                    className="w-full py-2.5 bg-[#1B4F8A] text-white text-sm font-semibold rounded-xl hover:bg-[#163f6e] transition-colors flex items-center justify-center gap-2"
                  >
                    <Icon name="FileTextIcon" size={14} />
                    Send {filteredViewings.filter((v) => v.status !== 'Cancelled').length} Schedule PDFs
                  </button>
                </>
              )}

              {bulkPdfState === 'sending' && (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="w-10 h-10 border-4 border-[#1B4F8A]/20 border-t-[#1B4F8A] rounded-full animate-spin" />
                  <p className="text-sm font-medium text-[hsl(215,25%,18%)]">Sending schedule PDFs…</p>
                </div>
              )}

              {(bulkPdfState === 'sent' || bulkPdfState === 'error') && (
                <div className={`flex flex-col items-center py-8 gap-3 text-center ${bulkPdfState === 'sent' ? 'text-emerald-700' : 'text-red-700'}`}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bulkPdfState === 'sent' ? 'bg-emerald-100' : 'bg-red-100'}`}>
                    <Icon name={bulkPdfState === 'sent' ? 'CheckIcon' : 'AlertCircleIcon'} size={24} />
                  </div>
                  <p className="text-sm font-semibold">{bulkPdfMessage}</p>
                  <button
                    onClick={() => setShowBulkPdfModal(false)}
                    className="mt-2 px-6 py-2 rounded-xl border border-[hsl(214,20%,88%)] text-sm font-medium text-[hsl(215,25%,18%)] hover:bg-[hsl(210,15%,94%)] transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

interface ViewingCardProps {
  viewing: Viewing;
  onClick: () => void;
}

function ViewingCard({ viewing, onClick }: ViewingCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-4 flex items-start gap-4 hover:border-[#8B1A2B]/30 hover:shadow-sm transition-all cursor-pointer group"
    >
      {/* Time */}
      <div className="text-center min-w-[52px] flex-shrink-0">
        <p className="text-sm font-bold text-[#1B4F8A] font-mono">{viewing.time}</p>
        <p className="text-[10px] text-[hsl(215,15%,52%)] font-mono">–{viewing.endTime}</p>
      </div>

      <div className="w-px self-stretch bg-[hsl(214,20%,88%)] flex-shrink-0" />

      {/* Property info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-semibold text-[hsl(215,25%,18%)] truncate">{viewing.property.address}</p>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${TYPE_COLORS[viewing.property.type]}`}>
            {viewing.property.type}
          </span>
        </div>
        <p className="text-xs text-[hsl(215,15%,52%)] mb-2">{viewing.property.village} · {viewing.property.phase} · Ref {viewing.property.ref}</p>
        <div className="flex items-center gap-3 text-xs text-[hsl(215,15%,52%)]">
          <span className="flex items-center gap-1"><Icon name="BedDoubleIcon" size={11} />{viewing.property.beds}bd</span>
          <span className="flex items-center gap-1"><Icon name="ShowerHeadIcon" size={11} />{viewing.property.baths}ba</span>
          <span className="flex items-center gap-1"><Icon name="SquareIcon" size={11} />{viewing.property.sqft}ft²</span>
          <span className="font-semibold text-[#1B4F8A] ml-1">{viewing.property.price}</span>
        </div>
      </div>

      {/* Client + agent + status */}
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[viewing.status]}`}>
          {viewing.status}
        </span>
        <div className="text-right">
          <p className="text-xs font-medium text-[hsl(215,25%,18%)]">{viewing.client.name}</p>
          <p className="text-[10px] text-[hsl(215,15%,52%)]">{viewing.agent}</p>
        </div>
        <Icon name="ChevronRightIcon" size={14} className="text-[hsl(214,20%,80%)] group-hover:text-[#8B1A2B] transition-colors" />
      </div>
    </div>
  );
}
