import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'bij-00005',
  unit: '5 Bijou Hamlet (BIJ00005)',
  building: 'Bijou Hamlet',
  shortCode: 'BIJ00005',
  district: 'Discovery Bay, Lantau Island',
  street: 'Bijou Hamlet',
  type: 'Residential',
  status: 0,
  occupancyStatus: 'vacant',
  contactStatus: 'unknown',
  bedrooms: 4,
  bathrooms: null,
  sqft: 2264,
  floor: '',
  yearBuilt: 1994,
  monthlyRent: null,
  salePrice: 68000000,
  landlord: {
    name: '',
    phone: '',
    email: '',
    idNumber: '',
  },
  tenant: null,
  lastUpdated: '22/11/2022',
  updatedBy: '',
  agentNotes: 'Sale: 68M @HK$30K/sqft. Keys: N.',
  highlight: 'NT',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
};

export default property;
