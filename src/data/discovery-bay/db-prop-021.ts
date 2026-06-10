import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'bij-00008',
  unit: '8 Bijou Hamlet',
  building: 'Bijou Hamlet',
  shortCode: 'BIJ00008',
  district: 'Discovery Bay, Lantau Island',
  street: 'Bijou Hamlet',
  type: 'Residential',
  status: 1,
  occupancyStatus: 'leased',
  contactStatus: 'active',
  bedrooms: 5,
  bathrooms: null,
  sqft: 2850,
  floor: '',
  yearBuilt: 1994,
  monthlyRent: null,
  salePrice: null,
  landlord: {
    name: '',
    phone: '',
    email: '',
    idNumber: '',
  },
  tenant: null,
  lastUpdated: '22/11/2022',
  updatedBy: '',
  agentNotes: 'Keys: N.',
  highlight: 'HKR',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
};

export default property;
