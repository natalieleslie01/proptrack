import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'bij-00016',
  unit: '16 Bijou Hamlet',
  building: 'Bijou Hamlet',
  shortCode: 'BIJ00016',
  district: 'Discovery Bay, Lantau Island',
  street: 'Bijou Hamlet',
  type: 'Residential',
  status: 9,
  occupancyStatus: 'vacant',
  contactStatus: 'no-contact',
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
  lastUpdated: '31/05/2021',
  updatedBy: '',
  agentNotes: 'Keys: N | S.A.: N | Shell Co: N | Highlight: N | Photo: N',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
  keyLocation: { type: 'none' },
};

export default property;
