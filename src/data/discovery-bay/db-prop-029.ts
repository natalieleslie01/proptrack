import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'bij-00020',
  unit: '21 Bijou Hamlet (BIJ00020)',
  building: 'Bijou Hamlet',
  shortCode: 'BIJ00020',
  district: 'Discovery Bay, Lantau Island',
  street: 'Bijou Hamlet',
  type: 'Residential',
  status: 2,
  occupancyStatus: 'with-ta',
  contactStatus: 'active',
  bedrooms: 3,
  bathrooms: null,
  sqft: 1556,
  floor: '',
  yearBuilt: 1994,
  monthlyRent: null,
  salePrice: 34000000,
  landlord: {
    name: '',
    phone: '',
    email: '',
    idNumber: '',
  },
  tenant: null,
  lastUpdated: '17/01/2022',
  updatedBy: '',
  agentNotes: 'Sale: 34M @HK$22K/sqft. Keys: N.',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
};

export default property;
