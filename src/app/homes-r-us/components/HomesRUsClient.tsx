'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { COMPANY } from '@/lib/company';
import PropertyCard from './PropertyCard';
import PropertyDetailModal from './PropertyDetailModal';
import ContactModal from './ContactModal';
import { trackEvent } from '@/lib/eventTracker';

export interface PublicProperty {
  id: string;
  property_ref: string;
  village: string;
  phase: string | null;
  block: string | null;
  floor: string | null;
  unit: string | null;
  address: string | null;
  bedrooms: number;
  bathrooms: number;
  saleable_area: number | null;
  gross_area: number | null;
  asking_price: number | null;
  asking_rent: number | null;
  status: 'for-sale' | 'for-rent' | 'for-sale-and-rent';
  notes: string | null;
  // Extended published fields
  building_name: string | null;
  direction_id: string | null;
  view_id: string | null;
  prop_types: string | null;
  furn_id: string | null;
  balcony: boolean | null;
  combined: boolean | null;
  duplex: boolean | null;
  garden: boolean | null;
  openkitch: boolean | null;
  pool: boolean | null;
  roof: boolean | null;
  terrace: boolean | null;
  matterport_link: string | null;
  publish_dt: string | null;
  outside_sc: number | null;
  p_english: string | null;
  // Photos from property_photos table
  photos?: Array<{ public_url: string; display_order: number; filename: string }>;
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All Listings' },
  { value: 'for-sale', label: 'For Sale' },
  { value: 'for-rent', label: 'For Rent' },
  { value: 'for-sale-and-rent', label: 'For Sale & Rent' },
];

const BEDROOM_FILTERS = [
  { value: 'all', label: 'Any Beds' },
  { value: '1', label: '1 Bed' },
  { value: '2', label: '2 Beds' },
  { value: '3', label: '3 Beds' },
  { value: '4', label: '4+ Beds' },
];

