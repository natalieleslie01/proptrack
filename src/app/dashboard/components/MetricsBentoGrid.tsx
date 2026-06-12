'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { usePropertiesRealtime } from '@/hooks/useRealtimeSync';
import Link from 'next/link';

interface MetricCardProps {
  label: string;
  value: string;
  subtext: string;
  icon: string;
  trend?: { value: string; positive: boolean };
  variant?: 'default' | 'alert' | 'warning' | 'positive' | 'hero';
  colSpan?: string;
  loading?: boolean;
  href?: string;
}

function MetricCard({ label, value, subtext, icon, trend, variant = 'default', colSpan = '', loading, href }: MetricCardProps) {
  const variantStyles: Record<string, string> = {
    default: 'bg-white border-[hsl(214,20%,88%)]',
    hero: 'bg-[#1B4F8A] border-[#1B4F8A] text-white',
    alert: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    positive: 'bg-emerald-50 border-emerald-200',
  };

  const labelColor: Record<string, string> = {
    default: 'text-[hsl(215,15%,52%)]',
    hero: 'text-blue-200',
    alert: 'text-red-500',
    warning: 'text-amber-600',
    positive: 'text-emerald-600',
  };

  const valueColor: Record<string, string> = {
    default: 'text-[hsl(215,25%,18%)]',
    hero: 'text-white',
    alert: 'text-red-700',
    warning: 'text-amber-700',
    positive: 'text-emerald-700',
  };

  const iconBg: Record<string, string> = {
    default: 'bg-[#1B4F8A]/10 text-[#1B4F8A]',
    hero: 'bg-white/20 text-white',
    alert: 'bg-red-100 text-red-600',
    warning: 'bg-amber-100 text-amber-600',
    positive: 'bg-emerald-100 text-emerald-600',
  };

  return (
    <div className={`card ${variantStyles[variant]} ${colSpan} p-5 hover:shadow-card-hover transition-shadow duration-200 ${href ? 'cursor-pointer hover:ring-2 hover:ring-[#1B4F8A]/20' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg[variant]}`}>
          <Icon name={icon as Parameters<typeof Icon>[0]['name']} size={18} />
        </div>
        {trend && !loading && (
          <span className={`text-xs font-semibold flex items-center gap-0.5 ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}>
            <Icon name={trend.positive ? 'TrendingUpIcon' : 'TrendingDownIcon'} size={12} />
            {trend.value}
          </span>
        )}
      </div>
      <p className={`text-xs font-semibold tracking-wider uppercase mb-1 ${labelColor[variant]}`}>{label}</p>
      {loading ? (
        <div className={`h-9 w-24 rounded animate-pulse ${variant === 'hero' ? 'bg-white/20' : 'bg-gray-200'}`} />
      ) : (
        <p className={`text-3xl font-bold tabular-nums ${valueColor[variant]}`}>{value}</p>
      )}
      <p className={`text-xs mt-1 ${variant === 'hero' ? 'text-blue-200' : 'text-[hsl(215,15%,52%)]'}`}>{subtext}</p>
    </div>
  );
}

interface KpiData {
  totalProperties: number;
  leasedCount: number;
  vacantCount: number;
  forSaleCount: number;
  totalRent: number;
  expiringLeases: number;
  viewingsThisWeek: number;
  pendingForms: number;
}

function formatHKD(value: number): string {
  if (value >= 1_000_000) return `HK$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `HK$${(value / 1_000).toFixed(0)}K`;
  return `HK$${value}`;
}

export default function MetricsBentoGrid() {
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchKpis = useCallback(async () => {
    try {
      const supabase = createClient();

      // Use count queries to bypass the 1,000 row default limit
      const [
        totalRes,
        leasedRes,
        vacantRes,
        forSaleRes,
        rentRes,
        leasesRes,
        viewingsRes,
      ] = await Promise.all([
        supabase
          .from('properties')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .eq('occupancy', 'leased'),
        supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .or('occupancy.eq.vacant,occupancy.eq.vacant-soon'),
        supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .or('status.eq.for-sale,status.eq.for-sale-and-rent'),
        // Fetch rent sum — must page through all leased properties
        supabase
          .from('properties')
          .select('asking_rent')
          .eq('occupancy', 'leased')
          .limit(10000),
        supabase
          .from('properties')
          .select('lease_end')
          .eq('occupancy', 'leased')
          .not('lease_end', 'is', null)
          .limit(10000),
        supabase
          .from('viewings')
          .select('id, viewing_date')
          .eq('status', 'scheduled')
          .limit(10000),
      ]);

      const totalProperties = totalRes.count ?? 0;
      const leasedCount = leasedRes.count ?? 0;
      const vacantCount = vacantRes.count ?? 0;
      const forSaleCount = forSaleRes.count ?? 0;

      // Sum rent for leased properties
      const leasedProps = rentRes.data || [];
      const totalRent = leasedProps.reduce((sum, p) => sum + (p.asking_rent || 0), 0);

      // Expiring leases within 60 days
      const leasedWithEnd = leasesRes.data || [];
      const now = new Date();
      const in60 = new Date();
      in60.setDate(in60.getDate() + 60);
      const expiringLeases = leasedWithEnd.filter(p => {
        if (!p.lease_end) return false;
        let d: Date;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(p.lease_end)) {
          const [dd, mm, yyyy] = p.lease_end.split('/');
          d = new Date(`${yyyy}-${mm}-${dd}`);
        } else {
          d = new Date(p.lease_end);
        }
        return d >= now && d <= in60;
      }).length;

      // Viewings this week
      const viewings = viewingsRes.data || [];
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      const viewingsThisWeek = viewings.filter(v => {
        let d = new Date(v.viewing_date);
        return d >= startOfWeek && d <= endOfWeek;
      }).length;

      setKpi({
        totalProperties,
        leasedCount,
        vacantCount,
        forSaleCount,
        totalRent,
        expiringLeases,
        viewingsThisWeek,
        pendingForms: 0,
      });
    } catch (err) {
      console.error('KPI fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  // ── Real-time: refetch KPIs when properties change ─────────────────────────
  usePropertiesRealtime(() => {
    fetchKpis();
  });

  const occupancyRate = kpi && kpi.totalProperties > 0
    ? ((kpi.leasedCount / kpi.totalProperties) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4">
      {/* Row 1 */}
      <MetricCard
        label="Occupancy Rate"
        value={`${occupancyRate}%`}
        subtext={kpi ? `${kpi.leasedCount.toLocaleString()} of ${kpi.totalProperties.toLocaleString()} lettable units tenanted` : 'Loading…'}
        icon="HomeIcon"
        variant="hero"
        colSpan="md:col-span-2"
        loading={loading}
      />
      <MetricCard
        label="Monthly Rental Income"
        value={kpi ? formatHKD(kpi.totalRent) : '—'}
        subtext={kpi ? `Across ${kpi.leasedCount.toLocaleString()} active tenancies` : 'Loading…'}
        icon="BanknoteIcon"
        variant="positive"
        loading={loading}
      />
      <MetricCard
        label="Vacant Properties"
        value={kpi ? kpi.vacantCount.toLocaleString() : '—'}
        subtext="Vacant and ready for new tenancy"
        icon="KeyIcon"
        variant="default"
        loading={loading}
      />

      {/* Row 2 */}
      <MetricCard
        label="Expiring Leases"
        value={kpi ? kpi.expiringLeases.toLocaleString() : '—'}
        subtext="Within next 60 days — action required"
        icon="AlertTriangleIcon"
        variant="alert"
        loading={loading}
      />
      <MetricCard
        label="Pending HK Forms"
        value={kpi ? kpi.pendingForms.toLocaleString() : '—'}
        subtext="CR109 & AR1 awaiting submission"
        icon="FileWarningIcon"
        variant="warning"
        loading={loading}
      />
      <MetricCard
        label="Properties For Sale"
        value={kpi ? kpi.forSaleCount.toLocaleString() : '—'}
        subtext="Active sale listings across all districts"
        icon="TagIcon"
        variant="default"
        loading={loading}
      />
      <MetricCard
        label="Total Properties"
        value={kpi ? kpi.totalProperties.toLocaleString() : '—'}
        subtext="All properties in portfolio"
        icon="BuildingIcon"
        variant="default"
        loading={loading}
      />

      {/* Key Inventory KPI — links to dedicated screen */}
      <Link href="/key-inventory" className="contents">
        <MetricCard
          label="Key Inventory"
          value="—"
          subtext="View all keys — status, holder & validity"
          icon="KeyRoundIcon"
          variant="default"
          loading={loading}
          href="/key-inventory"
        />
      </Link>

      <MetricCard
        label="Viewings This Week"
        value={kpi ? kpi.viewingsThisWeek.toLocaleString() : '—'}
        subtext="Scheduled viewings this week"
        icon="CalendarIcon"
        variant="default"
        loading={loading}
      />
    </div>
  );
}