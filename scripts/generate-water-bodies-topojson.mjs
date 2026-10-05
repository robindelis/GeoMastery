import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT_DIR, '.cache_geo');
const OUTPUT_FILE = path.join(ROOT_DIR, 'src', 'assets', 'geo', 'water-bodies-50m.json');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Fetch helper with caching
async function fetchCached(url, filename) {
  const filePath = path.join(CACHE_DIR, filename);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  console.log(`Downloading ${url}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
  const text = await res.text();
  fs.writeFileSync(filePath, text, 'utf8');
  return JSON.parse(text);
}

// Helper to normalize names
function norm(n) {
  return (n || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function findFeature(dataset, name) {
  const target = norm(name);
  return dataset.features.find((f) => norm(f.properties?.name || f.properties?.NAME) === target);
}

function findFeatures(dataset, name) {
  const target = norm(name);
  return dataset.features.filter((f) => norm(f.properties?.name || f.properties?.NAME) === target);
}

function getCoords(feat) {
  if (!feat || !feat.geometry) return [];
  if (feat.geometry.type === 'Polygon') return [feat.geometry.coordinates];
  if (feat.geometry.type === 'MultiPolygon') return feat.geometry.coordinates;
  return [];
}

// Create buffered channel polygon around a centerline
function createCorridorPolygon(pts, widthDeg = 0.08) {
  const left = [];
  const right = [];
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i];
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    left.push([+(cur[0] + nx * widthDeg).toFixed(5), +(cur[1] + ny * widthDeg).toFixed(5)]);
    right.push([+(cur[0] - nx * widthDeg).toFixed(5), +(cur[1] - ny * widthDeg).toFixed(5)]);
  }
  const ring = [...left, ...right.reverse(), left[0]];
  return {
    type: 'Polygon',
    coordinates: [ring]
  };
}

const suezCenterline = [
  [32.31, 31.27],
  [32.31, 31.00],
  [32.30, 30.58],
  [32.36, 30.40],
  [32.43, 30.30],
  [32.55, 30.05],
  [32.57, 29.93]
];

const panamaCenterline = [
  [-79.93, 9.37],
  [-79.92, 9.27],
  [-79.85, 9.20],
  [-79.78, 9.15],
  [-79.70, 9.10],
  [-79.64, 9.04],
  [-79.59, 8.99],
  [-79.56, 8.93]
];

async function main() {
  console.log('Fetching source datasets...');
  const [m50, m10, hormuzGeo] = await Promise.all([
    fetchCached(
      'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_geography_marine_polys.geojson',
      'ne_50m_marine.geojson'
    ),
    fetchCached(
      'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_10m_geography_marine_polys.geojson',
      'ne_10m_marine.geojson'
    ),
    fetchCached(
      "https://geo.vliz.be/geoserver/MarineRegions/wfs?service=WFS&version=1.0.0&request=GetFeature&typeNames=MarineRegions:seavox_v19&cql_filter=sub_region%20ILIKE%20'%25Hormuz%25'&outputFormat=json",
      'hormuz_seavox.geojson'
    )
  ]);

  const generators = {
    // 1. OCEANS (5)
    WATER_OCEAN_PACIFIC: () => ({
      type: 'MultiPolygon',
      coordinates: [
        ...getCoords(findFeature(m50, 'NORTH PACIFIC OCEAN')),
        ...getCoords(findFeature(m50, 'SOUTH PACIFIC OCEAN'))
      ]
    }),
    WATER_OCEAN_ATLANTIC: () => ({
      type: 'MultiPolygon',
      coordinates: [
        ...getCoords(findFeature(m50, 'NORTH ATLANTIC OCEAN')),
        ...getCoords(findFeature(m50, 'SOUTH ATLANTIC OCEAN'))
      ]
    }),
    WATER_OCEAN_INDIAN: () => findFeature(m50, 'INDIAN OCEAN').geometry,
    WATER_OCEAN_ARCTIC: () => findFeature(m50, 'ARCTIC OCEAN').geometry,
    WATER_OCEAN_SOUTHERN: () => findFeature(m50, 'SOUTHERN OCEAN').geometry,

    // 2. MAJOR SEAS (16)
    WATER_SEA_MEDITERRANEAN: () => ({
      type: 'MultiPolygon',
      coordinates: findFeatures(m50, 'Mediterranean Sea').flatMap((f) => getCoords(f))
    }),
    WATER_SEA_CARIBBEAN: () => findFeature(m50, 'Caribbean Sea').geometry,
    WATER_SEA_SOUTH_CHINA: () => findFeature(m50, 'South China Sea').geometry,
    WATER_SEA_NORTH: () => findFeature(m50, 'North Sea').geometry,
    WATER_SEA_BALTIC: () => findFeature(m50, 'Baltic Sea').geometry,
    WATER_SEA_BLACK: () => findFeature(m50, 'Black Sea').geometry,
    WATER_SEA_RED: () => findFeature(m50, 'Red Sea').geometry,
    WATER_SEA_ARABIAN: () => findFeature(m50, 'Arabian Sea').geometry,
    WATER_SEA_CORAL: () => findFeature(m50, 'Coral Sea').geometry,
    WATER_SEA_BERING: () => findFeature(m50, 'Bering Sea').geometry,
    WATER_SEA_JAPAN: () => findFeature(m50, 'Sea of Japan').geometry,
    WATER_SEA_CASPIAN: () => findFeature(m50, 'Caspian Sea').geometry,
    WATER_SEA_YELLOW: () => findFeature(m50, 'Yellow Sea').geometry,
    WATER_SEA_NORWEGIAN: () => findFeature(m50, 'Norwegian Sea').geometry,
    WATER_SEA_TASMAN: () => findFeature(m50, 'Tasman Sea').geometry,
    WATER_SEA_SARGASSO: () => findFeature(m50, 'Sargasso Sea').geometry,

    // 3. STRATEGIC STRAITS & CANALS (12)
    WATER_STRAIT_GIBRALTAR: () => findFeature(m10, 'Strait of Gibraltar').geometry,
    WATER_STRAIT_HORMUZ: () => hormuzGeo.features[0].geometry,
    WATER_STRAIT_MALACCA: () => findFeature(m10, 'Strait of Malacca').geometry,
    WATER_STRAIT_BOSPORUS: () => findFeature(m10, 'Bosporus').geometry,
    WATER_STRAIT_DARDANELLES: () => findFeature(m10, 'Dardanelles').geometry,
    WATER_STRAIT_BAB_EL_MANDEB: () => findFeature(m10, 'Bab el Mandeb').geometry,
    WATER_STRAIT_ENGLISH_CHANNEL: () => findFeature(m10, 'English Channel').geometry,
    WATER_STRAIT_BERING: () => findFeature(m10, 'Bering Strait').geometry,
    WATER_STRAIT_MAGELLAN: () => findFeature(m10, 'Estrecho de Magellanes').geometry,
    WATER_STRAIT_TAIWAN: () => findFeature(m10, 'Taiwan Strait').geometry,
    WATER_CANAL_SUEZ: () => createCorridorPolygon(suezCenterline, 0.12),
    WATER_CANAL_PANAMA: () => createCorridorPolygon(panamaCenterline, 0.10),

    // 4. MAJOR GULFS & BAYS (7)
    WATER_GULF_MEXICO: () => findFeature(m50, 'Gulf of Mexico').geometry,
    WATER_GULF_PERSIAN: () => findFeature(m50, 'Persian Gulf').geometry,
    WATER_BAY_BENGAL: () => findFeature(m50, 'Bay of Bengal').geometry,
    WATER_BAY_HUDSON: () => findFeature(m50, 'Hudson Bay').geometry,
    WATER_GULF_GUINEA: () => findFeature(m50, 'Gulf of Guinea').geometry,
    WATER_GULF_ADEN: () => findFeature(m50, 'Gulf of Aden').geometry,
    WATER_GULF_CALIFORNIA: () => findFeature(m50, 'Golfo de California').geometry
  };

  const wbFile = fs.readFileSync(path.join(ROOT_DIR, 'src', 'assets', 'data', 'waterBodies.ts'), 'utf8');
  const lines = wbFile.split('\n');
  const wbList = [];
  let cur = null;
  for (const l of lines) {
    const idM = l.match(/id:\s*'([^']+)'/);
    if (idM) {
      if (cur) wbList.push(cur);
      cur = { id: idM[1] };
    }
    const nameM = l.match(/name:\s*'([^']+)'/);
    if (nameM && cur && !cur.name) cur.name = nameM[1];
    const typeM = l.match(/type:\s*'([^']+)'/);
    if (typeM && cur && !cur.type) cur.type = typeM[1];
  }
  if (cur) wbList.push(cur);

  const features = wbList.map((wb) => {
    const gen = generators[wb.id];
    if (!gen) throw new Error(`Missing generator for ${wb.id}`);
    const geometry = gen();
    return {
      type: 'Feature',
      id: wb.id,
      properties: {
        name: wb.name,
        type: wb.type
      },
      geometry
    };
  });

  const geoJsonPath = path.join(CACHE_DIR, 'water_bodies_combined.geojson');
  fs.writeFileSync(geoJsonPath, JSON.stringify({ type: 'FeatureCollection', features }), 'utf8');
  console.log(`Generated intermediate GeoJSON with ${features.length} features.`);

  console.log('Compiling to TopoJSON via mapshaper...');
  execSync(
    `npx mapshaper "${geoJsonPath}" -rename-layers water_bodies -o format=topojson id-field=id "${OUTPUT_FILE}"`,
    { stdio: 'inherit' }
  );

  const stats = fs.statSync(OUTPUT_FILE);
  console.log(`Successfully created ${OUTPUT_FILE} (${(stats.size / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
