import { Country } from './types';
import { COUNTRIES_BY_ID } from '../assets/data/countries';

/**
 * Curated list of microstates, small island nations, and sovereign entities
 * that are either sub-pixel in Natural Earth 50m (e.g., Vatican City = 0.03px)
 * or absent from polygon geometry (e.g., Tuvalu).
 */
export const MICROSTATE_IDS = new Set<string>([
  // Europe Microstates
  'VAT', // Vatican City (0.44 km²)
  'MCO', // Monaco (2.02 km²)
  'SMR', // San Marino (61 km²)
  'LIE', // Liechtenstein (160 km²)
  'AND', // Andorra (468 km²)
  'MLT', // Malta (316 km²)
  'LUX', // Luxembourg (2,586 km²)

  // Asia / Middle East Microstates
  'SGP', // Singapore (728 km²)
  'BHR', // Bahrain (765 km²)
  'MDV', // Maldives (300 km²)

  // Africa Island Nations
  'SYC', // Seychelles (452 km²)
  'STP', // Sao Tome and Principe (964 km²)
  'MUS', // Mauritius (2,040 km²)
  'COM', // Comoros (1,862 km²)
  'CPV', // Cape Verde (4,033 km²)

  // Americas / Caribbean Island Nations
  'KNA', // Saint Kitts and Nevis (261 km²)
  'ATG', // Antigua and Barbuda (442 km²)
  'DMA', // Dominica (751 km²)
  'LCA', // Saint Lucia (616 km²)
  'BRB', // Barbados (430 km²)
  'VCT', // Saint Vincent and the Grenadines (389 km²)
  'GRD', // Grenada (344 km²)
  'TTO', // Trinidad and Tobago (5,128 km²)

  // Oceania / Pacific Island Nations
  'TUV', // Tuvalu (26 km² - missing from TopoJSON polygons)
  'NRU', // Nauru (21 km²)
  'PLW', // Palau (459 km²)
  'MHL', // Marshall Islands (181 km²)
  'FSM', // Micronesia (702 km²)
  'KIR', // Kiribati (811 km²)
  'TON', // Tonga (747 km²)
  'WSM', // Samoa (2,842 km²)
  'VUT', // Vanuatu (12,189 km²)
]);

/**
 * Returns array of Country objects for all registered microstates with valid coordinates.
 */
export function getMicrostateList(): Country[] {
  const list: Country[] = [];
  MICROSTATE_IDS.forEach((id) => {
    const country = COUNTRIES_BY_ID.get(id);
    if (country && country.coordinates) {
      list.push(country);
    }
  });
  return list;
}

/**
 * Checks if a country is classified as a microstate or small island nation.
 */
export function isMicrostate(countryId?: string | null): boolean {
  if (!countryId) return false;
  return MICROSTATE_IDS.has(countryId);
}
