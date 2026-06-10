import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'bij-00030',
  unit: '30 Bijou Hamlet',
  building: 'Bijou Hamlet',
  shortCode: 'BIJ00030',
  district: 'Discovery Bay, Lantau Island',
  street: 'Bijou Hamlet',
  type: 'Residential',
  status: 0,
  occupancyStatus: 'leased',
  contactStatus: 'active',
  bedrooms: 4,
  bathrooms: null,
  sqft: 2264,
  floor: '',
  yearBuilt: 1994,
  monthlyRent: null,
  salePrice: 65000000,
  vacantDate: '01/06/2026',
  landlord: {
    name: '',
    phone: '',
    email: '',
    idNumber: '',
  },
  tenant: null,
  lastUpdated: '22/08/2024',
  updatedBy: '',
  agentNotes: 'Sale: 65M @HK$29K/sqft. Keys: Other (Debbie Kaman).',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
  keyLocation: { type: 'agent', agentName: 'Debbie Kaman' },
};

export default property;
