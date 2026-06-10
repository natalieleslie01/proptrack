import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'db-prop-005',
  unit: '22D',
  building: 'La Costa',
  shortCode: 'LAC',
  district: 'Discovery Bay, Lantau Island',
  street: '3 Siena Avenue',
  type: 'Residential',
  status: 1,
  occupancyStatus: 'with-ta',
  bedrooms: 3,
  bathrooms: 2,
  sqft: 1450,
  floor: '22/F',
  yearBuilt: 1995,
  monthlyRent: 42000,
  salePrice: null,
  owner: 'Ms. Cynthia Ho',
  landlord: {
    name: 'Ms. Cynthia Ho',
    phone: '+852 9678 1122',
    email: 'cynthia.ho@gmail.com',
    idNumber: 'D567890(1)',
  },
  tenant: {
    name: 'Dr. Emily Watkins',
    phone: '+852 6345 7788',
    email: 'emily.watkins@hksh.com',
    idNumber: 'P334455(6)',
    leaseStart: '15/09/2024',
    leaseEnd: '14/09/2026',
    deposit: 84000,
    stampDutyPaid: true,
    cr109Filed: true,
  },
  lastUpdated: '17/04/2026',
  updatedBy: 'Sophia Liu',
  agentNotes:
    'High-floor unit with panoramic sea views. Tenant is doctor at HK Sanatorium. Quiet and reliable tenant. AR1 renewal offer to be prepared Aug 2026.',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: true,
  keyLocation: { type: 'landlord' },
  agentCommission: { newListing: 'Sophia Liu' },
  contacts: [
    { id: 'c-db05-1', name: 'Cynthia Ho', relationship: 'Owner', mobile: '+852 9678 1122', email: 'cynthia.ho@gmail.com', telephone: '', customerCode: 'CUST-005' },
  ],
  comments: [
    { id: 'cmt-db05-1', date: '01/05/2026', agent: 'Sophia Liu', text: 'Dr. Watkins confirmed she will renew for 1 year. Preparing renewal TA — rent increase of 3% agreed with landlord.' },
    { id: 'cmt-db05-2', date: '20/04/2026', agent: 'Sophia Liu', text: 'Owner Ms. Ho requested updated rental market report for the building. Sent comparable analysis — current rent is slightly below market.' },
  ],
};

export default property;
