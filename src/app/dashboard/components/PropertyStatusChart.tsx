'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { usePropertiesChangeListener } from '@/contexts/PropertiesRealtimeContext';

interface DistrictData {
  district: string;
  active: number;
  leased: number;
  selfOccupy: number;
  sold: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-[hsl(214,20%,88%)] rounded-xl shadow-modal p-3 min-w-[150px]">
      <p className="text-xs font-semibold text-[hsl(215,15%,52%)] mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={`tip-${entry.name}`} className="flex justify-between items-center gap-3">
            <span className="text-xs text-[hsl(215,15%,52%)]">{entry.name}</span>
            <span className="text-xs font-bold tabular-nums" style={{ color: entry.color }}>{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PropertyStatusChart() {
  const [data, setData] = useState<DistrictData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: props } = await supabase
        .from('properties')
        .select('area, phase, status, occupancy')
        .not('area', 'is', null);

      if (!props || props.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      // Group by area (use phase as fallback label)
      const districtMap: Record<string, DistrictData> = {};

      props.forEach(p => {
        const key = (p.area || p.phase || 'Other').trim();
        if (!districtMap[key]) {
          districtMap[key] = { district: key, active: 0, leased: 0, selfOccupy: 0, sold: 0 };
        }
        const d = districtMap[key];
        if (p.status === 'for-sale' || p.status === 'for-sale-and-rent') {
          d.sold += 1;
        } else if (p.occupancy === 'leased' || p.status === 'leased') {
          d.leased += 1;
        } else if (p.status === 'self-occupy') {
          d.selfOccupy += 1;
        } else {
          d.active += 1;
        }
      });

      // Sort by total count desc, take top 6
      const sorted = Object.values(districtMap)
        .sort((a, b) => (b.active + b.leased + b.selfOccupy + b.sold) - (a.active + a.leased + a.selfOccupy + a.sold))
        .slice(0, 6)
        .map(d => ({
          ...d,
          district: d.district.length > 8 ? d.district.slice(0, 8) : d.district,
        }));

      setData(sorted);
    } catch (err) {
      console.error('PropertyStatusChart fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Real-time: refetch chart when properties change ────────────────────────
  usePropertiesChangeListener(() => {
    fetchData();
  });

  return (
    <div className="card p-5 h-full">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-[hsl(215,25%,18%)]">Status by District</h2>
        <p className="text-xs text-[hsl(215,15%,52%)] mt-0.5">Top 6 districts · Unit count</p>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-4">
        {[
          { label: 'Active',      color: '#22C55E' },
          { label: 'Leased',      color: '#1B4F8A' },
          { label: 'Self Occupy', color: '#94A3B8' },
          { label: 'Sold',        color: '#C9A84C' },
        ].map((item) => (
          <div key={`legend-${item.label}`} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-[hsl(215,15%,52%)]">{item.label}</span>
          </div>
        ))}
      </div>
      {loading ? (
        <div className="h-[200px] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#1B4F8A] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-xs text-[hsl(215,15%,52%)]">
          No property data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -20 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,92%)" vertical={false} />
            <XAxis
              dataKey="district"
              tick={{ fontSize: 10, fill: 'hsl(215,15%,52%)', fontFamily: 'DM Sans' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(215,15%,52%)', fontFamily: 'DM Sans' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="active"     name="Active"      fill="#22C55E" radius={[2, 2, 0, 0]} />
            <Bar dataKey="leased"     name="Leased"      fill="#1B4F8A" radius={[2, 2, 0, 0]} />
            <Bar dataKey="selfOccupy" name="Self Occupy" fill="#94A3B8" radius={[2, 2, 0, 0]} />
            <Bar dataKey="sold"       name="Sold"        fill="#C9A84C" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}