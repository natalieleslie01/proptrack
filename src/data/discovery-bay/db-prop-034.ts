import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'bij-00027',
  unit: '27 Bijou Hamlet',
  building: 'Bijou Hamlet',
  shortCode: 'BIJ00027',
  district: 'Discovery Bay, Lantau Island',
  street: 'Bijou Hamlet',
  type: 'Residential',
  status: 0,
  occupancyStatus: 'leased',
  contactStatus: 'active',
  bedrooms: 3,
  bathrooms: null,
  sqft: 1556,
  floor: '',
  yearBuilt: 1994,
  monthlyRent: null,
  salePrice: 40000000,
  landlord: {
    name: '',
    phone: '',
    email: '',
    idNumber: '',
  },
  tenant: null,
  lastUpdated: '23/11/2023',
  updatedBy: '',
  agentNotes: 'Sale: 40M @HK$26K/sqft. Keys: Other (LL).',
  highlight: 'Do not advertise',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
  keyLocation: { type: 'agent', agentName: 'LL' },
};

export default property;
