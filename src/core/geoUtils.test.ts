import { describe, it, expect } from 'vitest';
import { clampCoord, densifyRing, densifyGeoFeatures, formatCoordinates } from './geoUtils';

describe('geoUtils Geographic Calculations', () => {
  it('correctly clamps coordinates to valid geographic ranges', () => {
    expect(clampCoord([-200, 100])).toEqual([-180, 89.999]);
    expect(clampCoord([190, -95])).toEqual([180, -89.999]);
    expect(clampCoord([0, 0])).toEqual([0, 0]);
    expect(clampCoord([149.13, -35.31])).toEqual([149.13, -35.31]);
  });

  it('densifies long horizontal spans in polygon rings without altering short spans', () => {
    const ring: [number, number][] = [
      [0, 10],
      [10, 10], // dLat = 0, dLng = 10 (> 2.0) -> steps = 5
      [10, 20], // dLat = 10 -> not densified
      [0, 10]
    ];
    const densified = densifyRing(ring);
    expect(densified.length).toBeGreaterThan(ring.length);
    expect(densified[0]).toEqual([0, 10]);
    // Intermediate point exists
    expect(densified).toContainEqual([2, 10]);
    expect(densified).toContainEqual([4, 10]);
  });

  it('densifies GeoJSON features for Polygon and MultiPolygon', () => {
    const rawFeatures = [
      {
        id: 'POLY_1',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
          ]
        }
      },
      {
        id: 'MULTIPOLY_1',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]
          ]
        }
      }
    ];

    const result = densifyGeoFeatures(rawFeatures);
    expect(result.length).toBe(2);
    expect(result[0].geometry.coordinates[0].length).toBeGreaterThan(5);
    expect(result[1].geometry.coordinates[0][0].length).toBeGreaterThan(5);
  });

  it('formats coordinates into cardinal compass notation', () => {
    expect(formatCoordinates([149.13, -35.31])).toBe('35.31° S, 149.13° E');
    expect(formatCoordinates([-74.01, 40.71])).toBe('40.71° N, 74.01° W');
    expect(formatCoordinates([0, 0])).toBe('0.00° N, 0.00° E');
  });
});
