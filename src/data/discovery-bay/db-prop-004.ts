import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'db-prop-004',
  unit: 'Villa 12',
  building: 'Headland',
  shortCode: 'HEA',
  district: 'Discovery Bay, Lantau Island',
  street: 'Headland Drive',
  type: 'Residential',
  status: 1,
  occupancyStatus: 'with-ta',
  bedrooms: 4,
  bathrooms: 3,
  sqft: 2650,
  floor: 'G/F + 1/F',
  yearBuilt: 1982,
  monthlyRent: 68000,
  salePrice: null,
  owner: 'Headland Estates Ltd',
  landlord: {
    name: 'Headland Estates Ltd',
    phone: '+852 2987 5566',
    email: 'leasing@headlandestates.com.hk',
    idNumber: 'CR-22334',
  },
  tenant: {
    name: 'Mr. & Mrs. Robert Sinclair',
    phone: '+852 6123 4455',
    email: 'robert.sinclair@morganstanley.com',
    idNumber: 'P223344(5)',
    leaseStart: '01/07/2024',
    leaseEnd: '30/06/2026',
    deposit: 136000,
    stampDutyPaid: true,
    cr109Filed: true,
  },
  lastUpdated: '19/04/2026',
  updatedBy: 'Alice Tam',
  agentNotes:
    'Detached villa with private garden and rooftop terrace. Tenant is senior banker. Lease expiring Jun 2026 — renewal discussion to begin May.',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: true,
  keyLocation: { type: 'landlord' },
  agentCommission: { newListing: 'Alice Tam', newTelephone: 'Alice Tam' },
  contacts: [
    { id: 'c-db04-1', name: 'Headland Manager', relationship: 'Company Contact', mobile: '+852 9987 5566', email: 'leasing@headlandestates.com.hk', telephone: '+852 2987 5566', customerCode: 'CUST-004' },
  ],
  comments: [
    { id: 'cmt-db04-1', date: '27/04/2026', agent: 'Alice Tam', text: 'Called Mr. Sinclair re: lease renewal. He is considering a transfer to Singapore in Q3 — will confirm by end of May. Monitoring closely.' },
    { id: 'cmt-db04-2', date: '19/04/2026', agent: 'Kevin Ng', text: 'Routine inspection completed. Property in excellent condition. Garden well maintained by tenant. No issues noted.' },
  ],
};

export default property;
