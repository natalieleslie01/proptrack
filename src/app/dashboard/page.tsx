import React from 'react';
import AppLayout from '@/components/AppLayout';
import MetricsBentoGrid from './components/MetricsBentoGrid';
import RentalIncomeChart from './components/RentalIncomeChart';
import PropertyStatusChart from './components/PropertyStatusChart';
import ExpiringLeasesTable from './components/ExpiringLeasesTable';
import UpcomingViewings from './components/UpcomingViewings';
import ActivityFeed from './components/ActivityFeed';
import PropertyPhotoGrid from './components/PropertyPhotoGrid';
import ActionAlerts from './components/ActionAlerts';
import KeyLog from './components/KeyLog';

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(215,25%,18%)]">Portfolio Dashboard</h1>
            <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">
              Monday, 21 April 2026 — Hong Kong Standard Time
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select className="input-base w-auto text-sm py-1.5">
              <option>All Districts</option>
              <option>Central & Western</option>
              <option>Wan Chai</option>
              <option>Eastern</option>
              <option>Kowloon City</option>
              <option>Mong Kok</option>
              <option>Tsim Sha Tsui</option>
              <option>Sham Shui Po</option>
              <option>Islands</option>
            </select>
            <button className="btn-secondary py-1.5">
              <span className="text-sm">This Month</span>
            </button>
            <button className="btn-primary py-1.5">
              Print Schedule
            </button>
          </div>
        </div>

        {/* KPI Bento Grid */}
        <MetricsBentoGrid />

        {/* Action Alerts */}
        <ActionAlerts />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RentalIncomeChart />
          </div>
          <div className="lg:col-span-1">
            <PropertyStatusChart />
          </div>
        </div>

        {/* Property Photo Grid */}
        <PropertyPhotoGrid />

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ExpiringLeasesTable />
          </div>
          <div className="lg:col-span-1 flex flex-col gap-6">
            <KeyLog />
            <UpcomingViewings />
            <ActivityFeed />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}