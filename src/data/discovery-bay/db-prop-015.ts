import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'db-prop-015',
  unit: '20B',
  building: 'Hillgrove',
  district: 'Discovery Bay, Lantau Island',
  street: '6 Discovery Bay Road',
  type: 'Residential',
  status: 1,
  occupancyStatus: 'vacant-soon',
  bedrooms: 3,
  bathrooms: 2,
  sqft: 1560,
  floor: '20/F',
  yearBuilt: 2002,
  monthlyRent: 48000,
  salePrice: null,
  owner: 'DB Hillgrove Investments',
  landlord: {
    name: 'DB Hillgrove Investments',
    phone: '+852 2876 9900',
    email: 'admin@dbhillgrove.com.hk',
    idNumber: 'CR-88990',
  },
  tenant: {
    name: 'Mr. & Mrs. Takashi Yamamoto',
    phone: '+852 6890 5566',
    email: 'takashi.yamamoto@sony.com',
    idNumber: 'P889900(1)',
    leaseStart: '01/06/2024',
    leaseEnd: '31/05/2026',
    deposit: 96000,
    stampDutyPaid: true,
    cr109Filed: true,
  },
  lastUpdated: '17/04/2026',
  updatedBy: 'Alice Tam',
  agentNotes:
    'Japanese expat family. Tenant works at Sony HK. Lease expiring May 2026 — renewal discussion to begin this month. Tenant has indicated interest in staying.',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: true,
  keyLocation: { type: 'landlord' },
  agentCommission: { newListing: 'Alice Tam', newTelephone: 'Alice Tam' },
  contacts: [
    { id: 'c-db15-1', name: 'DB Hillgrove Manager', relationship: 'Company Contact', mobile: '+852 9876 9900', email: 'admin@dbhillgrove.com.hk', telephone: '+852 2876 9900', customerCode: 'CUST-015' },
  ],
};

export default property;
