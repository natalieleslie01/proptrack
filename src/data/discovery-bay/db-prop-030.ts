import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'bij-00021',
  unit: '21 Bijou Hamlet (BIJ00021)',
  building: 'Bijou Hamlet',
  shortCode: 'BIJ00021',
  district: 'Discovery Bay, Lantau Island',
  street: 'Bijou Hamlet',
  type: 'Residential',
  status: 1,
  occupancyStatus: 'leased',
  contactStatus: 'active',
  bedrooms: 3,
  bathrooms: null,
  sqft: 1556,
  floor: '',
  yearBuilt: 1994,
  monthlyRent: null,
  salePrice: null,
  vacantDate: '30/03/2023',
  landlord: {
    name: '',
    phone: '',
    email: '',
    idNumber: '',
  },
  tenant: null,
  lastUpdated: '14/08/2025',
  updatedBy: '',
  agentNotes: 'Keys: Other (EPS LL needs to call first).',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
  keyLocation: { type: 'agent', agentName: 'EPS LL needs to call first' },
};

export default property;
