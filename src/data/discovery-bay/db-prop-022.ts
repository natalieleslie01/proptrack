import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'bij-00009',
  unit: '9 Bijou Hamlet',
  building: 'Bijou Hamlet',
  shortCode: 'BIJ00009',
  district: 'Discovery Bay, Lantau Island',
  street: 'Bijou Hamlet',
  type: 'Residential',
  status: 1,
  occupancyStatus: 'leased',
  contactStatus: 'unknown',
  bedrooms: 3,
  bathrooms: null,
  sqft: 1556,
  floor: '',
  yearBuilt: 1994,
  monthlyRent: null,
  salePrice: null,
  vacantDate: '30/04/2021',
  landlord: {
    name: '',
    phone: '',
    email: '',
    idNumber: '',
  },
  tenant: null,
  lastUpdated: '06/03/2023',
  updatedBy: '',
  agentNotes: 'Keys: Kingsford().',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
  keyLocation: { type: 'agent', agentName: 'Kingsford' },
};

export default property;
