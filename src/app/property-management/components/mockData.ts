import { discoveryBayProperties } from '@/data/discovery-bay';

export type PropertyStatus = 0 | 1 | 2 | 3 | 4 | 9 | 99;
// 0 = Active, 1 = Leased, 2 = Self Occupy, 3 = No Contact, 4 = Sold, 9 = Unknown, 99 = Blank
export type OccupancyStatus = 'vacant' | 'vacant-soon' | 'leased' | 'with-ta';
export type PropertyType = 'Residential' | 'Serviced Apartment';
export type ContactStatus = 'active' | 'no-contact' | 'unknown';
export type DirectionType = 'North' | 'North East' | 'East' | 'South' | 'South East' | 'West' | 'South West' | 'North West';
export type ViewType = 'Sea View' | 'Green View' | 'City View' | 'Mountain View' | 'Pool View' | 'Garden View' | 'Street View' | 'Open View';
export type DecorationType = 'Deluxe' | 'Good' | 'Fair' | 'Original' | '---';
export type FurnishingType = 'Fully Furnished' | 'Partly Furnished' | 'Unfurnished';
export type AdditionalFeature = 'Balcony' | 'Terrace' | 'Garden' | 'Pool' | 'Garden Terrace' | 'Roof Top' | 'Duplex' | 'Triplex' | 'Combined Unit' | 'Open Kitchen';
export type BuildingType = 'House' | 'Low Rise' | 'High Rise';
export type FloorType = 'Ground' | 'Low' | 'Medium' | 'High';
export type FloorNumber = 'LG' | 'G' | 'UG' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18' | '19' | '20' | '21' | '22' | '23' | '24' | '25' | '26' | '27' | '28' | '29' | '30';

export const ALL_ADDITIONAL_FEATURES: AdditionalFeature[] = ['Balcony', 'Terrace', 'Garden', 'Pool', 'Garden Terrace', 'Roof Top', 'Duplex', 'Triplex', 'Combined Unit', 'Open Kitchen'];
export const ALL_DIRECTIONS: DirectionType[] = ['North', 'North East', 'East', 'South', 'South East', 'West', 'South West', 'North West'];
export const ALL_VIEWS: ViewType[] = ['Sea View', 'Green View', 'City View', 'Mountain View', 'Pool View', 'Garden View', 'Street View', 'Open View'];
export const ALL_DECORATIONS: DecorationType[] = ['Deluxe', 'Good', 'Fair', 'Original', '---'];
export const ALL_FURNISHINGS: FurnishingType[] = ['Fully Furnished', 'Partly Furnished', 'Unfurnished'];
export const ALL_BUILDING_TYPES: BuildingType[] = ['House', 'Low Rise', 'High Rise'];
export const ALL_FLOOR_TYPES: FloorType[] = ['Ground', 'Low', 'Medium', 'High'];
export const ALL_FLOOR_NUMBERS: FloorNumber[] = ['LG', 'G', 'UG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30'];

export const PROPERTY_STATUS_OPTIONS: Array<{ value: PropertyStatus; label: string }> = [
  { value: 0, label: 'Active' },
  { value: 1, label: 'Leased' },
  { value: 2, label: 'Self Occupy' },
  { value: 3, label: 'No Contact' },
  { value: 4, label: 'Sold' },
  { value: 9, label: 'Unknown' },
  { value: 99, label: 'Blank' },
];

export function getPropertyStatusLabel(status: PropertyStatus | undefined | null): string {
  if (status === undefined || status === null) return 'Blank';
  const found = PROPERTY_STATUS_OPTIONS.find((o) => o.value === status);
  return found ? found.label : 'Blank';
}

export type KeyLocationType = 'office' | 'agent' | 'landlord';

export interface KeyLocation {
  type: KeyLocationType;
  keyNumber?: string;
  agentName?: string;
  agentPhone?: string;
}

export interface PropertyContact {
  id: string;
  name: string;
  relationship: string;
  mobile: string;
  email: string;
  telephone: string;
  customerCode?: string;
}

export interface AgentCommission {
  newListing?: string;
  eaaForm?: string;
  newPhotos?: string;
  newMatterport?: string;
  newKey?: string;
  newTelephone?: string;
}

export interface PropertyComment {
  id: string;
  date: string;
  agent: string;
  text: string;
}

export interface HistoryEntry {
  id: string;
  date: string;
  agent: string;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
}

export interface AgentProfile {
  name: string;
  licenceNumber: string;
  mobile: string;
  email: string;
}

export interface Property {
  id: string;
  ref?: string;
  unit: string;
  building: string;
  shortCode?: string;
  district: string;
  village?: string;
  street: string;
  type: PropertyType;
  status: PropertyStatus;
  occupancyStatus: OccupancyStatus;
  contactStatus?: ContactStatus;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number;
  grossSqft?: number;
  floor: string;
  yearBuilt?: number;
  direction?: DirectionType;
  view?: ViewType;
  decoration?: DecorationType;
  originalFurnishing?: FurnishingType;
  outdoorArea?: string;
  buildingType?: BuildingType;
  floorType?: FloorType;
  floorNumber?: FloorNumber;
  additionalFeatures?: AdditionalFeature[];
  websiteLink?: string;
  monthlyRent: number | null;
  salePrice: number | null;
  listingDate?: string;
  vacantDate?: string;
  owner?: string;
  landlord: {
    name: string;
    phone: string;
    email: string;
    idNumber: string;
  };
  tenant: {
    name: string;
    phone: string;
    email: string;
    idNumber: string;
    leaseStart: string;
    leaseEnd: string;
    deposit: number;
    stampDutyPaid: boolean;
    cr109Filed: boolean;
  } | null;
  lastUpdated: string;
  updatedBy: string;
  agentNotes: string;
  highlight?: string;
  photos: string[];
  hasFloorPlan: boolean;
  matterportLink?: string;
  keyLocation?: KeyLocation;
  agentCommission?: AgentCommission;
  contacts?: PropertyContact[];
  comments?: PropertyComment[];
  historyLog?: HistoryEntry[];
  importBatchId?: string;
  validationStatus?: string;
  phase?: string;
  buildingName?: string;
}

export const agentNames = [
  'Natalie Leslie',
  'Nicola Baird',
  'Cris Yan',
];

export const agentProfiles: AgentProfile[] = [
  { name: 'Natalie Leslie', licenceNumber: 'E-342079', mobile: '+852 9197 0235', email: 'natalie@homesrus.hk' },
  { name: 'Nicola Baird', licenceNumber: 'S-582179', mobile: '+852 9389 0995', email: 'nicky@homesrus.hk' },
  { name: 'Cris Yan', licenceNumber: 'S-148717', mobile: '+852 9083 4741', email: 'cris@homesrus.hk' },
];

export const mockProperties: Property[] = [
  ...discoveryBayProperties,
];

export const transactions: { id: string; propId: string; date: string; type: string; amount: number; party: string; agent: string; notes: string }[] = [];
