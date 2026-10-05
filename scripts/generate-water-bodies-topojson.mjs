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

function norm(n) {
  return (n || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function findFeature(dataset, name) {
  const target = norm(name);
  return dataset.features.find((f) => norm(f.properties?.name || f.properties?.NAME) === target);
}

function findFeatures(dataset, names) {
  const targets = new Set(names.map(norm));
  return dataset.features.filter((f) => targets.has(norm(f.properties?.name || f.properties?.NAME)));
}

function getCoords(feat) {
  if (!feat || !feat.geometry) return [];
  if (feat.geometry.type === 'Polygon') return [feat.geometry.coordinates];
  if (feat.geometry.type === 'MultiPolygon') return feat.geometry.coordinates;
  return [];
}

function collectCoords(feats) {
  return feats.flatMap((f) => getCoords(f));
}

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
    // 1. OCEANS (Complete coverage: all marginal seas and bays cleanly merged)
    WATER_OCEAN_PACIFIC: () => ({
      type: 'MultiPolygon',
      coordinates: collectCoords(
        findFeatures(m50, [
          'NORTH PACIFIC OCEAN',
          'SOUTH PACIFIC OCEAN',
          'Philippine Sea',
          'Sea of Okhotsk',
          'East China Sea',
          'Gulf of Alaska',
          'Bismarck Sea',
          'Solomon Sea',
          'Banda Sea',
          'Celebes Sea',
          'Ceram Sea',
          'Java Sea',
          'Molucca Sea',
          'Sulu Sea',
          'Cook Inlet',
          'Bristol Bay',
          'Bay of Plenty',
          'Golfo de Panamá',
          'Shelikhova Gulf',
          'Makassar Strait'
        ])
      )
    }),
    WATER_OCEAN_ATLANTIC: () => ({
      type: 'MultiPolygon',
      coordinates: collectCoords(
        findFeatures(m50, [
          'NORTH ATLANTIC OCEAN',
          'SOUTH ATLANTIC OCEAN',
          'Bay of Biscay',
          'Greenland Sea',
          'Labrador Sea',
          'Baffin Bay',
          'Irish Sea',
          'Bristol Channel',
          'Davis  Strait',
          'Davis Strait',
          'Gulf of St. Lawrence',
          'Gulf of Maine',
          'Bay of Fundy',
          'Chesapeake Bay',
          'Straits of Florida',
          'Golfo San Jorge',
          'Río de la Plata'
        ])
      )
    }),
    WATER_OCEAN_INDIAN: () => ({
      type: 'MultiPolygon',
      coordinates: collectCoords(
        findFeatures(m50, [
          'INDIAN OCEAN',
          'Mozambique Channel',
          'Great Australian Bight',
          'Laccadive Sea',
          'Gulf of Mannar',
          'Timor Sea',
          'Arafura Sea'
        ])
      )
    }),
    WATER_OCEAN_ARCTIC: () => ({
      type: 'MultiPolygon',
      coordinates: collectCoords(
        findFeatures(m50, [
          'ARCTIC OCEAN',
          'Barents Sea',
          'Kara Sea',
          'Laptev Sea',
          'Chukchi Sea',
          'Beaufort  Sea',
          'Beaufort Sea',
          'White  Sea',
          'White Sea',
          'Amundsen Gulf',
          'Melville Bay',
          'Viscount Melville Sound',
          'The North Western Passages'
        ])
      )
    }),
    WATER_OCEAN_SOUTHERN: () => ({
      type: 'MultiPolygon',
      coordinates: collectCoords(
        findFeatures(m50, [
          'SOUTHERN OCEAN',
          'Weddell  Sea',
          'Weddell Sea',
          'Ross  Sea',
          'Ross Sea',
          'Amundsen Sea',
          'Bellingshausen Sea',
          'Scotia Sea',
          'Drake Passage'
        ])
      )
    }),

    // 2. MAJOR SEAS
    WATER_SEA_MEDITERRANEAN: () => ({
      type: 'MultiPolygon',
      coordinates: collectCoords(
        findFeatures(m50, [
          'Mediterranean Sea',
          'Adriatic Sea',
          'Aegean Sea',
          'Ionian Sea',
          'Tyrrhenian Sea',
          'Balearic Sea',
          'Golfe du Lion',
          'Inner Sea'
        ])
      )
    }),
    WATER_SEA_CARIBBEAN: () => findFeature(m50, 'Caribbean Sea').geometry,
    WATER_SEA_SOUTH_CHINA: () => ({
      type: 'MultiPolygon',
      coordinates: collectCoords(
        findFeatures(m50, ['South China Sea', 'Gulf of Tonkin', 'Gulf of Thailand', 'Luzon Strait'])
      )
    }),
    WATER_SEA_NORTH: () => findFeature(m50, 'North Sea').geometry,
    WATER_SEA_BALTIC: () => ({
      type: 'MultiPolygon',
      coordinates: collectCoords(findFeatures(m50, ['Baltic Sea', 'Gulf of Bothnia', 'Gulf of Finland']))
    }),
    WATER_SEA_BLACK: () => findFeature(m50, 'Black Sea').geometry,
    WATER_SEA_RED: () => findFeature(m50, 'Red Sea').geometry,
    WATER_SEA_ARABIAN: () => ({
      type: 'MultiPolygon',
      coordinates: collectCoords(findFeatures(m50, ['Arabian Sea', 'Gulf of Oman', 'Gulf of Kutch']))
    }),
    WATER_SEA_CORAL: () => ({
      type: 'MultiPolygon',
      coordinates: collectCoords(findFeatures(m50, ['Coral Sea', 'Great Barrier Reef', 'Gulf of Carpentaria']))
    }),
    WATER_SEA_BERING: () => findFeature(m50, 'Bering Sea').geometry,
    WATER_SEA_JAPAN: () => ({
      type: 'MultiPolygon',
      coordinates: collectCoords(findFeatures(m50, ['Sea of Japan', 'Korea Strait']))
    }),
    WATER_SEA_CASPIAN: () => findFeature(m50, 'Caspian Sea').geometry,
    WATER_SEA_YELLOW: () => ({
      type: 'MultiPolygon',
      coordinates: collectCoords(findFeatures(m50, ['Yellow Sea', 'Bo Hai']))
    }),
    WATER_SEA_NORWEGIAN: () => findFeature(m50, 'Norwegian Sea').geometry,
    WATER_SEA_TASMAN: () => findFeature(m50, 'Tasman Sea').geometry,
    WATER_SEA_SARGASSO: () => findFeature(m50, 'Sargasso Sea').geometry,

    // 3. STRATEGIC STRAITS & CANALS
    WATER_STRAIT_GIBRALTAR: () => findFeature(m10, 'Strait of Gibraltar').geometry,
    WATER_STRAIT_HORMUZ: () => hormuzGeo.features[0].geometry,
    WATER_STRAIT_MALACCA: () => ({
      type: 'MultiPolygon',
      coordinates: collectCoords(
        [findFeature(m10, 'Strait of Malacca'), findFeature(m50, 'Strait of Singapore')].filter(Boolean)
      )
    }),
    WATER_STRAIT_BOSPORUS: () => findFeature(m10, 'Bosporus').geometry,
    WATER_STRAIT_DARDANELLES: () => findFeature(m10, 'Dardanelles').geometry,
    WATER_STRAIT_BAB_EL_MANDEB: () => findFeature(m10, 'Bab el Mandeb').geometry,
    WATER_STRAIT_ENGLISH_CHANNEL: () => findFeature(m10, 'English Channel').geometry,
    WATER_STRAIT_BERING: () => findFeature(m10, 'Bering Strait').geometry,
    WATER_STRAIT_MAGELLAN: () => findFeature(m10, 'Estrecho de Magellanes').geometry,
    WATER_STRAIT_TAIWAN: () => findFeature(m10, 'Taiwan Strait').geometry,
    WATER_CANAL_SUEZ: () => createCorridorPolygon(suezCenterline, 0.12),
    WATER_CANAL_PANAMA: () => createCorridorPolygon(panamaCenterline, 0.10),

    // 4. MAJOR GULFS & BAYS
    WATER_GULF_MEXICO: () => ({
      type: 'MultiPolygon',
      coordinates: collectCoords(
        findFeatures(m50, ['Gulf of Mexico', 'Bah\x92a de Campeche', 'Bahía de Campeche', 'Gulf of Honduras'])
      )
    }),
    WATER_GULF_PERSIAN: () => findFeature(m50, 'Persian Gulf').geometry,
    WATER_BAY_BENGAL: () => ({
      type: 'MultiPolygon',
      coordinates: collectCoords(findFeatures(m50, ['Bay of Bengal', 'Andaman Sea']))
    }),
    WATER_BAY_HUDSON: () => ({
      type: 'MultiPolygon',
      coordinates: collectCoords(findFeatures(m50, ['Hudson Bay', 'James Bay', 'Hudson Strait', 'Ungava Bay']))
    }),
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
        id: wb.id,
        wb_id: wb.id,
        name: wb.name,
        type: wb.type
      },
      geometry
    };
  });

  const nonStraits = features.filter((f) => f.properties.type !== 'strait' && f.properties.type !== 'channel');
  const straits = features.filter((f) => f.properties.type === 'strait' || f.properties.type === 'channel');

  const nonStraitsPath = path.join(CACHE_DIR, 'water_bodies_non_straits.geojson');
  const dissolvedPath = path.join(CACHE_DIR, 'water_bodies_non_straits_dissolved.geojson');
  const allCleanPath = path.join(CACHE_DIR, 'water_bodies_all_clean.geojson');

  fs.writeFileSync(nonStraitsPath, JSON.stringify({ type: 'FeatureCollection', features: nonStraits }), 'utf8');

  console.log('Dissolving internal boundaries of ocean and sea basins via mapshaper...');
  execSync(`npx mapshaper "${nonStraitsPath}" -dissolve wb_id -o "${dissolvedPath}" format=geojson`, { stdio: 'inherit' });

  const dissolvedNonStraits = JSON.parse(fs.readFileSync(dissolvedPath, 'utf8')).features;
  const combinedFeatures = [...dissolvedNonStraits, ...straits];
  fs.writeFileSync(allCleanPath, JSON.stringify({ type: 'FeatureCollection', features: combinedFeatures }), 'utf8');

  console.log('Compiling to TopoJSON via mapshaper with shape preservation...');
  execSync(
    `npx mapshaper "${allCleanPath}" -simplify 20% keep-shapes -rename-layers water_bodies -o format=topojson id-field=wb_id "${OUTPUT_FILE}"`,
    { stdio: 'inherit' }
  );

  const stats = fs.statSync(OUTPUT_FILE);
  console.log(`Successfully created ${OUTPUT_FILE} (${(stats.size / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
