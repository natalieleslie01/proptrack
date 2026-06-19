'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface AddPropertyModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const PROPERTY_TYPES = [
  { value: 'for-rent', label: 'For Rent' },
  { value: 'for-sale', label: 'For Sale' },
  { value: 'for-sale-and-rent', label: 'For Sale & Rent' },
  { value: 'leased', label: 'Leased' },
  { value: 'self-occupy', label: 'Self Occupy' },
];

const DISTRICTS = [
  'Discovery Bay',
  'Amalfi',
  'Bijou Hamlet',
  'Capeland Drive',
  'Caperidge Drive',
  'Capevale Drive',
  'Chianti',
  'Coastline Villa',
  'Crestmont Villa',
  'Db Plaza',
  'Greenvale Village',
  'Headland Drive',
  'Hillgrove Village',
  'IL Picco',
  'La Costa',
  'La Serene',
  'La Vista',
  'Middle Lane',
  'Midvale Village',
  'Neo Horizon',
  'Parkland Drive',
  'Parkridge Drive',
  'Parkridge Village',
  'Parkvale Drive',
  'Parkvale Village',
  'Poggibonsi',
  'Positano',
  'Seabee Lane',
  'Seabird Lane',
  'Seahorse Lane',
  'Siena One',
  'Siena Two',
  'Twilight Court',
];

