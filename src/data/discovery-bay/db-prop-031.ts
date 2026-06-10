import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'bij-00023',
  unit: '23 Bijou Hamlet',
  building: 'Bijou Hamlet',
  shortCode: 'BIJ00023',
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
  vacantDate: '01/03/2028',
  landlord: {
    name: '',
    phone: '',
    email: '',
    idNumber: '',
  },
  tenant: null,
  lastUpdated: '10/02/2026',
  updatedBy: '',
  agentNotes: 'Keys: N.',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
};

export default property;
