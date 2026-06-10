import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'bij-00003',
  unit: '3 Bijou Hamlet',
  building: 'Bijou Hamlet',
  shortCode: 'BIJ00003',
  district: 'Discovery Bay, Lantau Island',
  street: 'Bijou Hamlet',
  type: 'Residential',
  status: 0,
  occupancyStatus: 'vacant',
  contactStatus: 'active',
  bedrooms: 4,
  bathrooms: null,
  sqft: 2264,
  floor: '',
  yearBuilt: 1994,
  monthlyRent: 82800,
  salePrice: 42900000,
  vacantDate: '01/12/2022',
  landlord: {
    name: '',
    phone: '',
    email: '',
    idNumber: '',
  },
  tenant: null,
  lastUpdated: '02/01/2026',
  updatedBy: '',
  agentNotes: 'Sale: 42.9M @HK$19K/sqft. Lease: 82.8K @HK$37/sqft. Keys: Other (HKR).',
  highlight: 'HKR',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
  keyLocation: { type: 'agent', agentName: 'HKR' },
};

export default property;