export default function AddPropertyModal({ onClose, onSuccess }: AddPropertyModalProps) {
  const [saving, setSaving] = useState(false);

  // Core fields
  const [district, setDistrict] = useState('Discovery Bay');
  const [address, setAddress] = useState('');
  const [unit, setUnit] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [propertyRef, setPropertyRef] = useState('');
  const [propertyType, setPropertyType] = useState('for-rent');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [saleableArea, setSaleableArea] = useState('');
  const [askingRent, setAskingRent] = useState('');
  const [askingPrice, setAskingPrice] = useState('');

  // Landlord
  const [landlordName, setLandlordName] = useState('');
  const [landlordPhone, setLandlordPhone] = useState('');
  const [landlordEmail, setLandlordEmail] = useState('');

  // Tenant & Lease
  const [tenantName, setTenantName] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [leaseStart, setLeaseStart] = useState('');
  const [leaseEnd, setLeaseEnd] = useState('');

  // Notes
  const [notes, setNotes] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address && !unit) {
      toast.error('Please enter at least an address or unit number');
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const insertData: Record<string, unknown> = {
        village: district,
        address: address || null,
        unit: unit || null,
        building_name: buildingName || null,
        property_ref: propertyRef || null,
        status: propertyType,
        bedrooms: bedrooms ? parseInt(bedrooms, 10) : null,
        bathrooms: bathrooms ? parseInt(bathrooms, 10) : null,
        saleable_area: saleableArea ? parseFloat(saleableArea) : null,
        asking_rent: askingRent ? parseFloat(askingRent) : null,
        asking_price: askingPrice ? parseFloat(askingPrice) : null,
        landlord_name: landlordName || null,
        landlord_phone: landlordPhone || null,
        landlord_email: landlordEmail || null,
        tenant_name: tenantName || null,
        tenant_phone: tenantPhone || null,
        lease_start: leaseStart || null,
        lease_end: leaseEnd || null,
        notes: notes || null,
        created_by: user?.id ?? null,
        occupancy: tenantName ? 'leased' : 'vacant',
        contact_status: 'active',
        validation_status: 'valid',
      };

      const { error } = await supabase.from('properties').insert(insertData);
      if (error) throw error;

      toast.success('Property created successfully');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create property';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(214,20%,88%)] bg-[hsl(210,20%,98%)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1B4F8A]/10 flex items-center justify-center">
              <Icon name="PlusCircleIcon" size={18} className="text-[#1B4F8A]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[hsl(215,25%,18%)]">Add New Property</h2>
              <p className="text-xs text-[hsl(215,15%,52%)]">Create a new property listing in the system</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[hsl(210,15%,94%)] transition-colors"
          >
            <Icon name="XIcon" size={16} className="text-[hsl(215,15%,52%)]" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-5">

            {/* Property Details */}
            <div>
              <h3 className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Icon name="HomeIcon" size={12} className="text-[#1B4F8A]" />
                Property Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* District */}
                <div>
                  <label className="block text-xs font-medium text-[hsl(215,25%,30%)] mb-1">
                    District <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="input-base w-full text-sm"
                    required
                  >
                    {DISTRICTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Property Type */}
                <div>
                  <label className="block text-xs font-medium text-[hsl(215,25%,30%)] mb-1">
                    Property Type <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="input-base w-full text-sm"
                    required
                  >
                    {PROPERTY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {/* Address */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[hsl(215,25%,30%)] mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 1 Discovery Bay Road"
                    className="input-base w-full text-sm"
                  />
                </div>

                {/* Unit */}
                <div>
                  <label className="block text-xs font-medium text-[hsl(215,25%,30%)] mb-1">
                    Unit / Flat
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="e.g. Flat A, 12/F"
                    className="input-base w-full text-sm"
                  />
                </div>

                {/* Building Name */}
                <div>
                  <label className="block text-xs font-medium text-[hsl(215,25%,30%)] mb-1">
                    Building Name
                  </label>
                  <input
                    type="text"
                    value={buildingName}
                    onChange={(e) => setBuildingName(e.target.value)}
                    placeholder="e.g. Siena One"
                    className="input-base w-full text-sm"
                  />
                </div>

                {/* Property Ref */}
                <div>
                  <label className="block text-xs font-medium text-[hsl(215,25%,30%)] mb-1">
                    Property Reference (PID)
                  </label>
                  <input
                    type="text"
                    value={propertyRef}
                    onChange={(e) => setPropertyRef(e.target.value)}
                    placeholder="e.g. DB-S1-001-01A"
                    className="input-base w-full text-sm font-mono"
                  />
                </div>

                {/* Bedrooms */}
                <div>
                  <label className="block text-xs font-medium text-[hsl(215,25%,30%)] mb-1">Bedrooms</label>
                  <input
                    type="number"
                    min="0"
                    value={bedrooms}
                    onChange={(e) => setBedrooms(e.target.value)}
                    placeholder="0"
                    className="input-base w-full text-sm"
                  />
                </div>

                {/* Bathrooms */}
                <div>
                  <label className="block text-xs font-medium text-[hsl(215,25%,30%)] mb-1">Bathrooms</label>
                  <input
                    type="number"
                    min="0"
                    value={bathrooms}
                    onChange={(e) => setBathrooms(e.target.value)}
                    placeholder="0"
                    className="input-base w-full text-sm"
                  />
                </div>

                {/* Saleable Area */}
                <div>
                  <label className="block text-xs font-medium text-[hsl(215,25%,30%)] mb-1">Saleable Area (sq ft)</label>
                  <input
                    type="number"
                    min="0"
                    value={saleableArea}
                    onChange={(e) => setSaleableArea(e.target.value)}
                    placeholder="e.g. 850"
                    className="input-base w-full text-sm"
                  />
                </div>

                {/* Asking Rent */}
                <div>
                  <label className="block text-xs font-medium text-[hsl(215,25%,30%)] mb-1">Asking Rent (HKD/mo)</label>
                  <input
                    type="number"
                    min="0"
                    value={askingRent}
                    onChange={(e) => setAskingRent(e.target.value)}
                    placeholder="e.g. 25000"
                    className="input-base w-full text-sm"
                  />
                </div>

                {/* Asking Price */}
                <div>
                  <label className="block text-xs font-medium text-[hsl(215,25%,30%)] mb-1">Asking Price (HKD)</label>
                  <input
                    type="number"
                    min="0"
                    value={askingPrice}
                    onChange={(e) => setAskingPrice(e.target.value)}
                    placeholder="e.g. 5000000"
                    className="input-base w-full text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Landlord Details */}
            <div>
              <h3 className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Icon name="UserIcon" size={12} className="text-[#1B4F8A]" />
                Landlord Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[hsl(215,25%,30%)] mb-1">Landlord Name</label>
                  <input
                    type="text"
                    value={landlordName}
                    onChange={(e) => setLandlordName(e.target.value)}
                    placeholder="Full name"
                    className="input-base w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[hsl(215,25%,30%)] mb-1">Phone</label>
                  <input
                    type="tel"
                    value={landlordPhone}
                    onChange={(e) => setLandlordPhone(e.target.value)}
                    placeholder="+852 xxxx xxxx"
                    className="input-base w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[hsl(215,25%,30%)] mb-1">Email</label>
                  <input
                    type="email"
                    value={landlordEmail}
                    onChange={(e) => setLandlordEmail(e.target.value)}
                    placeholder="landlord@email.com"
                    className="input-base w-full text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Tenant & Lease */}
            <div>
              <h3 className="text-xs font-semibold text-[hsl(215,15%,52%)] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Icon name="KeyIcon" size={12} className="text-[#1B4F8A]" />
                Tenant &amp; Lease (optional)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[hsl(215,25%,30%)] mb-1">Tenant Name</label>
                  <input
                    type="text"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="Full name"
                    className="input-base w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[hsl(215,25%,30%)] mb-1">Tenant Phone</label>
                  <input
                    type="tel"
                    value={tenantPhone}
                    onChange={(e) => setTenantPhone(e.target.value)}
                    placeholder="+852 xxxx xxxx"
                    className="input-base w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[hsl(215,25%,30%)] mb-1">Lease Start Date</label>
                  <input
                    type="date"
                    value={leaseStart}
                    onChange={(e) => setLeaseStart(e.target.value)}
                    className="input-base w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[hsl(215,25%,30%)] mb-1">Lease End Date</label>
                  <input
                    type="date"
                    value={leaseEnd}
                    onChange={(e) => setLeaseEnd(e.target.value)}
                    className="input-base w-full text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-[hsl(215,25%,30%)] mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about this property..."
                rows={3}
                className="input-base w-full text-sm resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-[hsl(214,20%,88%)] bg-[hsl(210,20%,98%)] flex-shrink-0">
            <p className="text-[11px] text-[hsl(215,15%,52%)]">
              Fields marked <span className="text-red-400">*</span> are required
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary py-2 px-4 text-xs"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary py-2 px-4 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating…
                  </span>
                ) : (
                  <>
                    <Icon name="PlusIcon" size={13} />
                    Create Property
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
