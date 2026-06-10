import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'bij-00002',
  unit: '2 Bijou Hamlet',
  building: 'Bijou Hamlet',
  shortCode: 'BIJ00002',
  district: 'Discovery Bay, Lantau Island',
  street: 'Bijou Hamlet',
  type: 'Residential',
  status: 0,
  occupancyStatus: 'vacant',
  contactStatus: 'active',
  bedrooms: 4,
  bathrooms: null,
  sqft: 2504,
  floor: '',
  yearBuilt: 1994,
  monthlyRent: 90000,
  salePrice: 46800000,
  landlord: {
    name: '',
    phone: '',
    email: '',
    idNumber: '',
  },
  tenant: null,
  lastUpdated: '17/03/2026',
  updatedBy: '',
  agentNotes: 'Sale: 46.8M @HK$19K/sqft. Lease: 90K @HK$36/sqft. Keys: Other (HKR).',
  highlight: 'HKR',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
  keyLocation: { type: 'agent', agentName: 'HKR' },
};

export default property;
