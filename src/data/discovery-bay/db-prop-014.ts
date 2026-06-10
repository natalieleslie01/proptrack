import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'db-prop-014',
  unit: '9E',
  building: 'Seacrest',
  district: 'Discovery Bay, Lantau Island',
  street: '4 Discovery Bay Road',
  type: 'Residential',
  status: 0,
  occupancyStatus: 'vacant',
  bedrooms: 2,
  bathrooms: 2,
  sqft: 980,
  floor: '9/F',
  yearBuilt: 2000,
  monthlyRent: null,
  salePrice: null,
  owner: 'Ms. Wendy Chan',
  landlord: {
    name: 'Ms. Wendy Chan',
    phone: '+852 9345 8877',
    email: 'wendy.chan@seacrestprop.com.hk',
    idNumber: 'K123456(7)',
  },
  tenant: null,
  lastUpdated: '20/04/2026',
  updatedBy: 'Sophia Liu',
  agentNotes:
    'Previous tenant vacated 15 Apr. Deep clean completed. Sea-facing unit. Asking HK$26,000/mo. Parking available at extra cost. Ready for immediate occupation.',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: true,
  keyLocation: { type: 'office', keyNumber: 'K-DB14' },
  agentCommission: { newListing: 'Sophia Liu', newKey: 'Sophia Liu' },
  contacts: [
    { id: 'c-db14-1', name: 'Wendy Chan', relationship: 'Owner', mobile: '+852 9345 8877', email: 'wendy.chan@seacrestprop.com.hk', telephone: '', customerCode: 'CUST-014' },
  ],
};

export default property;
