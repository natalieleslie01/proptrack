/**
 * Discovery Bay, Lantau Island — Property Portfolio
 * Properties across residential developments in DB.
 * All properties conform to the PropTrack HK Property interface.
 *
 * Buildings covered:
 *  - Siena One & Two
 *  - Discovery Bay Plaza Residences
 *  - Headland Village
 *  - La Costa
 *  - Positano
 *  - Amalfi
 *  - Chianti
 *  - Bijou Hamlet (BIJ00001–BIJ00032)
 *  - Discovery Bay Golf Club Villas
 *  - Palma
 *  - Toscana
 *  - Riviera Gardens
 *  - Seacrest
 *  - Hillgrove
 */

import { Property } from '@/app/property-management/components/mockData';

import prop001 from './db-prop-001';
import prop002 from './db-prop-002';
import prop003 from './db-prop-003';
import prop004 from './db-prop-004';
import prop005 from './db-prop-005';
import prop006 from './db-prop-006';
import prop007 from './db-prop-007';
import prop008 from './db-prop-008';
// BIJ00001
import prop009 from './db-prop-009';
import prop010 from './db-prop-010';
import prop011 from './db-prop-011';
import prop012 from './db-prop-012';
import prop013 from './db-prop-013';
import prop014 from './db-prop-014';
import prop015 from './db-prop-015';
// Bijou Hamlet additional records
import prop016 from './db-prop-016';
import prop017 from './db-prop-017';
import prop018 from './db-prop-018';
import prop019 from './db-prop-019';
import prop020 from './db-prop-020';
import prop021 from './db-prop-021';
import prop022 from './db-prop-022';
import prop023 from './db-prop-023';
import prop024 from './db-prop-024';
import prop025 from './db-prop-025';
import prop026 from './db-prop-026';
import prop027 from './db-prop-027';
import prop028 from './db-prop-028';
import prop029 from './db-prop-029';
import prop030 from './db-prop-030';
import prop031 from './db-prop-031';
import prop032 from './db-prop-032';
import prop033 from './db-prop-033';
import prop034 from './db-prop-034';
import prop035 from './db-prop-035';
import prop036 from './db-prop-036';
import prop037 from './db-prop-037';
import prop038 from './db-prop-038';
import prop039 from './db-prop-039';
// Bijou Hamlet page 2 records (BIJ00016, BIJ00017, BIJ00022)
import prop040 from './db-prop-040';
import prop041 from './db-prop-041';
import prop042 from './db-prop-042';

export const discoveryBayProperties: Property[] = [
  prop001,
  prop002,
  prop003,
  prop004,
  prop005,
  prop006,
  prop007,
  prop008,
  prop009,
  prop010,
  prop011,
  prop012,
  prop013,
  prop014,
  prop015,
  prop016,
  prop017,
  prop018,
  prop019,
  prop020,
  prop021,
  prop022,
  prop023,
  prop024,
  prop025,
  prop026,
  prop027,
  prop028,
  prop029,
  prop030,
  prop031,
  prop032,
  prop033,
  prop034,
  prop035,
  prop036,
  prop037,
  prop038,
  prop039,
  prop040,
  prop041,
  prop042,
];

export default discoveryBayProperties;

// Summary statistics
export const discoveryBaySummary = {
  totalProperties: discoveryBayProperties.length,
  district: 'Discovery Bay, Lantau Island',
  buildings: [
    'Siena One',
    'Siena Two',
    'Discovery Bay Plaza Residences',
    'Headland Village',
    'La Costa',
    'Positano',
    'Amalfi',
    'Chianti',
    'Bijou Hamlet',
    'Discovery Bay Golf Club Villas',
    'Palma',
    'Toscana',
    'Riviera Gardens',
    'Seacrest',
    'Hillgrove',
  ],
  statusBreakdown: {
    leased: discoveryBayProperties.filter((p) => p.status === 'leased').length,
    forRent: discoveryBayProperties.filter((p) => p.status === 'for-rent').length,
    forSale: discoveryBayProperties.filter((p) => p.status === 'for-sale').length,
    forSaleAndRent: discoveryBayProperties.filter((p) => p.status === 'for-sale-and-rent').length,
    selfOccupy: discoveryBayProperties.filter((p) => p.status === 'self-occupy').length,
  },
};
