import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// All data extracted from the uploaded spreadsheet image
// Columns: Building Name | Short Code | Phase | Village | Build Year
const SPREADSHEET_DATA = [
  { building_name: 'Seabee Lane', short_code: 'SEL', phase: '1', village: 'Beach Village', build_year: 1982 },
  { building_name: 'Seabird Lane', short_code: 'SBL', phase: '1', village: 'Beach Village', build_year: 1982 },
  { building_name: 'Seahorse', short_code: 'SHL', phase: '1', village: 'Beach Village', build_year: 1982 },
  { building_name: 'Headland', short_code: 'HEA', phase: '1', village: 'Headland Village', build_year: 1982 },
  { building_name: 'Starview', short_code: 'H01', phase: '1', village: 'Parkridge Village', build_year: 1982 },
  { building_name: 'Seaview', short_code: 'H02', phase: '1', village: 'Parkridge Village', build_year: 1982 },
  { building_name: 'Sunrise', short_code: 'H03', phase: '1', village: 'Parkridge Village', build_year: 1982 },
  { building_name: 'Mountain View', short_code: 'H04', phase: '1', village: 'Parkridge Village', build_year: 1982 },
  { building_name: 'Parkland Drive', short_code: 'PLD', phase: '1', village: 'Parkland Drive', build_year: 1987 },
  { building_name: 'Clearview', short_code: 'CLR', phase: '2', village: 'Midvale Village', build_year: 1985 },
  { building_name: 'Bay View', short_code: 'BAY', phase: '2', village: 'Midvale Village', build_year: 1985 },
  { building_name: 'Marine View', short_code: 'MRV', phase: '2', village: 'Midvale Village', build_year: 1985 },
  { building_name: 'Island View', short_code: 'ISL', phase: '2', village: 'Midvale Village', build_year: 1985 },
  { building_name: 'Pine View', short_code: 'PIN', phase: '2', village: 'Midvale Village', build_year: 1985 },
  { building_name: 'Middle La', short_code: 'MID', phase: '2', village: 'Midvale Village', build_year: 1986 },
  { building_name: 'Glamour Court', short_code: 'HG1', phase: '3', village: 'Hillgrove Village', build_year: 1988 },
  { building_name: 'Brilliance', short_code: 'HG2', phase: '3', village: 'Hillgrove Village', build_year: 1988 },
  { building_name: 'Elegance Court', short_code: 'HG3', phase: '3', village: 'Hillgrove Village', build_year: 1988 },
  { building_name: 'Coral Court', short_code: 'COR', phase: '3', village: 'Parkvale Village', build_year: 1988 },
  { building_name: 'Crystal Court', short_code: 'CRY', phase: '3', village: 'Parkvale Village', build_year: 1988 },
  { building_name: 'Woodburn Court', short_code: 'WBC', phase: '3', village: 'Parkvale Village', build_year: 1988 },
  { building_name: 'Woodgreen Court', short_code: 'WGC', phase: '3', village: 'Parkvale Village', build_year: 1988 },
  { building_name: 'Woodland Court', short_code: 'WLC', phase: '3', village: 'Parkvale Village', build_year: 1988 },
  { building_name: 'Parkvale Court', short_code: 'PAV', phase: '3', village: 'Parkvale Village', build_year: 1988 },
  { building_name: 'Twilight Court', short_code: 'TWI', phase: '4', village: 'Peninsula Village', build_year: 1992 },
  { building_name: 'Jovial Court', short_code: 'T01', phase: '4', village: 'Peninsula Village', build_year: 1990 },
  { building_name: 'Haven Court', short_code: 'T02', phase: '4', village: 'Peninsula Village', build_year: 1990 },
  { building_name: 'Verdant Court', short_code: 'T03', phase: '4', village: 'Peninsula Village', build_year: 1990 },
  { building_name: 'Blossom Court', short_code: 'BLO', phase: '4', village: 'Peninsula Village', build_year: 1992 },
  { building_name: 'Cherish Court', short_code: 'CHE', phase: '4', village: 'Peninsula Village', build_year: 1992 },
  { building_name: 'Coastline', short_code: 'CSL', phase: '4', village: 'Peninsula Village', build_year: 1996 },
  { building_name: 'Lower Cape', short_code: 'CPL', phase: '4', village: 'Peninsula Village', build_year: 1991 },
  { building_name: 'Upper Cape', short_code: 'CPU', phase: '4', village: 'Peninsula Village', build_year: 1990 },
  { building_name: 'Crestmont', short_code: 'CMV', phase: '4', village: 'Peninsula Village', build_year: 1994 },
  { building_name: 'Greenery', short_code: 'G01', phase: '5', village: 'Greenvale Village', build_year: 1990 },
  { building_name: 'Greenfield', short_code: 'G02', phase: '5', village: 'Greenvale Village', build_year: 1990 },
  { building_name: 'Greenfield', short_code: 'G03', phase: '5', village: 'Greenvale Village', build_year: 1990 },
  { building_name: 'Greenish', short_code: 'G04', phase: '5', village: 'Greenvale Village', build_year: 1991 },
  { building_name: 'Greenery', short_code: 'G05', phase: '5', village: 'Greenvale Village', build_year: 1991 },
  { building_name: 'Greendale', short_code: 'G06', phase: '5', village: 'Greenvale Village', build_year: 1991 },
  { building_name: 'Greenwood', short_code: 'G07', phase: '5', village: 'Greenvale Village', build_year: 1994 },
  { building_name: 'Greenmoor', short_code: 'G08', phase: '5', village: 'Greenvale Village', build_year: 1994 },
  { building_name: 'Greenbelt', short_code: 'G09', phase: '5', village: 'Greenvale Village', build_year: 1994 },
  { building_name: 'DB Plaza', short_code: 'DBP', phase: '6', village: 'DB Plaza', build_year: 1991 },
  { building_name: 'La Vista Blanca', short_code: 'LAV', phase: '7', village: 'La Vista', build_year: 1994 },
  { building_name: 'Vista Court', short_code: 'VIS', phase: '7', village: 'La Vista', build_year: 1994 },
  { building_name: 'Bijou Hamlet', short_code: 'BIJ', phase: '7', village: 'Bijou Hamlet', build_year: 1994 },
  { building_name: 'La Costa Blanca', short_code: 'LAC', phase: '8', village: 'La Costa', build_year: 1995 },
  { building_name: 'Onda Court', short_code: 'CT1', phase: '8', village: 'La Costa', build_year: 1995 },
  { building_name: 'Onda Court', short_code: 'CT2', phase: '8', village: 'La Costa', build_year: 1995 },
  { building_name: 'La Serene', short_code: 'LAS', phase: '9', village: 'La Serene', build_year: 2000 },
  { building_name: 'Serene Court', short_code: 'SER', phase: '9', village: 'La Serene', build_year: 2000 },
  { building_name: 'Neo Horizon', short_code: 'NEO01', phase: '10', village: 'Neo Horizon', build_year: 2000 },
  { building_name: 'Neo Horizon', short_code: 'NEO02', phase: '10', village: 'Neo Horizon', build_year: 2000 },
  { building_name: 'Siena One', short_code: 'SN1', phase: '11', village: 'Siena One', build_year: 2002 },
  { building_name: 'Crestline Court', short_code: 'CRE', phase: '11', village: 'Siena One', build_year: 2002 },
  { building_name: 'Skyline Manor', short_code: 'SKY', phase: '11', village: 'Siena One', build_year: 2002 },
  { building_name: 'Siena Two', short_code: 'SN2', phase: '12', village: 'Siena Two', build_year: 2002 },
  { building_name: 'Celestial Manor', short_code: 'AH1', phase: '12', village: 'Siena Two', build_year: 2002 },
  { building_name: 'Graceful Manor', short_code: 'AH2', phase: '12', village: 'Siena Two', build_year: 2002 },
  { building_name: 'Joyful Manor', short_code: 'AH3', phase: '12', village: 'Siena Two', build_year: 2002 },
  { building_name: 'Peaceful Manor', short_code: 'AH5', phase: '12', village: 'Siena Two', build_year: 2002 },
  { building_name: 'The Pavilion', short_code: 'CHI01', phase: '13', village: 'Chianti', build_year: 2006 },
  { building_name: 'The Barion', short_code: 'CHI02', phase: '13', village: 'Chianti', build_year: 2006 },
  { building_name: 'The Hemera', short_code: 'CHI03', phase: '13', village: 'Chianti', build_year: 2006 },
  { building_name: 'The Lustre', short_code: 'CHI05', phase: '13', village: 'Chianti', build_year: 2006 },
  { building_name: 'The Premium', short_code: 'CHI06', phase: '13', village: 'Chianti', build_year: 2006 },
  { building_name: 'Amalfi One', short_code: 'AMF01', phase: '14', village: 'Amalfi', build_year: 2011 },
  { building_name: 'Amalfi Two', short_code: 'AMF02', phase: '14', village: 'Amalfi', build_year: 2011 },
  { building_name: 'Amalfi Three', short_code: 'AMF03', phase: '14', village: 'Amalfi', build_year: 2011 },
  { building_name: 'Poggibonsi', short_code: 'POG05', phase: '14', village: 'Poggibonsi', build_year: 2019 },
  { building_name: 'Poggibonsi', short_code: 'POG06', phase: '14', village: 'Poggibonsi', build_year: 2019 },
  { building_name: 'Poggibonsi', short_code: 'POG08', phase: '14', village: 'Poggibonsi', build_year: 2019 },
  { building_name: 'Positano', short_code: 'POS', phase: '15', village: 'Positano', build_year: 2011 },
  { building_name: 'Il Picco', short_code: 'ILP', phase: '16', village: 'Il Picco', build_year: 2020 },
];

export async function POST() {
  try {
    const supabase = createAdminClient();

    let totalGroups = 0;
    let totalProperties = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (const entry of SPREADSHEET_DATA) {
      const { error, count } = await supabase
        .from('properties')
        .update({
          building_name: entry.building_name,
          phase: entry.phase,
          village: entry.village,
          build_year: entry.build_year,
        })
        .eq('short_code', entry.short_code)
        .select('id', { count: 'exact', head: true });

      if (error) {
        errors++;
        errorDetails.push(`${entry.short_code}: ${error.message}`);
      } else {
        totalGroups++;
        totalProperties += count ?? 0;
      }
    }

    return NextResponse.json({
      success: true,
      totalGroups,
      totalProperties,
      errors,
      errorDetails,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
