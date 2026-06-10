import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'db-prop-001',
  unit: '8C',
  building: 'Siena One',
  shortCode: 'SN1',
  district: 'Discovery Bay, Lantau Island',
  street: '1 Discovery Bay Road',
  type: 'Residential',
  status: 1,
  occupancyStatus: 'with-ta',
  bedrooms: 3,
  bathrooms: 2,
  sqft: 1320,
  floor: '8/F',
  yearBuilt: 2002,
  monthlyRent: 32000,
  salePrice: null,
  owner: 'Mr. Andrew Lam',
  landlord: {
    name: 'Mr. Andrew Lam',
    phone: '+852 9123 7788',
    email: 'andrew.lam@gmail.com',
    idNumber: 'A234567(8)',
  },
  tenant: {
    name: 'Mr. James Thornton',
    phone: '+852 6234 8899',
    email: 'james.thornton@hsbcgroup.com',
    idNumber: 'P112233(4)',
    leaseStart: '01/03/2025',
    leaseEnd: '28/02/2027',
    deposit: 64000,
    stampDutyPaid: true,
    cr109Filed: true,
  },
  lastUpdated: '15/04/2026',
  updatedBy: 'Alice Tam',
  agentNotes:
    'Expat tenant working in Central. Commutes via DB ferry. Renewal likely. CR109 filed. Property well maintained.',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: true,
  keyLocation: { type: 'landlord' },
  agentCommission: { newListing: 'Alice Tam', newTelephone: 'Alice Tam' },
  contacts: [
    { id: 'c-db01-1', name: 'Andrew Lam', relationship: 'Owner', mobile: '+852 9123 7788', email: 'andrew.lam@gmail.com', telephone: '', customerCode: 'CUST-001' },
  ],
  comments: [
    { id: 'cmt-db01-1', date: '28/04/2026', agent: 'Alice Tam', text: 'Spoke with tenant Mr. Thornton — confirmed renewal interest for another 2 years. Will prepare AR1 renewal offer this week.' },
    { id: 'cmt-db01-2', date: '15/04/2026', agent: 'Alice Tam', text: 'CR109 filed and confirmed with stamp office. Deposit receipt sent to landlord.' },
  ],
};

export default property;
