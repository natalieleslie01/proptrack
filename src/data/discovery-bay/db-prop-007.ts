import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'db-prop-007',
  unit: '10B',
  building: 'Amalfi (Block 1)',
  shortCode: 'AMF01',
  district: 'Discovery Bay, Lantau Island',
  street: '7 Siena Avenue',
  type: 'Residential',
  status: 1,
  occupancyStatus: 'with-ta',
  bedrooms: 2,
  bathrooms: 2,
  sqft: 1050,
  floor: '10/F',
  yearBuilt: 2011,
  monthlyRent: 28500,
  salePrice: null,
  owner: 'DB Realty Holdings',
  landlord: {
    name: 'DB Realty Holdings',
    phone: '+852 2987 4433',
    email: 'admin@dbrealty.com.hk',
    idNumber: 'CR-55667',
  },
  tenant: {
    name: 'Ms. Sophie Laurent',
    phone: '+852 6456 8899',
    email: 'sophie.laurent@airbus.com',
    idNumber: 'P445566(7)',
    leaseStart: '01/11/2024',
    leaseEnd: '31/10/2026',
    deposit: 57000,
    stampDutyPaid: true,
    cr109Filed: true,
  },
  lastUpdated: '16/04/2026',
  updatedBy: 'Alice Tam',
  agentNotes:
    'French expat working at Cathay City. Quiet professional tenant. Lease runs to Oct 2026. Renewal to be discussed Q3 2026.',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: true,
  keyLocation: { type: 'office', keyNumber: 'K-DB07' },
  agentCommission: { newListing: 'Alice Tam', newPhotos: 'Alice Tam' },
  contacts: [
    { id: 'c-db07-1', name: 'DB Realty Manager', relationship: 'Company Contact', mobile: '+852 9987 4433', email: 'admin@dbrealty.com.hk', telephone: '+852 2987 4433', customerCode: 'CUST-007' },
  ],
};

export default property;
