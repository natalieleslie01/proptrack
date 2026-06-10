'use client';

import React, { useState, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';
import AppLayout from '@/components/AppLayout';
import { agentNames } from '@/app/property-management/components/mockData';
import { toast } from 'sonner';
import { useRole } from '@/hooks/useRole';
import { useCallback } from 'react';
import { useMaintenanceRealtime, RealtimeEvent } from '@/hooks/useRealtimeSync';

type MaintenanceStatus = 'open' | 'in_progress' | 'awaiting_parts' | 'completed' | 'cancelled';
type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent';

interface MaintenanceRequest {
  id: string;
  propertyRef: string;
  propertyAddress: string;
  reportedBy: string;
  reportedByType: 'tenant' | 'landlord' | 'agent';
  category: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  assignedAgent: string;
  contractorName?: string;
  contractorPhone?: string;
  estimatedCost?: number;
  actualCost?: number;
  scheduledDate?: string;
  completedDate?: string;
  notes: string;
  createdAt: string;
}

const PRIORITY_CONFIG: Record<MaintenancePriority, { label: string; color: string; bg: string }> = {
  low: { label: 'Low', color: '#64748b', bg: '#f1f5f9' },
  medium: { label: 'Medium', color: '#2563eb', bg: '#eff6ff' },
  high: { label: 'High', color: '#d97706', bg: '#fffbeb' },
  urgent: { label: 'Urgent', color: '#dc2626', bg: '#fef2f2' },
};

const STATUS_CONFIG: Record<MaintenanceStatus, { label: string; color: string; bg: string; icon: string }> = {
  open: { label: 'Open', color: '#dc2626', bg: '#fef2f2', icon: 'AlertCircleIcon' },
  in_progress: { label: 'In Progress', color: '#2563eb', bg: '#eff6ff', icon: 'ClockIcon' },
  awaiting_parts: { label: 'Awaiting Parts', color: '#d97706', bg: '#fffbeb', icon: 'PackageIcon' },
  completed: { label: 'Completed', color: '#059669', bg: '#f0fdf4', icon: 'CheckCircleIcon' },
  cancelled: { label: 'Cancelled', color: '#64748b', bg: '#f1f5f9', icon: 'XCircleIcon' },
};

const CATEGORIES = ['Plumbing', 'Electrical', 'HVAC', 'Appliances', 'Structural', 'Pest Control', 'Cleaning', 'Security', 'General'];

const mockRequests: MaintenanceRequest[] = [
  { id: 'm1', propertyRef: 'DB-001', propertyAddress: 'Apt 3A, Headland Village', reportedBy: 'John Smith', reportedByType: 'tenant', category: 'Plumbing', description: 'Kitchen tap leaking, water pooling under sink', priority: 'high', status: 'in_progress', assignedAgent: 'Alice Tam', contractorName: 'DB Plumbing Co', contractorPhone: '+852 9100 7777', estimatedCost: 800, scheduledDate: '2026-05-05', notes: 'Contractor confirmed appointment', createdAt: '2026-04-28' },
  { id: 'm2', propertyRef: 'DB-008', propertyAddress: 'Apt 12B, Siena 1 Highrise', reportedBy: 'Mary Chan', reportedByType: 'tenant', category: 'Electrical', description: 'Bedroom light switch not working, possible wiring issue', priority: 'medium', status: 'open', assignedAgent: 'Marcus Wong', estimatedCost: 500, notes: '', createdAt: '2026-04-30' },
  { id: 'm3', propertyRef: 'DB-015', propertyAddress: 'House 7, Coastline', reportedBy: 'Peter Lau', reportedByType: 'landlord', category: 'HVAC', description: 'Air conditioning unit making loud noise, not cooling properly', priority: 'urgent', status: 'open', assignedAgent: 'Sophia Liu', estimatedCost: 2500, notes: 'Tenant complaining about heat', createdAt: '2026-05-01' },
  { id: 'm4', propertyRef: 'DB-022', propertyAddress: 'Apt 5C, Parkvale', reportedBy: 'Sarah Wong', reportedByType: 'tenant', category: 'Appliances', description: 'Washing machine not draining, error code E3', priority: 'medium', status: 'awaiting_parts', assignedAgent: 'David Cheung', contractorName: 'Appliance Fix HK', estimatedCost: 1200, notes: 'Waiting for drain pump part', createdAt: '2026-04-25' },
  { id: 'm5', propertyRef: 'DB-031', propertyAddress: 'Apt 2D, Neo Horizon', reportedBy: 'Tom Lee', reportedByType: 'tenant', category: 'Structural', description: 'Crack appearing in bathroom wall near shower', priority: 'high', status: 'open', assignedAgent: 'Rachel Chan', estimatedCost: 3000, notes: '', createdAt: '2026-04-29' },
  { id: 'm6', propertyRef: 'DB-003', propertyAddress: 'Apt 8F, Seabee Lane', reportedBy: 'Alice Tam', reportedByType: 'agent', category: 'Cleaning', description: 'Deep clean required before new tenant move-in', priority: 'low', status: 'completed', assignedAgent: 'Alice Tam', contractorName: 'Clean Pro HK', actualCost: 1500, completedDate: '2026-04-27', notes: 'Completed and approved', createdAt: '2026-04-20' },
];

export default function MaintenanceClient() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>(mockRequests);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [selected, setSelected] = useState<MaintenanceRequest | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const { isAdminOrManager } = useRole();
  const [newRequest, setNewRequest] = useState<Partial<MaintenanceRequest>>({
    priority: 'medium', status: 'open', reportedByType: 'tenant', category: 'General', notes: '', assignedAgent: agentNames[0],
  });

  // ── Realtime sync — notify when another window changes maintenance data ────
  useMaintenanceRealtime(
    useCallback((event: RealtimeEvent, row: Record<string, unknown>) => {
      if (event === 'INSERT') {
        toast.info(`New maintenance request added: ${(row.property_ref as string) ?? 'unknown property'}`, { id: `maint-insert-${row.id}` });
      } else if (event === 'UPDATE') {
        toast.info(`Maintenance request updated: ${(row.property_ref as string) ?? 'unknown property'}`, { id: `maint-update-${row.id}` });
        setRequests((prev) =>
          prev.map((r) =>
            r.id === (row.id as string)
              ? {
                  ...r,
                  status: (row.status as MaintenanceStatus) ?? r.status,
                  priority: (row.priority as MaintenancePriority) ?? r.priority,
                  notes: (row.notes as string) ?? r.notes,
                }
              : r
          )
        );
      } else if (event === 'DELETE') {
        toast.warning(`Maintenance request removed`, { id: `maint-delete-${row.id}` });
        setRequests((prev) => prev.filter((r) => r.id !== (row.id as string)));
      }
    }, [])
  );

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterPriority !== 'all' && r.priority !== filterPriority) return false;
      return true;
    });
  }, [requests, filterStatus, filterPriority]);

  function addRequest() {
    if (!newRequest.propertyRef || !newRequest.description || !newRequest.reportedBy) {
      toast.error('Please fill in all required fields');
      return;
    }
    const req: MaintenanceRequest = {
      id: `m${Date.now()}`,
      propertyRef: newRequest.propertyRef!,
      propertyAddress: newRequest.propertyAddress ?? newRequest.propertyRef!,
      reportedBy: newRequest.reportedBy!,
      reportedByType: newRequest.reportedByType as 'tenant' | 'landlord' | 'agent',
      category: newRequest.category ?? 'General',
      description: newRequest.description!,
      priority: newRequest.priority as MaintenancePriority,
      status: 'open',
      assignedAgent: newRequest.assignedAgent ?? agentNames[0],
      notes: newRequest.notes ?? '',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setRequests((prev) => [req, ...prev]);
    setShowAddModal(false);
    setNewRequest({ priority: 'medium', status: 'open', reportedByType: 'tenant', category: 'General', notes: '', assignedAgent: agentNames[0] });
    toast.success('Maintenance request created');
  }

  function updateStatus(id: string, status: MaintenanceStatus) {
    setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status, completedDate: status === 'completed' ? new Date().toISOString().split('T')[0] : r.completedDate } : r));
    toast.success('Status updated');
  }

  const stats = {
    open: requests.filter((r) => r.status === 'open').length,
    inProgress: requests.filter((r) => r.status === 'in_progress').length,
    urgent: requests.filter((r) => r.priority === 'urgent' && r.status !== 'completed').length,
    completed: requests.filter((r) => r.status === 'completed').length,
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[hsl(215,25%,18%)]">Maintenance Requests</h1>
            <p className="text-sm text-[hsl(215,15%,52%)] mt-0.5">Track and manage property repair and maintenance issues</p>
          </div>
          <button
            onClick={() => isAdminOrManager ? setShowAddModal(true) : toast.error('Managers and Admins can create maintenance requests')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${isAdminOrManager ? 'bg-[#8B1A2B] text-white hover:bg-[#6d1522]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          >
            <Icon name="PlusIcon" size={16} />
            New Request
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Open', count: stats.open, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'In Progress', count: stats.inProgress, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Urgent', count: stats.urgent, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Completed', count: stats.completed, color: 'text-green-600', bg: 'bg-green-50' },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
              <p className="text-xs text-[hsl(215,15%,52%)] mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-[hsl(214,20%,88%)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 bg-white"
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="border border-[hsl(214,20%,88%)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 bg-white"
          >
            <option value="all">All Priorities</option>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((req) => {
            const pc = PRIORITY_CONFIG[req.priority];
            const sc = STATUS_CONFIG[req.status];
            return (
              <div key={req.id} className="bg-white rounded-xl border border-[hsl(214,20%,88%)] p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[hsl(215,25%,18%)] text-sm truncate">{req.propertyAddress}</p>
                    <p className="text-xs text-[hsl(215,15%,52%)]">{req.propertyRef} · {req.createdAt}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0" style={{ color: pc.color, background: pc.bg }}>
                    {pc.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[hsl(210,20%,97%)] text-[hsl(215,15%,52%)]">{req.category}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color: sc.color, background: sc.bg }}>{sc.label}</span>
                </div>
                <p className="text-sm text-[hsl(215,25%,18%)] mb-3 line-clamp-2">{req.description}</p>
                <div className="flex items-center justify-between text-xs text-[hsl(215,15%,52%)]">
                  <span>Reported by: {req.reportedBy}</span>
                  <span>Agent: {req.assignedAgent.split(' ')[0]}</span>
                </div>
                {req.estimatedCost && (
                  <p className="text-xs text-[hsl(215,15%,52%)] mt-1">Est. cost: HK${req.estimatedCost.toLocaleString()}</p>
                )}
                <div className="flex gap-2 mt-3 pt-3 border-t border-[hsl(214,20%,88%)]">
                  <button onClick={() => setSelected(req)} className="flex-1 py-1.5 rounded-lg border border-[hsl(214,20%,88%)] text-xs font-semibold hover:bg-[hsl(210,15%,94%)] transition-colors">
                    View Details
                  </button>
                  {req.status === 'open' && (
                    <button onClick={() => updateStatus(req.id, 'in_progress')} className="flex-1 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition-colors">
                      Start Work
                    </button>
                  )}
                  {req.status === 'in_progress' && (
                    <button onClick={() => updateStatus(req.id, 'completed')} className="flex-1 py-1.5 rounded-lg bg-green-50 text-green-600 text-xs font-semibold hover:bg-green-100 transition-colors">
                      Mark Done
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-[hsl(215,15%,52%)]">
              <Icon name="WrenchIcon" size={32} className="mx-auto mb-3 opacity-30" />
              <p>No maintenance requests found</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[hsl(214,20%,88%)] sticky top-0 bg-white">
              <div>
                <h2 className="font-bold text-[hsl(215,25%,18%)]">{selected.category} Issue</h2>
                <p className="text-sm text-[hsl(215,15%,52%)]">{selected.propertyAddress}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-[hsl(210,15%,94%)]">
                <Icon name="XIcon" size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-2">
                <span className="px-2 py-1 rounded-full text-xs font-semibold" style={{ color: PRIORITY_CONFIG[selected.priority].color, background: PRIORITY_CONFIG[selected.priority].bg }}>
                  {PRIORITY_CONFIG[selected.priority].label} Priority
                </span>
                <span className="px-2 py-1 rounded-full text-xs font-semibold" style={{ color: STATUS_CONFIG[selected.status].color, background: STATUS_CONFIG[selected.status].bg }}>
                  {STATUS_CONFIG[selected.status].label}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold text-[hsl(215,15%,52%)] mb-1">Description</p>
                <p className="text-sm text-[hsl(215,25%,18%)]">{selected.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3">
                  <p className="text-xs text-[hsl(215,15%,52%)]">Reported By</p>
                  <p className="font-semibold">{selected.reportedBy}</p>
                  <p className="text-xs text-[hsl(215,15%,52%)] capitalize">{selected.reportedByType}</p>
                </div>
                <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3">
                  <p className="text-xs text-[hsl(215,15%,52%)]">Assigned Agent</p>
                  <p className="font-semibold">{selected.assignedAgent}</p>
                </div>
                {selected.contractorName && (
                  <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3">
                    <p className="text-xs text-[hsl(215,15%,52%)]">Contractor</p>
                    <p className="font-semibold">{selected.contractorName}</p>
                    {selected.contractorPhone && <p className="text-xs text-[hsl(215,15%,52%)]">{selected.contractorPhone}</p>}
                  </div>
                )}
                {selected.estimatedCost && (
                  <div className="bg-[hsl(210,20%,97%)] rounded-lg p-3">
                    <p className="text-xs text-[hsl(215,15%,52%)]">Est. Cost</p>
                    <p className="font-semibold">HK${selected.estimatedCost.toLocaleString()}</p>
                    {selected.actualCost && <p className="text-xs text-green-600">Actual: HK${selected.actualCost.toLocaleString()}</p>}
                  </div>
                )}
              </div>
              {selected.notes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-yellow-800 mb-1">Notes</p>
                  <p className="text-sm text-yellow-700">{selected.notes}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-[hsl(215,15%,52%)] mb-2">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(STATUS_CONFIG) as MaintenanceStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => { updateStatus(selected.id, s); setSelected(null); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      style={selected.status === s ? { color: STATUS_CONFIG[s].color, background: STATUS_CONFIG[s].bg, border: `1px solid ${STATUS_CONFIG[s].color}` } : { background: '#f1f5f9', color: '#64748b' }}
                    >
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[hsl(214,20%,88%)] sticky top-0 bg-white">
              <h2 className="font-bold text-[hsl(215,25%,18%)]">New Maintenance Request</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-lg hover:bg-[hsl(210,15%,94%)]">
                <Icon name="XIcon" size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5">Property Ref *</label>
                  <input
                    value={newRequest.propertyRef ?? ''}
                    onChange={(e) => setNewRequest((p) => ({ ...p, propertyRef: e.target.value }))}
                    placeholder="e.g. DB-001"
                    className="w-full border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5">Category</label>
                  <select
                    value={newRequest.category}
                    onChange={(e) => setNewRequest((p) => ({ ...p, category: e.target.value }))}
                    className="w-full border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5">Property Address</label>
                <input
                  value={newRequest.propertyAddress ?? ''}
                  onChange={(e) => setNewRequest((p) => ({ ...p, propertyAddress: e.target.value }))}
                  placeholder="e.g. Apt 3A, Headland Village"
                  className="w-full border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5">Reported By *</label>
                  <input
                    value={newRequest.reportedBy ?? ''}
                    onChange={(e) => setNewRequest((p) => ({ ...p, reportedBy: e.target.value }))}
                    placeholder="Name"
                    className="w-full border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5">Reporter Type</label>
                  <select
                    value={newRequest.reportedByType}
                    onChange={(e) => setNewRequest((p) => ({ ...p, reportedByType: e.target.value as 'tenant' | 'landlord' | 'agent' }))}
                    className="w-full border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                  >
                    <option value="tenant">Tenant</option>
                    <option value="landlord">Landlord</option>
                    <option value="agent">Agent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5">Description *</label>
                <textarea
                  value={newRequest.description ?? ''}
                  onChange={(e) => setNewRequest((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  placeholder="Describe the issue..."
                  className="w-full border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5">Priority</label>
                  <select
                    value={newRequest.priority}
                    onChange={(e) => setNewRequest((p) => ({ ...p, priority: e.target.value as MaintenancePriority }))}
                    className="w-full border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                  >
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[hsl(215,15%,52%)] mb-1.5">Assigned Agent</label>
                  <select
                    value={newRequest.assignedAgent}
                    onChange={(e) => setNewRequest((p) => ({ ...p, assignedAgent: e.target.value }))}
                    className="w-full border border-[hsl(214,20%,88%)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A]/30"
                  >
                    {agentNames.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-[hsl(214,20%,88%)]">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-2 rounded-lg border border-[hsl(214,20%,88%)] text-sm font-semibold hover:bg-[hsl(210,15%,94%)]">
                Cancel
              </button>
              <button onClick={addRequest} className="flex-1 py-2 rounded-lg bg-[#8B1A2B] text-white text-sm font-semibold hover:bg-[#6d1522] transition-colors">
                Create Request
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
