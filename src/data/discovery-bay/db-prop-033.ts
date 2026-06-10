import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'bij-00026',
  unit: '26 Bijou Hamlet',
  building: 'Bijou Hamlet',
  shortCode: 'BIJ00026',
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
  monthlyRent: 80000,
  salePrice: null,
  landlord: {
    name: '',
    phone: '',
    email: '',
    idNumber: '',
  },
  tenant: null,
  lastUpdated: '29/07/2021',
  updatedBy: '',
  agentNotes: 'Lease: 80K @HK$51/sqft. Keys: N. Shell Co: Other (Katie HLH).',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
};

export default property;
