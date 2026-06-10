import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'db-prop-002',
  unit: '15A',
  building: 'Siena Two',
  shortCode: 'SN2',
  district: 'Discovery Bay, Lantau Island',
  street: '1 Discovery Bay Road',
  type: 'Residential',
  status: 0,
  occupancyStatus: 'vacant',
  bedrooms: 4,
  bathrooms: 3,
  sqft: 1980,
  floor: '15/F',
  yearBuilt: 2002,
  monthlyRent: null,
  salePrice: 18500000,
  owner: 'Mrs. Vivian Cheung',
  landlord: {
    name: 'Mrs. Vivian Cheung',
    phone: '+852 9345 2211',
    email: 'vivian.cheung@outlook.com',
    idNumber: 'B345678(9)',
  },
  tenant: null,
  lastUpdated: '18/04/2026',
  updatedBy: 'Marcus Wong',
  agentNotes:
    'Sea view unit on high floor. Owner relocating to UK. Asking HK$18.5M. 2 viewings confirmed for this week. Motivated seller.',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: true,
  keyLocation: { type: 'office', keyNumber: 'K-DB02' },
  agentCommission: { newListing: 'Marcus Wong', newPhotos: 'Marcus Wong' },
  contacts: [
    { id: 'c-db02-1', name: 'Vivian Cheung', relationship: 'Owner', mobile: '+852 9345 2211', email: 'vivian.cheung@outlook.com', telephone: '', customerCode: 'CUST-002' },
  ],
  comments: [
    { id: 'cmt-db02-1', date: '29/04/2026', agent: 'Marcus Wong', text: 'Owner confirmed she is open to negotiation — will accept HK$17.8M for a quick sale. Two viewings scheduled for 02/05.' },
    { id: 'cmt-db02-2', date: '22/04/2026', agent: 'Marcus Wong', text: 'New professional photos uploaded. Sea view shots look excellent. Listing refreshed on all portals.' },
  ],
};

export default property;
