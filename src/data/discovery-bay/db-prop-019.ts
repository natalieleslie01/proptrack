import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'bij-00006',
  unit: '6 Bijou Hamlet',
  building: 'Bijou Hamlet',
  shortCode: 'BIJ00006',
  district: 'Discovery Bay, Lantau Island',
  street: 'Bijou Hamlet',
  type: 'Residential',
  status: 1,
  occupancyStatus: 'vacant',
  contactStatus: 'no-contact',
  bedrooms: 5,
  bathrooms: null,
  sqft: 2264,
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
  agentNotes: 'Keys: Kingsford().',
  highlight: 'NT',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
  keyLocation: { type: 'agent', agentName: 'Kingsford' },
};

export default property;
