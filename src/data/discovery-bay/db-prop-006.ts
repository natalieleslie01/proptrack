import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'db-prop-006',
  unit: '5A',
  building: 'Positano',
  shortCode: 'POS',
  district: 'Discovery Bay, Lantau Island',
  street: '5 Siena Avenue',
  type: 'Residential',
  status: 2,
  occupancyStatus: 'with-ta',
  bedrooms: 3,
  bathrooms: 2,
  sqft: 1280,
  floor: '5/F',
  yearBuilt: 2011,
  monthlyRent: null,
  salePrice: null,
  owner: 'Mr. Kenneth Fung',
  landlord: {
    name: 'Mr. Kenneth Fung',
    phone: '+852 9234 6677',
    email: 'kenneth.fung@funginvestments.com.hk',
    idNumber: 'E678901(2)',
  },
  tenant: null,
  lastUpdated: '10/04/2026',
  updatedBy: 'Marcus Wong',
  agentNotes:
    'Owner-occupied. Owner uses as weekend retreat. Not currently available. May consider sale in late 2026 — monitor.',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
  keyLocation: { type: 'landlord' },
  agentCommission: {},
  contacts: [
    { id: 'c-db06-1', name: 'Kenneth Fung', relationship: 'Owner', mobile: '+852 9234 6677', email: 'kenneth.fung@funginvestments.com.hk', telephone: '', customerCode: 'CUST-006' },
  ],
};

export default property;
