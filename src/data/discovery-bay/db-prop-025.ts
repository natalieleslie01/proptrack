import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'bij-00012',
  unit: '12 Bijou Hamlet',
  building: 'Bijou Hamlet',
  shortCode: 'BIJ00012',
  district: 'Discovery Bay, Lantau Island',
  street: 'Bijou Hamlet',
  type: 'Residential',
  status: 0,
  occupancyStatus: 'vacant',
  contactStatus: 'active',
  bedrooms: 3,
  bathrooms: null,
  sqft: 1556,
  floor: '',
  yearBuilt: 1994,
  monthlyRent: 70000,
  salePrice: 40000000,
  landlord: {
    name: '',
    phone: '',
    email: '',
    idNumber: '',
  },
  tenant: null,
  lastUpdated: '30/04/2024',
  updatedBy: '',
  agentNotes: 'Sale: 40M @HK$26K/sqft. Lease: 70K @HK$45/sqft. Keys: Other (Call Clara). Shell Co: Y.',
  highlight: 'Do not advertise',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
  keyLocation: { type: 'agent', agentName: 'Call Clara' },
};

export default property;
