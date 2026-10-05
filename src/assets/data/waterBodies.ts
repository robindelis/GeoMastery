export type WaterBodyType = 'ocean' | 'sea' | 'strait' | 'gulf' | 'bay' | 'channel';

export interface WaterBody {
  id: string;
  name: string;
  frenchName?: string;
  type: WaterBodyType;
  coordinates: [number, number]; // [lng, lat]
  clickRadiusKm?: number;
  significance: string;
  adjacentContinents: string[];
}

export const WATER_BODIES: WaterBody[] = [
  // ==========================================
  // 1. OCEANS (5)
  // ==========================================
  {
    id: 'WATER_OCEAN_PACIFIC',
    name: 'Pacific Ocean',
    frenchName: 'Océan Pacifique',
    type: 'ocean',
    coordinates: [-160.0, 0.0],
    clickRadiusKm: 2500,
    significance: 'The largest and deepest of Earth’s oceanic divisions, covering over 30% of Earth’s surface.',
    adjacentContinents: ['Americas', 'Asia', 'Oceania']
  },
  {
    id: 'WATER_OCEAN_ATLANTIC',
    name: 'Atlantic Ocean',
    frenchName: 'Océan Atlantique',
    type: 'ocean',
    coordinates: [-30.0, 15.0],
    clickRadiusKm: 2000,
    significance: 'The second-largest ocean, separating Europe and Africa from the Americas.',
    adjacentContinents: ['Americas', 'Europe', 'Africa']
  },
  {
    id: 'WATER_OCEAN_INDIAN',
    name: 'Indian Ocean',
    frenchName: 'Océan Indien',
    type: 'ocean',
    coordinates: [75.0, -20.0],
    clickRadiusKm: 1800,
    significance: 'Bounded by Asia to the north, Africa to the west, and Australia to the east.',
    adjacentContinents: ['Asia', 'Africa', 'Oceania']
  },
  {
    id: 'WATER_OCEAN_ARCTIC',
    name: 'Arctic Ocean',
    frenchName: 'Océan Arctique',
    type: 'ocean',
    coordinates: [0.0, 85.0],
    clickRadiusKm: 1200,
    significance: 'The smallest and shallowest ocean, surrounding the geographic North Pole.',
    adjacentContinents: ['Europe', 'Asia', 'Americas']
  },
  {
    id: 'WATER_OCEAN_SOUTHERN',
    name: 'Southern Ocean',
    frenchName: 'Océan Austral',
    type: 'ocean',
    coordinates: [0.0, -65.0],
    clickRadiusKm: 1500,
    significance: 'The oceanic waters encircling the entire continent of Antarctica south of 60°S.',
    adjacentContinents: ['Oceania', 'Americas', 'Africa']
  },

  // ==========================================
  // 2. MAJOR SEAS (16)
  // ==========================================
  {
    id: 'WATER_SEA_MEDITERRANEAN',
    name: 'Mediterranean Sea',
    frenchName: 'Mer Méditerranée',
    type: 'sea',
    coordinates: [18.0, 35.0],
    clickRadiusKm: 800,
    significance: 'Cradle of Western and Middle Eastern civilizations, connected to the Atlantic by the Strait of Gibraltar.',
    adjacentContinents: ['Europe', 'Africa', 'Asia']
  },
  {
    id: 'WATER_SEA_CARIBBEAN',
    name: 'Caribbean Sea',
    frenchName: 'Mer des Caraïbes',
    type: 'sea',
    coordinates: [-75.0, 15.0],
    clickRadiusKm: 700,
    significance: 'Tropical sea bounded by Central America, the Greater Antilles, and South America.',
    adjacentContinents: ['Americas']
  },
  {
    id: 'WATER_SEA_SOUTH_CHINA',
    name: 'South China Sea',
    frenchName: 'Mer de Chine méridionale',
    type: 'sea',
    coordinates: [115.0, 12.0],
    clickRadiusKm: 700,
    significance: 'One of the world’s most contested and economically vital maritime trade corridors.',
    adjacentContinents: ['Asia']
  },
  {
    id: 'WATER_SEA_NORTH',
    name: 'North Sea',
    frenchName: 'Mer du Nord',
    type: 'sea',
    coordinates: [3.0, 56.0],
    clickRadiusKm: 450,
    significance: 'Productive shelf sea between the British Isles, Norway, Denmark, Germany, and the Low Countries.',
    adjacentContinents: ['Europe']
  },
  {
    id: 'WATER_SEA_BALTIC',
    name: 'Baltic Sea',
    frenchName: 'Mer Baltique',
    type: 'sea',
    coordinates: [20.0, 58.0],
    clickRadiusKm: 450,
    significance: 'Brackish inland sea enclosed by Scandinavia, Finland, the Baltic states, and Northern Europe.',
    adjacentContinents: ['Europe']
  },
  {
    id: 'WATER_SEA_BLACK',
    name: 'Black Sea',
    frenchName: 'Mer Noire',
    type: 'sea',
    coordinates: [35.0, 43.5],
    clickRadiusKm: 450,
    significance: 'Marginal sea between Southeastern Europe and the Caucasus, linked to the Mediterranean via the Bosporus.',
    adjacentContinents: ['Europe', 'Asia']
  },
  {
    id: 'WATER_SEA_RED',
    name: 'Red Sea',
    frenchName: 'Mer Rouge',
    type: 'sea',
    coordinates: [38.0, 22.0],
    clickRadiusKm: 400,
    significance: 'Rift sea separating the Arabian Peninsula from Africa, connecting the Suez Canal to the Indian Ocean.',
    adjacentContinents: ['Africa', 'Asia']
  },
  {
    id: 'WATER_SEA_ARABIAN',
    name: 'Arabian Sea',
    frenchName: 'Mer d’Arabie',
    type: 'sea',
    coordinates: [65.0, 16.0],
    clickRadiusKm: 650,
    significance: 'Region of the northern Indian Ocean bounded by India, Pakistan, Iran, and the Arabian Peninsula.',
    adjacentContinents: ['Asia']
  },
  {
    id: 'WATER_SEA_CORAL',
    name: 'Coral Sea',
    frenchName: 'Mer de Corail',
    type: 'sea',
    coordinates: [155.0, -18.0],
    clickRadiusKm: 700,
    significance: 'Home to the Great Barrier Reef off the northeast coast of Queensland, Australia.',
    adjacentContinents: ['Oceania']
  },
  {
    id: 'WATER_SEA_BERING',
    name: 'Bering Sea',
    frenchName: 'Mer de Béring',
    type: 'sea',
    coordinates: [-175.0, 58.0],
    clickRadiusKm: 650,
    significance: 'Northern sea separated from the Gulf of Alaska by the Aleutian Islands, meeting Siberia and Alaska.',
    adjacentContinents: ['Asia', 'Americas']
  },
  {
    id: 'WATER_SEA_JAPAN',
    name: 'Sea of Japan (East Sea)',
    frenchName: 'Mer du Japon',
    type: 'sea',
    coordinates: [135.0, 40.0],
    clickRadiusKm: 450,
    significance: 'Marginal sea between the Japanese archipelago, Sakhalin, the Korean Peninsula, and Russia.',
    adjacentContinents: ['Asia']
  },
  {
    id: 'WATER_SEA_CASPIAN',
    name: 'Caspian Sea',
    frenchName: 'Mer Caspienne',
    type: 'sea',
    coordinates: [51.0, 42.0],
    clickRadiusKm: 400,
    significance: 'The world’s largest inland body of water, often regarded as the world’s biggest lake or full sea.',
    adjacentContinents: ['Europe', 'Asia']
  },
  {
    id: 'WATER_SEA_YELLOW',
    name: 'Yellow Sea',
    frenchName: 'Mer Jaune',
    type: 'sea',
    coordinates: [124.0, 35.0],
    clickRadiusKm: 350,
    significance: 'Marginal sea of the Pacific Ocean between mainland China and the Korean Peninsula.',
    adjacentContinents: ['Asia']
  },
  {
    id: 'WATER_SEA_NORWEGIAN',
    name: 'Norwegian Sea',
    frenchName: 'Mer de Norvège',
    type: 'sea',
    coordinates: [5.0, 68.0],
    clickRadiusKm: 550,
    significance: 'Connects the North Sea to the Barents and Greenland Seas northwest of Norway.',
    adjacentContinents: ['Europe']
  },
  {
    id: 'WATER_SEA_TASMAN',
    name: 'Tasman Sea',
    frenchName: 'Mer de Tasman',
    type: 'sea',
    coordinates: [160.0, -38.0],
    clickRadiusKm: 600,
    significance: 'Marginal sea of the South Pacific Ocean situated between Australia and New Zealand.',
    adjacentContinents: ['Oceania']
  },
  {
    id: 'WATER_SEA_SARGASSO',
    name: 'Sargasso Sea',
    frenchName: 'Mer des Sargasses',
    type: 'sea',
    coordinates: [-60.0, 28.0],
    clickRadiusKm: 550,
    significance: 'The only sea on Earth with no land boundaries, defined solely by Atlantic ocean currents.',
    adjacentContinents: ['Americas']
  },

  // ==========================================
  // 3. CRITICAL STRAITS & CHOKEPOINTS (12)
  // ==========================================
  {
    id: 'WATER_STRAIT_GIBRALTAR',
    name: 'Strait of Gibraltar',
    frenchName: 'Détroit de Gibraltar',
    type: 'strait',
    coordinates: [-5.6, 35.97],
    clickRadiusKm: 180,
    significance: 'Historic 14-km gateway connecting the Atlantic Ocean to the Mediterranean Sea between Spain and Morocco.',
    adjacentContinents: ['Europe', 'Africa']
  },
  {
    id: 'WATER_STRAIT_HORMUZ',
    name: 'Strait of Hormuz',
    frenchName: 'Détroit d’Ormuz',
    type: 'strait',
    coordinates: [56.4, 26.6],
    clickRadiusKm: 180,
    significance: 'The world’s most critical petroleum transit chokepoint between the Persian Gulf and Gulf of Oman.',
    adjacentContinents: ['Asia']
  },
  {
    id: 'WATER_STRAIT_MALACCA',
    name: 'Strait of Malacca',
    frenchName: 'Détroit de Malacca',
    type: 'strait',
    coordinates: [101.5, 2.5],
    clickRadiusKm: 220,
    significance: 'Key maritime passage connecting the Indian Ocean to the South China Sea between Malaysia and Sumatra.',
    adjacentContinents: ['Asia']
  },
  {
    id: 'WATER_STRAIT_BOSPORUS',
    name: 'Bosporus Strait',
    frenchName: 'Détroit du Bosphore',
    type: 'strait',
    coordinates: [29.07, 41.12],
    clickRadiusKm: 140,
    significance: 'Intercontinental strait bisecting Istanbul, connecting the Black Sea to the Sea of Marmara.',
    adjacentContinents: ['Europe', 'Asia']
  },
  {
    id: 'WATER_STRAIT_DARDANELLES',
    name: 'Dardanelles Strait',
    frenchName: 'Détroit des Dardanelles',
    type: 'strait',
    coordinates: [26.43, 40.22],
    clickRadiusKm: 140,
    significance: 'Narrow strait connecting the Sea of Marmara to the Aegean Sea in northwestern Turkey.',
    adjacentContinents: ['Europe', 'Asia']
  },
  {
    id: 'WATER_STRAIT_BAB_EL_MANDEB',
    name: 'Bab-el-Mandeb Strait',
    frenchName: 'Détroit de Bab-el-Mandeb',
    type: 'strait',
    coordinates: [43.33, 12.58],
    clickRadiusKm: 160,
    significance: 'The "Gate of Tears" connecting the Red Sea to the Gulf of Aden between Yemen and Djibouti.',
    adjacentContinents: ['Africa', 'Asia']
  },
  {
    id: 'WATER_STRAIT_ENGLISH_CHANNEL',
    name: 'English Channel',
    frenchName: 'La Manche',
    type: 'channel',
    coordinates: [-1.5, 50.0],
    clickRadiusKm: 220,
    significance: 'Arm of the Atlantic separating southern England from northern France, joining the North Sea.',
    adjacentContinents: ['Europe']
  },
  {
    id: 'WATER_STRAIT_BERING',
    name: 'Bering Strait',
    frenchName: 'Détroit de Béring',
    type: 'strait',
    coordinates: [-168.5, 65.8],
    clickRadiusKm: 200,
    significance: 'Separates Russia and the United States (Alaska) by only 82 km between the Arctic and Pacific.',
    adjacentContinents: ['Asia', 'Americas']
  },
  {
    id: 'WATER_STRAIT_MAGELLAN',
    name: 'Strait of Magellan',
    frenchName: 'Détroit de Magellan',
    type: 'strait',
    coordinates: [-71.0, -53.5],
    clickRadiusKm: 220,
    significance: 'Natural navigable passage through southern Chile connecting the Atlantic and Pacific oceans.',
    adjacentContinents: ['Americas']
  },
  {
    id: 'WATER_STRAIT_TAIWAN',
    name: 'Taiwan Strait',
    frenchName: 'Détroit de Taïwan',
    type: 'strait',
    coordinates: [119.5, 24.5],
    clickRadiusKm: 200,
    significance: '180-km wide strait separating the island of Taiwan from continental China.',
    adjacentContinents: ['Asia']
  },
  {
    id: 'WATER_CANAL_SUEZ',
    name: 'Suez Canal',
    frenchName: 'Canal de Suez',
    type: 'strait',
    coordinates: [32.34, 30.7],
    clickRadiusKm: 140,
    significance: 'Artificial Egyptian waterway providing direct maritime transit between the Mediterranean and the Red Sea.',
    adjacentContinents: ['Africa', 'Asia']
  },
  {
    id: 'WATER_CANAL_PANAMA',
    name: 'Panama Canal',
    frenchName: 'Canal de Panama',
    type: 'strait',
    coordinates: [-79.9, 9.1],
    clickRadiusKm: 140,
    significance: '82-km canal cutting through the Isthmus of Panama, connecting the Atlantic and Pacific oceans.',
    adjacentContinents: ['Americas']
  },

  // ==========================================
  // 4. MAJOR GULFS & BAYS (7)
  // ==========================================
  {
    id: 'WATER_GULF_MEXICO',
    name: 'Gulf of Mexico',
    frenchName: 'Golfe du Mexique',
    type: 'gulf',
    coordinates: [-90.0, 25.0],
    clickRadiusKm: 600,
    significance: 'Ocean basin bounded by the United States, Mexico, and Cuba.',
    adjacentContinents: ['Americas']
  },
  {
    id: 'WATER_GULF_PERSIAN',
    name: 'Persian Gulf',
    frenchName: 'Golfe Persique',
    type: 'gulf',
    coordinates: [51.5, 27.0],
    clickRadiusKm: 400,
    significance: 'Mediterranean sea extension in Western Asia surrounded by major oil-producing nations.',
    adjacentContinents: ['Asia']
  },
  {
    id: 'WATER_BAY_BENGAL',
    name: 'Bay of Bengal',
    frenchName: 'Golfe du Bengale',
    type: 'bay',
    coordinates: [88.0, 15.0],
    clickRadiusKm: 650,
    significance: 'The largest water region called a bay in the world, occupying the northeastern Indian Ocean.',
    adjacentContinents: ['Asia']
  },
  {
    id: 'WATER_BAY_HUDSON',
    name: 'Hudson Bay',
    frenchName: 'Baie d’Hudson',
    type: 'bay',
    coordinates: [-85.0, 60.0],
    clickRadiusKm: 550,
    significance: 'Enormous inland saltwater bay in northeastern Canada draining a major portion of North America.',
    adjacentContinents: ['Americas']
  },
  {
    id: 'WATER_GULF_GUINEA',
    name: 'Gulf of Guinea',
    frenchName: 'Golfe de Guinée',
    type: 'gulf',
    coordinates: [2.5, 2.0],
    clickRadiusKm: 550,
    significance: 'The northeasternmost part of the tropical Atlantic Ocean off western Africa, where the Prime Meridian meets the Equator (0°, 0°).',
    adjacentContinents: ['Africa']
  },
  {
    id: 'WATER_GULF_ADEN',
    name: 'Gulf of Aden',
    frenchName: 'Golfe d’Aden',
    type: 'gulf',
    coordinates: [48.0, 12.5],
    clickRadiusKm: 350,
    significance: 'Deepwater gulf located between Yemen and Somalia connecting the Red Sea to the Arabian Sea.',
    adjacentContinents: ['Africa', 'Asia']
  },
  {
    id: 'WATER_GULF_CALIFORNIA',
    name: 'Gulf of California (Sea of Cortez)',
    frenchName: 'Golfe de Californie',
    type: 'gulf',
    coordinates: [-111.0, 26.0],
    clickRadiusKm: 350,
    significance: 'Body of water separating the Baja California Peninsula from the Mexican mainland.',
    adjacentContinents: ['Americas']
  }
];

export const WATER_BODIES_BY_ID = new Map<string, WaterBody>(
  WATER_BODIES.map((wb) => [wb.id, wb])
);

export function getWaterBodyById(id: string): WaterBody | undefined {
  return WATER_BODIES_BY_ID.get(id);
}
