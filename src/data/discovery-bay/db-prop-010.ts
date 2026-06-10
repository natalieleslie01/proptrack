import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'db-prop-010',
  unit: '2A',
  building: 'Discovery Bay Golf Club Villas',
  district: 'Discovery Bay, Lantau Island',
  street: 'Golf Club Drive',
  type: 'Residential',
  status: 1,
  occupancyStatus: 'with-ta',
  bedrooms: 4,
  bathrooms: 3,
  sqft: 2800,
  floor: 'G/F + 1/F',
  yearBuilt: 1995,
  monthlyRent: 75000,
  salePrice: null,
  owner: 'DB Golf Estates Ltd',
  landlord: {
    name: 'DB Golf Estates Ltd',
    phone: '+852 2987 8899',
    email: 'leasing@dbgolfestates.com.hk',
    idNumber: 'CR-66778',
  },
  tenant: {
    name: 'Mr. & Mrs. Michael Brennan',
    phone: '+852 6567 9900',
    email: 'michael.brennan@swire.com',
    idNumber: 'P556677(8)',
    leaseStart: '01/04/2025',
    leaseEnd: '31/03/2027',
    deposit: 150000,
    stampDutyPaid: true,
    cr109Filed: true,
  },
  lastUpdated: '20/04/2026',
  updatedBy: 'Sophia Liu',
  agentNotes:
    'Overlooks 18th fairway. Tenant is Swire Group executive. Long-term tenant — previously rented for 4 years. CR109 filed. Excellent condition.',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: true,
  keyLocation: { type: 'landlord' },
  agentCommission: { newListing: 'Sophia Liu', newTelephone: 'Sophia Liu' },
  contacts: [
    { id: 'c-db10-1', name: 'DB Golf Estates Manager', relationship: 'Company Contact', mobile: '+852 9987 8899', email: 'leasing@dbgolfestates.com.hk', telephone: '+852 2987 8899', customerCode: 'CUST-010' },
  ],
};

export default property;
