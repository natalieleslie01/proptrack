import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'db-prop-013',
  unit: '12F',
  building: 'Riviera Gardens',
  district: 'Discovery Bay, Lantau Island',
  street: '2 Discovery Bay Road',
  type: 'Residential',
  status: 1,
  occupancyStatus: 'with-ta',
  bedrooms: 3,
  bathrooms: 2,
  sqft: 1190,
  floor: '12/F',
  yearBuilt: 1991,
  monthlyRent: 30000,
  salePrice: null,
  owner: 'Mr. Patrick Ng',
  landlord: {
    name: 'Mr. Patrick Ng',
    phone: '+852 9012 3344',
    email: 'patrick.ng@ngfamily.hk',
    idNumber: 'J012345(6)',
  },
  tenant: {
    name: 'Ms. Charlotte Davies',
    phone: '+852 6789 4455',
    email: 'charlotte.davies@britishcouncil.org',
    idNumber: 'P778899(0)',
    leaseStart: '01/08/2024',
    leaseEnd: '31/07/2026',
    deposit: 60000,
    stampDutyPaid: true,
    cr109Filed: false,
  },
  lastUpdated: '21/04/2026',
  updatedBy: 'David Cheung',
  agentNotes:
    'CR109 NOT FILED — URGENT. Tenant is British Council staff. Lease expires Jul 2026. Renewal uncertain pending employer contract extension.',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
  keyLocation: { type: 'office', keyNumber: 'K-DB13' },
  agentCommission: { newListing: 'David Cheung' },
  contacts: [
    { id: 'c-db13-1', name: 'Patrick Ng', relationship: 'Owner', mobile: '+852 9012 3344', email: 'patrick.ng@ngfamily.hk', telephone: '', customerCode: 'CUST-013' },
    { id: 'c-db13-2', name: 'Mrs. Ng', relationship: 'Wife', mobile: '+852 9012 7777', email: '', telephone: '', customerCode: 'CUST-013' },
  ],
};

export default property;
