'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentMetric {
  id: string;
  name: string;
  avatar: string;
  enquiriesHandled: number;
  replyRate: number;
  conversionToViewing: number;
  avgResponseTime: string;
  avgResponseMinutes: number;
  closedDeals: number;
  trend: 'up' | 'down' | 'flat';
}

interface MonthlyDataPoint {
  month: string;
  enquiries: number;
  viewings: number;
  closedDeals: number;
  avgReplyRate: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const agents: AgentMetric[] = [
  {
    id: 'a1',
    name: 'Natalie Leslie',
    avatar: 'NL',
    enquiriesHandled: 142,
    replyRate: 94,
    conversionToViewing: 38,
    avgResponseTime: '18 min',
    avgResponseMinutes: 18,
    closedDeals: 11,
    trend: 'up',
  },
  {
    id: 'a2',
    name: 'Nicola Baird',
    avatar: 'NB',
    enquiriesHandled: 118,
    replyRate: 87,
    conversionToViewing: 31,
    avgResponseTime: '34 min',
    avgResponseMinutes: 34,
    closedDeals: 8,
    trend: 'up',
  },
  {
    id: 'a3',
    name: 'Cris Yan',
    avatar: 'CY',
    enquiriesHandled: 97,
    replyRate: 91,
    conversionToViewing: 42,
    avgResponseTime: '22 min',
    avgResponseMinutes: 22,
    closedDeals: 14,
    trend: 'up',
  },
  {
    id: 'a4',
    name: 'David Chan',
    avatar: 'DC',
    enquiriesHandled: 83,
    replyRate: 76,
    conversionToViewing: 24,
    avgResponseTime: '1 hr 12 min',
    avgResponseMinutes: 72,
    closedDeals: 5,
    trend: 'down',
  },
  {
    id: 'a5',
    name: 'Fiona Ng',
    avatar: 'FN',
    enquiriesHandled: 109,
    replyRate: 89,
    conversionToViewing: 35,
    avgResponseTime: '27 min',
    avgResponseMinutes: 27,
    closedDeals: 9,
    trend: 'flat',
  },
  {
    id: 'a6',
    name: 'James Leung',
    avatar: 'JL',
    enquiriesHandled: 74,
    replyRate: 82,
    conversionToViewing: 28,
    avgResponseTime: '45 min',
    avgResponseMinutes: 45,
    closedDeals: 6,
    trend: 'down',
  },
];

const monthlyTrend: MonthlyDataPoint[] = [
  { month: 'Nov', enquiries: 421, viewings: 138, closedDeals: 32, avgReplyRate: 84 },
  { month: 'Dec', enquiries: 387, viewings: 121, closedDeals: 28, avgReplyRate: 82 },
  { month: 'Jan', enquiries: 448, viewings: 152, closedDeals: 35, avgReplyRate: 85 },
  { month: 'Feb', enquiries: 502, viewings: 174, closedDeals: 41, avgReplyRate: 87 },
  { month: 'Mar', enquiries: 534, viewings: 189, closedDeals: 46, avgReplyRate: 88 },
  { month: 'Apr', enquiries: 623, viewings: 218, closedDeals: 53, avgReplyRate: 87 },
];

// ─── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl shadow-modal p-3 min-w-[140px]">
      <p className="text-xs font-semibold text-[hsl(215,15%,52%)] mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex justify-between items-center gap-3">
            <span className="text-xs text-[hsl(215,15%,52%)]">{entry.name}</span>
            <span className="text-xs font-bold tabular-nums" style={{ color: entry.color }}>
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KPI Summary Cards ────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon,
  variant = 'default',
}: {
  label: string;
  value: string;
  sub: string;
  icon: string;
  variant?: 'default' | 'hero' | 'positive' | 'warning';
}) {
  const bg: Record<string, string> = {
    default: 'bg-white border-[hsl(214,20%,88%)]',
    hero: 'bg-[#1B4F8A] border-[#1B4F8A]',
    positive: 'bg-emerald-50 border-emerald-200',
    warning: 'bg-amber-50 border-amber-200',
  };
  const iconBg: Record<string, string> = {
    default: 'bg-[#1B4F8A]/10 text-[#1B4F8A]',
    hero: 'bg-white/20 text-white',
    positive: 'bg-emerald-100 text-emerald-600',
    warning: 'bg-amber-100 text-amber-600',
  };
  const labelColor: Record<string, string> = {
    default: 'text-[hsl(215,15%,52%)]',
    hero: 'text-blue-200',
    positive: 'text-emerald-600',
    warning: 'text-amber-600',
  };
  const valueColor: Record<string, string> = {
    default: 'text-[hsl(215,25%,18%)]',
    hero: 'text-white',
    positive: 'text-emerald-700',
    warning: 'text-amber-700',
  };
  const subColor: Record<string, string> = {
    default: 'text-[hsl(215,15%,52%)]',
    hero: 'text-blue-200',
    positive: 'text-emerald-600',
    warning: 'text-amber-600',
  };

  return (
    <div className={`card ${bg[variant]} p-5 hover:shadow-card-hover transition-shadow duration-200`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg[variant]}`}>
          <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={18} />
        </div>
      </div>
      <p className={`text-xs font-semibold tracking-wider uppercase mb-1 ${labelColor[variant]}`}>{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${valueColor[variant]}`}>{value}</p>
      <p className={`text-xs mt-1 ${subColor[variant]}`}>{sub}</p>
    </div>
  );
}

