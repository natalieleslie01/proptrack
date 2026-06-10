import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'bij-00025',
  unit: '25 Bijou Hamlet',
  building: 'Bijou Hamlet',
  shortCode: 'BIJ00025',
  district: 'Discovery Bay, Lantau Island',
  street: 'Bijou Hamlet',
  type: 'Residential',
  status: 2,
  occupancyStatus: 'vacant',
  contactStatus: 'active',
  bedrooms: 3,
  bathrooms: null,
  sqft: 1556,
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
  lastUpdated: '17/01/2022',
  updatedBy: '',
  agentNotes: 'Keys: N.',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
};

export default property;
