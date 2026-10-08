/**
 * Geographic projection and geometry calculation utilities
 * Shared between VectorMap2D and Globe3D
 */

/**
 * Clamps coordinates to valid geographic bounds:
 * Longitude: [-180, 180]
 * Latitude: [-89.999, 89.999] (to prevent infinite tangents near poles in Mercator-like math)
 */
export const clampCoord = ([x, y]: [number, number]): [number, number] => [
  Math.max(-180, Math.min(180, x)),
  Math.max(-89.999, Math.min(89.999, y))
];

/**
 * Densifies a geographic polygon ring by inserting intermediate interpolation points
 * along long horizontal spans. This prevents clipping or rendering artifacts across
 * projection boundaries (e.g. D3 Natural Earth or Orthographic projection).
 */
export const densifyRing = (ring: [number, number][]): [number, number][] => {
  const newRing: [number, number][] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const p1 = clampCoord(ring[i]);
    const p2 = clampCoord(ring[i + 1]);
    newRing.push(p1);
    const dLat = Math.abs(p1[1] - p2[1]);
    const dLng = Math.abs(p1[0] - p2[0]);
    if (dLat < 0.1 && dLng > 2.0) {
      const steps = Math.ceil(dLng / 2.0);
      const stepLng = (p2[0] - p1[0]) / steps;
      const stepLat = (p2[1] - p1[1]) / steps;
      for (let s = 1; s < steps; s++) {
        newRing.push([
          +(p1[0] + s * stepLng).toFixed(5),
          +(p1[1] + s * stepLat).toFixed(5)
        ]);
      }
    }
  }
  newRing.push(clampCoord(ring[ring.length - 1]));
  return newRing;
};

/**
 * Densifies coordinates for all Polygon and MultiPolygon GeoJSON features.
 */
export const densifyGeoFeatures = (rawFeatures: any[]): any[] => {
  return rawFeatures.map((feat) => {
    if (!feat.geometry) return feat;
    if (feat.geometry.type === 'Polygon') {
      return {
        ...feat,
        geometry: {
          ...feat.geometry,
          coordinates: feat.geometry.coordinates.map((ring: any) => densifyRing(ring))
        }
      };
    }
    if (feat.geometry.type === 'MultiPolygon') {
      return {
        ...feat,
        geometry: {
          ...feat.geometry,
          coordinates: feat.geometry.coordinates.map((poly: any) =>
            poly.map((ring: any) => densifyRing(ring))
          )
        }
      };
    }
    return feat;
  });
};

/**
 * Formats a [lng, lat] coordinate pair into readable cardinal degree notation.
 * e.g. [149.13, -35.31] -> "35.31° S, 149.13° E"
 */
export const formatCoordinates = (coords: [number, number]): string => {
  const [lng, lat] = coords;
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}° ${latDir}, ${Math.abs(lng).toFixed(2)}° ${lngDir}`;
};