// ─── Agent Row ────────────────────────────────────────────────────────────────

function AgentRow({ agent, rank }: { agent: AgentMetric; rank: number }) {
  const trendIcon =
    agent.trend === 'up' ? 'TrendingUpIcon' : agent.trend === 'down' ? 'TrendingDownIcon' : 'MinusIcon';
  const trendColor =
    agent.trend === 'up' ? 'text-emerald-600' : agent.trend === 'down' ? 'text-red-500' : 'text-[hsl(215,15%,52%)]';

  const replyColor =
    agent.replyRate >= 90 ? 'text-emerald-600' : agent.replyRate >= 80 ? 'text-amber-600' : 'text-red-500';
  const responseColor =
    agent.avgResponseMinutes <= 30
      ? 'text-emerald-600'
      : agent.avgResponseMinutes <= 60
      ? 'text-amber-600' :'text-red-500';

  return (
    <tr className="border-b border-[hsl(214,20%,92%)] hover:bg-[hsl(210,15%,97%)] transition-colors">
      <td className="py-3 px-4">
        <span className="text-sm font-bold text-[hsl(215,15%,52%)] tabular-nums">#{rank}</span>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#1B4F8A] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {agent.avatar}
          </div>
          <span className="text-sm font-semibold text-[hsl(215,25%,18%)]">{agent.name}</span>
        </div>
      </td>
      <td className="py-3 px-4 text-center">
        <span className="text-sm font-bold tabular-nums text-[hsl(215,25%,18%)]">{agent.enquiriesHandled}</span>
      </td>
      <td className="py-3 px-4 text-center">
        <span className={`text-sm font-bold tabular-nums ${replyColor}`}>{agent.replyRate}%</span>
      </td>
      <td className="py-3 px-4 text-center">
        <span className="text-sm font-bold tabular-nums text-[hsl(215,25%,18%)]">{agent.conversionToViewing}%</span>
      </td>
      <td className="py-3 px-4 text-center">
        <span className={`text-sm font-bold tabular-nums ${responseColor}`}>{agent.avgResponseTime}</span>
      </td>
      <td className="py-3 px-4 text-center">
        <span className="text-sm font-bold tabular-nums text-[hsl(215,25%,18%)]">{agent.closedDeals}</span>
      </td>
      <td className="py-3 px-4 text-center">
        <Icon name={trendIcon as Parameters<typeof Icon>[0]['name']} size={16} className={trendColor} />
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type SortKey = 'enquiriesHandled' | 'replyRate' | 'conversionToViewing' | 'avgResponseMinutes' | 'closedDeals';

export default function AgentMetricsClient() {
  const [sortKey, setSortKey] = useState<SortKey>('closedDeals');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sorted = [...agents].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortDir === 'desc' ? -diff : diff;
  });

  // Team-level KPIs
  const totalEnquiries = agents.reduce((s, a) => s + a.enquiriesHandled, 0);
  const avgReplyRate = Math.round(agents.reduce((s, a) => s + a.replyRate, 0) / agents.length);
  const avgConversion = Math.round(agents.reduce((s, a) => s + a.conversionToViewing, 0) / agents.length);
  const avgResponse = Math.round(agents.reduce((s, a) => s + a.avgResponseMinutes, 0) / agents.length);
  const totalDeals = agents.reduce((s, a) => s + a.closedDeals, 0);

  const SortIcon = ({ col }: { col: SortKey }) => (
    <Icon
      name={sortKey === col ? (sortDir === 'desc' ? 'ChevronDownIcon' : 'ChevronUpIcon') : 'ChevronsUpDownIcon'}
      size={12}
      className="ml-1 inline-block text-[hsl(215,15%,52%)]"
    />
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[hsl(210,20%,96%)] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Agent Performance</h1>
          <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">Manager view · April 2026</p>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <Icon name="ShieldIcon" size={14} className="text-amber-600" />
          <span className="text-xs font-semibold text-amber-700">Manager Only</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard
          label="Enquiries Handled"
          value={totalEnquiries.toString()}
          sub="Team total this month"
          icon="InboxIcon"
          variant="hero"
        />
        <KpiCard
          label="Avg Reply Rate"
          value={`${avgReplyRate}%`}
          sub="Across all agents"
          icon="MessageSquareIcon"
          variant="positive"
        />
        <KpiCard
          label="Conversion to Viewing"
          value={`${avgConversion}%`}
          sub="Enquiry → viewing booked"
          icon="CalendarCheckIcon"
          variant="default"
        />
        <KpiCard
          label="Avg Response Time"
          value={`${avgResponse} min`}
          sub="First reply to enquiry"
          icon="ClockIcon"
          variant="warning"
        />
        <KpiCard
          label="Closed Deals"
          value={totalDeals.toString()}
          sub="Completed transactions"
          icon="CheckCircleIcon"
          variant="positive"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Enquiries & Viewings Trend */}
        <div className="card bg-white border-[hsl(214,20%,88%)] p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-[hsl(215,25%,18%)]">Enquiries & Viewings</h2>
            <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">Monthly volume · last 6 months</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,92%)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: 'hsl(215,15%,52%)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215,15%,52%)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              />
              <Line
                type="monotone"
                dataKey="enquiries"
                name="Enquiries"
                stroke="#1B4F8A"
                strokeWidth={2}
                dot={{ r: 3, fill: '#1B4F8A' }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="viewings"
                name="Viewings"
                stroke="#C9A84C"
                strokeWidth={2}
                dot={{ r: 3, fill: '#C9A84C' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Closed Deals & Reply Rate */}
        <div className="card bg-white border-[hsl(214,20%,88%)] p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-[hsl(215,25%,18%)]">Closed Deals & Reply Rate</h2>
            <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">Monthly trend · last 6 months</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,92%)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: 'hsl(215,15%,52%)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 10, fill: 'hsl(215,15%,52%)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[70, 100]}
                tick={{ fontSize: 10, fill: 'hsl(215,15%,52%)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar yAxisId="left" dataKey="closedDeals" name="Closed Deals" fill="#1B4F8A" radius={[3, 3, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avgReplyRate"
                name="Reply Rate %"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ r: 3, fill: '#10B981' }}
                activeDot={{ r: 5 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent Table */}
      <div className="card bg-white border-[hsl(214,20%,88%)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(214,20%,88%)]">
          <h2 className="text-base font-semibold text-[hsl(215,25%,18%)]">Agent Breakdown</h2>
          <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">Click column headers to sort</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[hsl(214,20%,88%)] bg-[hsl(210,20%,97%)]">
                <th className="py-3 px-4 text-left text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider w-10">
                  #
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider">
                  Agent
                </th>
                <th
                  className="py-3 px-4 text-center text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider cursor-pointer hover:text-[hsl(215,25%,18%)] select-none"
                  onClick={() => handleSort('enquiriesHandled')}
                >
                  Enquiries <SortIcon col="enquiriesHandled" />
                </th>
                <th
                  className="py-3 px-4 text-center text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider cursor-pointer hover:text-[hsl(215,25%,18%)] select-none"
                  onClick={() => handleSort('replyRate')}
                >
                  Reply Rate <SortIcon col="replyRate" />
                </th>
                <th
                  className="py-3 px-4 text-center text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider cursor-pointer hover:text-[hsl(215,25%,18%)] select-none"
                  onClick={() => handleSort('conversionToViewing')}
                >
                  → Viewing <SortIcon col="conversionToViewing" />
                </th>
                <th
                  className="py-3 px-4 text-center text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider cursor-pointer hover:text-[hsl(215,25%,18%)] select-none"
                  onClick={() => handleSort('avgResponseMinutes')}
                >
                  Avg Response <SortIcon col="avgResponseMinutes" />
                </th>
                <th
                  className="py-3 px-4 text-center text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider cursor-pointer hover:text-[hsl(215,25%,18%)] select-none"
                  onClick={() => handleSort('closedDeals')}
                >
                  Closed Deals <SortIcon col="closedDeals" />
                </th>
                <th className="py-3 px-4 text-center text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wider w-12">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((agent, i) => (
                <AgentRow key={agent.id} agent={agent} rank={i + 1} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
