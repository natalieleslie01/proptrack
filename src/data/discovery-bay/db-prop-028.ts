import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'bij-00019',
  unit: '19 Bijou Hamlet',
  building: 'Bijou Hamlet',
  shortCode: 'BIJ00019',
  district: 'Discovery Bay, Lantau Island',
  street: 'Bijou Hamlet',
  type: 'Residential',
  status: 2,
  occupancyStatus: 'with-ta',
  contactStatus: 'active',
  bedrooms: 4,
  bathrooms: null,
  sqft: 1556,
  floor: '',
  yearBuilt: 1994,
  monthlyRent: 90000,
  salePrice: 49800000,
  landlord: {
    name: '',
    phone: '',
    email: '',
    idNumber: '',
  },
  tenant: null,
  lastUpdated: '14/12/2021',
  updatedBy: '',
  agentNotes: 'Sale: 49.8M @HK$32K/sqft. Lease: 90K @HK$58/sqft. Keys: Kingsford().',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
  keyLocation: { type: 'agent', agentName: 'Kingsford' },
};

export default property;
