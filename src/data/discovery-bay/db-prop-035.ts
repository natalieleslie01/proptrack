import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'bij-00028',
  unit: '28 Bijou Hamlet',
  building: 'Bijou Hamlet',
  shortCode: 'BIJ00028',
  district: 'Discovery Bay, Lantau Island',
  street: 'Bijou Hamlet',
  type: 'Residential',
  status: 1,
  occupancyStatus: 'leased',
  contactStatus: 'active',
  bedrooms: 5,
  bathrooms: null,
  sqft: 2504,
  floor: '',
  yearBuilt: 1994,
  monthlyRent: null,
  salePrice: null,
  vacantDate: '01/01/2024',
  landlord: {
    name: '',
    phone: '',
    email: '',
    idNumber: '',
  },
  tenant: null,
  lastUpdated: '22/11/2023',
  updatedBy: '',
  agentNotes: 'Keys: N.',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
};

export default property;
