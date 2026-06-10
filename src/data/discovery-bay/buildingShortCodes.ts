// Building short codes — official iREMS v2.0 short codes
export interface BuildingShortCode {
  name: string;
  shortCode: string;
}

export const buildingShortCodes: BuildingShortCode[] = [
  { name: 'Amalfi (Block 1)', shortCode: 'AMF01' },
  { name: 'Amalfi (Block 2)', shortCode: 'AMF02' },
  { name: 'Amalfi (Block 3)', shortCode: 'AMF03' },
  { name: 'Bay View', shortCode: 'BAY' },
  { name: 'Bijou Hamlet', shortCode: 'BIJ' },
  { name: 'Blossom Court', shortCode: 'BLO' },
  { name: 'Brilliance Court', shortCode: 'HG2' },
  { name: 'Celestial Mansion', shortCode: 'AH1' },
  { name: 'Cherish Court', shortCode: 'CHE' },
  { name: 'Clear View', shortCode: 'CLR' },
  { name: 'Coastline', shortCode: 'CSL' },
  { name: 'Coral Court', shortCode: 'COR' },
  { name: 'Costa Court', shortCode: 'CT1' },
  { name: 'Crestline Mansion', shortCode: 'CRE' },
  { name: 'Crestmont', shortCode: 'CMV' },
  { name: 'Crystal Court', shortCode: 'CRY' },
  { name: 'DB Plaza', shortCode: 'DBP' },
  { name: 'Elegance Court', shortCode: 'HG3' },
  { name: 'Glamour Court', shortCode: 'HG1' },
  { name: 'Graceful Mansion', shortCode: 'AH2' },
  { name: 'Greenbelt Court', shortCode: 'G09' },
  { name: 'Greenburg Court', shortCode: 'G02' },
  { name: 'Greendale Court', shortCode: 'G06' },
  { name: 'Greenery Court', shortCode: 'G01' },
  { name: 'Greenfield Court', shortCode: 'G03' },
  { name: 'Greenish Court', shortCode: 'G04' },
  { name: 'Greenland Court', shortCode: 'G05' },
  { name: 'Greenmont Court', shortCode: 'G08' },
  { name: 'Greenwood Court', shortCode: 'G07' },
  { name: 'Haven Court', shortCode: 'T02' },
  { name: 'Headland', shortCode: 'HEA' },
  { name: 'Island View', shortCode: 'ILV' },
  { name: 'Jovial Court', shortCode: 'T01' },
  { name: 'Joyful Mansion', shortCode: 'AH3' },
  { name: 'La Costa', shortCode: 'LAC' },
  { name: 'La Serene', shortCode: 'LAS' },
  { name: 'La Vista', shortCode: 'LAV' },
  { name: 'Lower Caperidge', shortCode: 'CPL' },
  { name: 'Marine View', shortCode: 'MRV' },
  { name: 'Middle Lane', shortCode: 'MID' },
  { name: 'Mountain View', shortCode: 'H04' },
  { name: 'Neo Horizon 1', shortCode: 'NEO01' },
  { name: 'Neo Horizon 2', shortCode: 'NEO02' },
  { name: 'Onda Court', shortCode: 'CT2' },
  { name: 'Parkland', shortCode: 'PLD' },
  { name: 'Parkvale', shortCode: 'PAV' },
  { name: 'Peaceful Mansion', shortCode: 'AH5' },
  { name: 'Pine View', shortCode: 'PIN' },
  { name: 'Poggibonsi', shortCode: 'POG' },
  { name: 'Poggibonsi (Block 5)', shortCode: 'POG05' },
  { name: 'Poggibonsi (Block 6)', shortCode: 'POG06' },
  { name: 'Poggibonsi (Block 8)', shortCode: 'POG08' },
  { name: 'Positano', shortCode: 'POS' },
  { name: 'Seabee', shortCode: 'SEL' },
  { name: 'Seabird', shortCode: 'SBL' },
  { name: 'Seahorse', shortCode: 'SHL' },
  { name: 'Seaview', shortCode: 'H02' },
  { name: 'Serene Court', shortCode: 'SER' },
  { name: 'Siena One', shortCode: 'SN1' },
  { name: 'Siena Two', shortCode: 'SN2' },
  { name: 'Skyline Mansion', shortCode: 'SKY' },
  { name: 'Starview', shortCode: 'H01' },
  { name: 'Sunrise', shortCode: 'H03' },
  { name: 'The Barion (Block 2)', shortCode: 'CHI02' },
  { name: 'The Hemex (Block 3)', shortCode: 'CHI03' },
  { name: 'The Lustre (Block 5)', shortCode: 'CHI05' },
  { name: 'The Pavilion (Block 1)', shortCode: 'CHI01' },
  { name: 'The Premier (Block 6)', shortCode: 'CHI06' },
  { name: 'Twilight Court', shortCode: 'TWI' },
  { name: 'Upper Caperidge', shortCode: 'CPU' },
  { name: 'Verdant Court', shortCode: 'T03' },
  { name: 'Vista Court', shortCode: 'VIS' },
  { name: 'Woodbury Court', shortCode: 'WBC' },
  { name: 'Woodgreen Court', shortCode: 'WGC' },
  { name: 'Woodland Court', shortCode: 'WLC' },
];

export function getBuildingShortCode(buildingName: string): string | undefined {
  const entry = buildingShortCodes.find(
    (b) => b.name.toLowerCase() === buildingName.toLowerCase()
  );
  return entry?.shortCode;
}

export function getBuildingByShortCode(shortCode: string): string | undefined {
  const entry = buildingShortCodes.find(
    (b) => b.shortCode.toLowerCase() === shortCode.toLowerCase()
  );
  return entry?.name;
}

export default buildingShortCodes;
