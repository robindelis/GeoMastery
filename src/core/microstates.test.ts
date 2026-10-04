import { describe, it, expect } from 'vitest';
import { MICROSTATE_IDS, getMicrostateList, isMicrostate } from './microstates';

describe('Microstates Cartography Engine', () => {
  it('correctly identifies microstates and small island nations', () => {
    expect(isMicrostate('VAT')).toBe(true); // Vatican City
    expect(isMicrostate('TUV')).toBe(true); // Tuvalu
    expect(isMicrostate('NRU')).toBe(true); // Nauru
    expect(isMicrostate('MCO')).toBe(true); // Monaco
    expect(isMicrostate('SMR')).toBe(true); // San Marino
    expect(isMicrostate('LIE')).toBe(true); // Liechtenstein
    expect(isMicrostate('MLT')).toBe(true); // Malta
    expect(isMicrostate('SGP')).toBe(true); // Singapore
  });

  it('correctly excludes standard landmass countries', () => {
    expect(isMicrostate('FRA')).toBe(false);
    expect(isMicrostate('DEU')).toBe(false);
    expect(isMicrostate('USA')).toBe(false);
    expect(isMicrostate('CHN')).toBe(false);
    expect(isMicrostate('BRA')).toBe(false);
    expect(isMicrostate(null)).toBe(false);
    expect(isMicrostate(undefined)).toBe(false);
  });

  it('returns valid country objects with coordinates for all microstates', () => {
    const list = getMicrostateList();
    expect(list.length).toBeGreaterThanOrEqual(30);

    for (const country of list) {
      expect(country.id).toBeDefined();
      expect(country.name).toBeDefined();
      expect(country.coordinates).toBeDefined();
      expect(country.coordinates.length).toBe(2);
      expect(typeof country.coordinates[0]).toBe('number');
      expect(typeof country.coordinates[1]).toBe('number');
      expect(isNaN(country.coordinates[0])).toBe(false);
      expect(isNaN(country.coordinates[1])).toBe(false);
    }
  });

  it('guarantees Tuvalu (TUV) is present with valid coordinates despite missing TopoJSON polygon', () => {
    const list = getMicrostateList();
    const tuvalu = list.find((c) => c.id === 'TUV');
    expect(tuvalu).toBeDefined();
    expect(tuvalu?.name).toBe('Tuvalu');
    expect(tuvalu?.coordinates[0]).toBeCloseTo(177.6493, 2);
    expect(tuvalu?.coordinates[1]).toBeCloseTo(-7.1095, 2);
  });

  it('guarantees Vatican City (VAT) is present with coordinates in Rome', () => {
    const list = getMicrostateList();
    const vatican = list.find((c) => c.id === 'VAT');
    expect(vatican).toBeDefined();
    expect(vatican?.name).toBe('Vatican City');
    expect(vatican?.coordinates[0]).toBeCloseTo(12.4534, 2);
    expect(vatican?.coordinates[1]).toBeCloseTo(41.9029, 2);
  });
});
