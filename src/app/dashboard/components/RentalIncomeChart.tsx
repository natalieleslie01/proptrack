'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { usePropertiesRealtime } from '@/hooks/useRealtimeSync';

interface MonthlyData {
  month: string;
  income: number;
  transactions: number;
}

function formatHKD(value: number) {
  if (value >= 1000000) return `HK$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `HK$${(value / 1000).toFixed(0)}K`;
  return `HK$${value}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl shadow-modal p-3 min-w-[160px]">
      <p className="text-xs font-semibold text-[hsl(215,15%,52%)] mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between items-center gap-4">
          <span className="text-xs text-[hsl(215,15%,52%)]">Rental Income</span>
          <span className="text-sm font-bold text-[#1B4F8A] tabular-nums">{formatHKD(payload[0]?.value || 0)}</span>
        </div>
        {payload[1] && (
          <div className="flex justify-between items-center gap-4">
            <span className="text-xs text-[hsl(215,15%,52%)]">Properties</span>
            <span className="text-sm font-bold text-[#C9A84C] tabular-nums">{payload[1].value}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function RentalIncomeChart() {
  const [data, setData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();

      // Fetch leased properties with asking_rent and lease_start
      const { data: props } = await supabase
        .from('properties')
        .select('asking_rent, lease_start, occupancy')
        .eq('occupancy', 'leased')
        .not('asking_rent', 'is', null)
        .not('lease_start', 'is', null);

      if (!props || props.length === 0) {
        // Build empty 12-month chart from current month going back
        const now = new Date();
        const months: MonthlyData[] = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months.push({ month: MONTH_LABELS[d.getMonth()], income: 0, transactions: 0 });
        }
        setData(months);
        setLoading(false);
        return;
      }

      // Build last 12 months buckets
      const now = new Date();
      const buckets: Record<string, { income: number; transactions: number; label: string }> = {};
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        buckets[key] = { income: 0, transactions: 0, label: MONTH_LABELS[d.getMonth()] };
      }

      props.forEach(p => {
        if (!p.lease_start || !p.asking_rent) return;
        // Parse DD/MM/YYYY or YYYY-MM-DD
        let leaseDate: Date;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(p.lease_start)) {
          const [dd, mm, yyyy] = p.lease_start.split('/');
          leaseDate = new Date(`${yyyy}-${mm}-${dd}`);
        } else {
          leaseDate = new Date(p.lease_start);
        }
        if (isNaN(leaseDate.getTime())) return;

        const key = `${leaseDate.getFullYear()}-${String(leaseDate.getMonth() + 1).padStart(2, '0')}`;
        if (buckets[key]) {
          buckets[key].income += p.asking_rent;
          buckets[key].transactions += 1;
        }
      });

      const chartData = Object.entries(buckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => ({ month: v.label, income: v.income, transactions: v.transactions }));

      // Build date range label
      const keys = Object.keys(buckets).sort();
      if (keys.length >= 2) {
        const [startYear, startMonth] = keys[0].split('-');
        const [endYear, endMonth] = keys[keys.length - 1].split('-');
        setDateRange(`${MONTH_LABELS[parseInt(startMonth) - 1]} ${startYear} – ${MONTH_LABELS[parseInt(endMonth) - 1]} ${endYear}`);
      }

      setData(chartData);
    } catch (err) {
      console.error('RentalIncomeChart fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Real-time: refetch chart when properties change ────────────────────────
  usePropertiesRealtime(() => {
    fetchData();
  });

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-[hsl(215,25%,18%)]">Monthly Rental Income</h2>
          <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">{dateRange || 'Last 12 months · All Districts'}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#1B4F8A]" />
            <span className="text-xs text-[hsl(215,15%,52%)]">Income</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#C9A84C]" />
            <span className="text-xs text-[hsl(215,15%,52%)]">Properties</span>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="h-[240px] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#1B4F8A] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1B4F8A" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#1B4F8A" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,92%)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: 'hsl(215,15%,52%)', fontFamily: 'DM Sans' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatHKD}
              tick={{ fontSize: 11, fill: 'hsl(215,15%,52%)', fontFamily: 'DM Sans' }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="income"
              stroke="#1B4F8A"
              strokeWidth={2}
              fill="url(#incomeGrad)"
              dot={false}
              activeDot={{ r: 4, fill: '#1B4F8A', stroke: 'white', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}