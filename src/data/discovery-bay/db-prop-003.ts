import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'db-prop-003',
  unit: '3B',
  building: 'DB Plaza',
  shortCode: 'DBP',
  district: 'Discovery Bay, Lantau Island',
  street: '11 Siena Avenue',
  type: 'Residential',
  status: 0,
  occupancyStatus: 'vacant',
  bedrooms: 2,
  bathrooms: 1,
  sqft: 860,
  floor: '3/F',
  yearBuilt: 1991,
  monthlyRent: null,
  salePrice: null,
  owner: 'Mr. Peter Yuen',
  landlord: {
    name: 'Mr. Peter Yuen',
    phone: '+852 9567 3344',
    email: 'peter.yuen@yahoo.com.hk',
    idNumber: 'C456789(0)',
  },
  tenant: null,
  lastUpdated: '20/04/2026',
  updatedBy: 'David Cheung',
  agentNotes:
    'Recently renovated. New kitchen and bathrooms. Available immediately. Asking HK$22,000/mo. Parking space included.',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: false,
  keyLocation: { type: 'office', keyNumber: 'K-DB03' },
  agentCommission: { newListing: 'David Cheung', newKey: 'David Cheung' },
  contacts: [
    { id: 'c-db03-1', name: 'Peter Yuen', relationship: 'Owner', mobile: '+852 9567 3344', email: 'peter.yuen@yahoo.com.hk', telephone: '', customerCode: 'CUST-003' },
    { id: 'c-db03-2', name: 'Mrs. Yuen', relationship: 'Wife', mobile: '+852 9567 5555', email: '', telephone: '', customerCode: 'CUST-003' },
  ],
  comments: [
    { id: 'cmt-db03-1', date: '30/04/2026', agent: 'David Cheung', text: 'Prospective tenant viewed today — very interested. Couple with one child, both professionals. Awaiting their decision by Friday.' },
    { id: 'cmt-db03-2', date: '25/04/2026', agent: 'Rachel Chan', text: 'Parking space confirmed included in rent. Owner agreed to repaint the living room before move-in.' },
  ],
};

export default property;
