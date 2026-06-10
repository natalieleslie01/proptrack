import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'db-prop-008',
  unit: 'Villa 7',
  building: 'Chianti',
  district: 'Discovery Bay, Lantau Island',
  street: 'Chianti Drive',
  type: 'Residential',
  status: 0,
  occupancyStatus: 'vacant',
  bedrooms: 5,
  bathrooms: 4,
  sqft: 3200,
  floor: 'G/F + 1/F + Roof',
  yearBuilt: 2008,
  monthlyRent: null,
  salePrice: 32000000,
  owner: 'Mr. & Mrs. David Kwong',
  landlord: {
    name: 'Mr. & Mrs. David Kwong',
    phone: '+852 9123 5544',
    email: 'david.kwong@kwongfamily.com',
    idNumber: 'F789012(3)',
  },
  tenant: null,
  lastUpdated: '21/04/2026',
  updatedBy: 'David Cheung',
  agentNotes:
    'Luxury detached villa. Private pool, garden, and rooftop terrace. Asking HK$32M. Owners emigrating. Exclusive listing. Viewings by appointment only.',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: true,
  keyLocation: { type: 'agent', agentName: 'Centaline DB Office', agentPhone: '+852 2987 6543' },
  agentCommission: { newListing: 'David Cheung', newPhotos: 'David Cheung', newKey: 'David Cheung' },
  contacts: [
    { id: 'c-db08-1', name: 'David Kwong', relationship: 'Owner', mobile: '+852 9123 5544', email: 'david.kwong@kwongfamily.com', telephone: '', customerCode: 'CUST-008' },
    { id: 'c-db08-2', name: 'Mrs. Kwong', relationship: 'Wife', mobile: '+852 9123 6666', email: '', telephone: '', customerCode: 'CUST-008' },
  ],
};

export default property;
