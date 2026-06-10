import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'bij-00018',
  unit: '18 Bijou Hamlet',
  building: 'Bijou Hamlet',
  shortCode: 'BIJ00018',
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
  monthlyRent: 68000,
  salePrice: null,
  landlord: {
    name: '',
    phone: '',
    email: '',
    idNumber: '',
  },
  tenant: null,
  lastUpdated: '15/08/2025',
  updatedBy: '',
  agentNotes: 'Lease: 68K @HK$44/sqft. Keys: Other (C21 Judy AND KSL-TEDDY).',
  highlight: 'NO PILOTS',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
  keyLocation: { type: 'agent', agentName: 'C21 Judy AND KSL-TEDDY' },
};

export default property;
