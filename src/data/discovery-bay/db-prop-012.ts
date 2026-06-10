import { Property } from '@/app/property-management/components/mockData';

const property: Property = {
  id: 'db-prop-012',
  unit: 'Villa 3',
  building: 'Toscana',
  district: 'Discovery Bay, Lantau Island',
  street: 'Toscana Lane',
  type: 'Residential',
  status: 1,
  occupancyStatus: 'with-ta',
  bedrooms: 5,
  bathrooms: 4,
  sqft: 3500,
  floor: 'G/F + 1/F + Roof',
  yearBuilt: 2010,
  monthlyRent: 95000,
  salePrice: null,
  owner: 'Lantau Luxury Properties Ltd',
  landlord: {
    name: 'Lantau Luxury Properties Ltd',
    phone: '+852 2876 5544',
    email: 'info@lantauxluxury.com.hk',
    idNumber: 'CR-77889',
  },
  tenant: {
    name: 'Mr. & Mrs. Alexander Webb',
    phone: '+852 6678 1234',
    email: 'alex.webb@jpmchase.com',
    idNumber: 'P667788(9)',
    leaseStart: '01/01/2025',
    leaseEnd: '31/12/2026',
    deposit: 190000,
    stampDutyPaid: true,
    cr109Filed: true,
  },
  lastUpdated: '18/04/2026',
  updatedBy: 'Marcus Wong',
  agentNotes:
    'Premium villa. Tenant is JPMorgan MD. Private pool, garden, and maid quarters. Lease runs to Dec 2026. Owner may sell in 2027 — note for future.',
  photos: ['/assets/images/no_image.png'],
  hasFloorPlan: true,
  keyLocation: { type: 'landlord' },
  agentCommission: { newListing: 'Marcus Wong', newPhotos: 'Marcus Wong' },
  contacts: [
    { id: 'c-db12-1', name: 'Lantau Luxury Manager', relationship: 'Company Contact', mobile: '+852 9876 5544', email: 'info@lantauxluxury.com.hk', telephone: '+852 2876 5544', customerCode: 'CUST-012' },
  ],
};

export default property;