export default function HomesRUsClient() {
  const [properties, setProperties] = useState<PublicProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [bedroomFilter, setBedroomFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<PublicProperty | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactProperty, setContactProperty] = useState<PublicProperty | null>(null);

  useEffect(() => {
    async function fetchProperties() {
      const supabase = createClient();

      // Fetch properties that have a publish_dt set (published to website)
      const { data, error } = await supabase
        .from('properties')
        .select(
          'id, property_ref, village, phase, block, floor, unit, address, bedrooms, bathrooms, saleable_area, gross_area, asking_price, asking_rent, status, notes, building_name, direction_id, view_id, prop_types, furn_id, balcony, combined, duplex, garden, openkitch, pool, roof, terrace, matterport_link, publish_dt, outside_sc, p_english'
        )
        .in('status', ['for-sale', 'for-rent', 'for-sale-and-rent'])
        .not('publish_dt', 'is', null)
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Fetch advertising photos for all properties
        const propertyRefs = data.map((p: any) => p.property_ref);
        let photosMap: Record<string, Array<{ public_url: string; display_order: number; filename: string }>> = {};

        if (propertyRefs.length > 0) {
          const { data: photosData } = await supabase
            .from('property_photos')
            .select('property_ref, public_url, display_order, filename')
            .in('property_ref', propertyRefs)
            .eq('is_advertising', true)
            .order('display_order', { ascending: true });

          if (photosData) {
            photosData.forEach((ph: any) => {
              if (!photosMap[ph.property_ref]) photosMap[ph.property_ref] = [];
              photosMap[ph.property_ref].push({
                public_url: ph.public_url,
                display_order: ph.display_order,
                filename: ph.filename,
              });
            });
          }
        }

        const enriched = data.map((p: any) => ({
          ...p,
          photos: photosMap[p.property_ref] || [],
        }));

        setProperties(enriched as PublicProperty[]);
      }
      setLoading(false);
    }
    fetchProperties();
  }, []);

  const filtered = useMemo(() => {
    let data = [...properties];
    if (statusFilter !== 'all') {
      data = data.filter((p) => p.status === statusFilter);
    }
    if (bedroomFilter !== 'all') {
      const n = parseInt(bedroomFilter);
      data = data.filter((p) => (n >= 4 ? p.bedrooms >= 4 : p.bedrooms === n));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(
        (p) =>
          p.property_ref.toLowerCase().includes(q) ||
          (p.village || '').toLowerCase().includes(q) ||
          (p.phase || '').toLowerCase().includes(q) ||
          (p.address || '').toLowerCase().includes(q) ||
          (p.building_name || '').toLowerCase().includes(q)
      );
    }
    return data;
  }, [properties, statusFilter, bedroomFilter, search]);

  const handleEnquire = (property: PublicProperty) => {
    setContactProperty(property);
    setContactOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F5EFE6] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-[#E8D5C0] sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-white border border-[#E8D5C0] flex items-center justify-center">
                <img
                  src="/assets/images/Dragon_back-1777203883736.jpeg"
                  alt="Homes R Us Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <span className="text-[#8B1A2B] font-bold text-lg tracking-tight leading-none">Homes R Us</span>
                <p className="text-[10px] text-[hsl(215,15%,52%)] font-medium tracking-wide uppercase leading-none mt-0.5">Property Agency</p>
              </div>
            </div>
            <button
              onClick={() => { setContactProperty(null); setContactOpen(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#8B1A2B] text-white text-sm font-medium rounded-lg hover:bg-[#6E1522] transition-all duration-150"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              Contact Us
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-[#F5EFE6] via-[#EDE0CF] to-[#E8D5C0] text-[#3D1010] border-b border-[#D9BB9A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="max-w-2xl">
            <p className="text-[#8B1A2B] text-sm font-semibold tracking-widest uppercase mb-3">Discovery Bay & Hong Kong</p>
            <h1 className="text-4xl font-bold leading-tight mb-4 text-[#3D1010]">Find Your Perfect Home</h1>
            <p className="text-[#6B4226] text-base leading-relaxed">
              Browse our curated selection of properties available for sale and rent. 
              Our team is here to help you find the right fit.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-[#E8D5C0] sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(215,15%,52%)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Search by ref, village, building…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#F5EFE6] border border-[#E8D5C0] rounded-lg text-sm text-[hsl(215,25%,18%)] placeholder:text-[hsl(215,15%,62%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/30 focus:border-[#8B1A2B] transition-all"
              />
            </div>

            {/* Status filter pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
                    statusFilter === f.value
                      ? 'bg-[#8B1A2B] text-white shadow-sm'
                      : 'bg-[#E8D5C0] text-[hsl(215,15%,42%)] hover:bg-[#D9BB9A] hover:text-[hsl(215,25%,18%)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Bedroom filter */}
            <select
              value={bedroomFilter}
              onChange={(e) => setBedroomFilter(e.target.value)}
              className="px-3 py-2 bg-[#F5EFE6] border border-[#E8D5C0] rounded-lg text-sm text-[hsl(215,25%,18%)] focus:outline-none focus:ring-2 focus:ring-[#8B1A2B]/30 focus:border-[#8B1A2B] transition-all"
            >
              {BEDROOM_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>

            <span className="ml-auto text-xs text-[hsl(215,15%,52%)] font-medium whitespace-nowrap">
              {loading ? 'Loading…' : `${filtered.length} listing${filtered.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>
      </div>

      {/* Listings Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-[#E8D5C0] overflow-hidden animate-pulse">
                <div className="h-48 bg-[#E8D5C0]" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-[#E8D5C0] rounded w-3/4" />
                  <div className="h-3 bg-[#E8D5C0] rounded w-1/2" />
                  <div className="h-3 bg-[#E8D5C0] rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-[#E8D5C0] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[hsl(215,15%,52%)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </div>
            <h3 className="text-[hsl(215,25%,18%)] font-semibold text-lg mb-1">No listings found</h3>
            <p className="text-[hsl(215,15%,52%)] text-sm">Try adjusting your filters or search term.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onView={() => {
                  setSelectedProperty(property);
                  trackEvent('property_view', {
                    property_ref: property.property_ref,
                    property_id: property.id,
                    village: property.village,
                    status: property.status,
                  });
                }}
                onEnquire={() => handleEnquire(property)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#F0E6D6] border-t border-[#D9BB9A] text-[#3D1010] mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-md overflow-hidden bg-white/60 border border-[#D9BB9A] flex items-center justify-center">
                  <img
                    src="/assets/images/Dragon_back-1777203883736.jpeg"
                    alt="Homes R Us Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="font-bold text-base text-[#3D1010]">Homes R Us</span>
              </div>
              <p className="text-[#6B4226] text-sm leading-relaxed">{COMPANY.tagline}</p>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-[#3D1010] font-semibold text-sm mb-3 tracking-wide uppercase">Contact</h4>
              <ul className="space-y-2 text-sm text-[#6B4226]">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#8B1A2B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <span>{COMPANY.address}</span>
                </li>
                {COMPANY.phones.map((phone) => (
                  <li key={phone} className="flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0 text-[#8B1A2B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                    </svg>
                    <a href={`tel:${phone.replace(/\s/g, '')}`} className="hover:text-[#3D1010] transition-colors">{phone}</a>
                  </li>
                ))}
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0 text-[#8B1A2B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  <a href={`mailto:${COMPANY.email}`} className="hover:text-[#3D1010] transition-colors">{COMPANY.email}</a>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0 text-[#8B1A2B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                  </svg>
                  <a href={COMPANY.websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[#3D1010] transition-colors">{COMPANY.website}</a>
                </li>
              </ul>
            </div>

            {/* Licenses + CTA */}
            <div>
              <h4 className="text-[#3D1010] font-semibold text-sm mb-3 tracking-wide uppercase">Licensing</h4>
              <ul className="space-y-1.5 text-sm text-[#6B4226] mb-5">
                <li><span className="text-[#3D1010] font-medium">EAA License:</span> {COMPANY.eaaLicense}</li>
                <li><span className="text-[#3D1010] font-medium">Company License:</span> {COMPANY.companyLicense}</li>
              </ul>
              <button
                onClick={() => { setContactProperty(null); setContactOpen(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#8B1A2B] text-white text-sm font-semibold rounded-lg hover:bg-[#6E1522] transition-all duration-150"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                Send Us a Message
              </button>
            </div>
          </div>

          <div className="border-t border-[#D9BB9A] pt-6 text-center text-[#8B6240] text-xs">
            © {new Date().getFullYear()} Homes R Us. All rights reserved. · Licensed Estate Agency in Hong Kong
          </div>
        </div>
      </footer>

      {/* Property Detail Modal */}
      {selectedProperty && (
        <PropertyDetailModal
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          onEnquire={() => handleEnquire(selectedProperty)}
        />
      )}

      {/* Contact Modal */}
      {contactOpen && (
        <ContactModal
          property={contactProperty}
          onClose={() => { setContactOpen(false); setContactProperty(null); }}
        />
      )}
    </div>
  );
}
