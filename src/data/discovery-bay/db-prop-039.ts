import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'bij-00032',
  unit: '32 Bijou Hamlet',
  building: 'Bijou Hamlet',
  shortCode: 'BIJ00032',
  district: 'Discovery Bay, Lantau Island',
  street: 'Bijou Hamlet',
  type: 'Residential',
  status: 0,
  occupancyStatus: 'leased',
  contactStatus: 'active',
  bedrooms: 4,
  bathrooms: null,
  sqft: 2504,
  floor: '',
  yearBuilt: 1994,
  monthlyRent: null,
  salePrice: 55000000,
  vacantDate: '01/12/2023',
  landlord: {
    name: '',
    phone: '',
    email: '',
    idNumber: '',
  },
  tenant: null,
  lastUpdated: '22/11/2023',
  updatedBy: '',
  agentNotes: 'Sale: 55M @HK$22K/sqft. Keys: Other (call LL).',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
  keyLocation: { type: 'agent', agentName: 'call LL' },
};

export default property;
