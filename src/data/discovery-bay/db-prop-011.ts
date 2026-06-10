import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'db-prop-011',
  unit: '6D',
  building: 'Palma',
  district: 'Discovery Bay, Lantau Island',
  street: '11 Siena Avenue',
  type: 'Residential',
  status: 0,
  occupancyStatus: 'vacant',
  bedrooms: 1,
  bathrooms: 1,
  sqft: 620,
  floor: '6/F',
  yearBuilt: 2007,
  monthlyRent: null,
  salePrice: null,
  owner: 'Mr. Tommy Lau',
  landlord: {
    name: 'Mr. Tommy Lau',
    phone: '+852 9789 2233',
    email: 'tommy.lau@gmail.com',
    idNumber: 'H901234(5)',
  },
  tenant: null,
  lastUpdated: '19/04/2026',
  updatedBy: 'Alice Tam',
  agentNotes:
    'Compact studio-style 1-bed. Ideal for single professional. Asking HK$16,500/mo. Fully furnished option available. Ferry pier 5 min walk.',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
  keyLocation: { type: 'office', keyNumber: 'K-DB11' },
  agentCommission: { newListing: 'Alice Tam', newKey: 'Alice Tam' },
  contacts: [
    { id: 'c-db11-1', name: 'Tommy Lau', relationship: 'Owner', mobile: '+852 9789 2233', email: 'tommy.lau@gmail.com', telephone: '', customerCode: 'CUST-011' },
    { id: 'c-db11-2', name: 'Mrs. Lau', relationship: 'Wife', mobile: '+852 9789 4444', email: '', telephone: '', customerCode: 'CUST-011' },
  ],
};

export default property;
