export type WaterBodyType = 'ocean' | 'sea' | 'strait' | 'gulf' | 'bay' | 'channel';

export interface WaterBody {
  id: string;
  name: string;
  type: WaterBodyType;
  coordinates: [number, number]; // [lng, lat]
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
    type: 'ocean',
    coordinates: [-160.0, 0.0],
    significance: 'The largest and deepest of Earth’s oceanic divisions, covering over 30% of Earth’s surface.',
    adjacentContinents: ['Americas', 'Asia', 'Oceania']
  },
  {
    id: 'WATER_OCEAN_ATLANTIC',
    name: 'Atlantic Ocean',
    type: 'ocean',
    coordinates: [-30.0, 15.0],
    significance: 'The second-largest ocean, separating Europe and Africa from the Americas.',
    adjacentContinents: ['Americas', 'Europe', 'Africa']
  },
  {
    id: 'WATER_OCEAN_INDIAN',
    name: 'Indian Ocean',
    type: 'ocean',
    coordinates: [75.0, -20.0],
    significance: 'Bounded by Asia to the north, Africa to the west, and Australia to the east.',
    adjacentContinents: ['Asia', 'Africa', 'Oceania']
  },
  {
    id: 'WATER_OCEAN_ARCTIC',
    name: 'Arctic Ocean',
    type: 'ocean',
    coordinates: [0.0, 85.0],
    significance: 'The smallest and shallowest ocean, surrounding the geographic North Pole.',
    adjacentContinents: ['Europe', 'Asia', 'Americas']
  },
  {
    id: 'WATER_OCEAN_SOUTHERN',
    name: 'Southern Ocean',
    type: 'ocean',
    coordinates: [0.0, -65.0],
    significance: 'The oceanic waters encircling the entire continent of Antarctica south of 60°S.',
    adjacentContinents: ['Oceania', 'Americas', 'Africa']
  },

  // ==========================================
  // 2. MAJOR SEAS (16)
  // ==========================================
  {
    id: 'WATER_SEA_MEDITERRANEAN',
    name: 'Mediterranean Sea',
    type: 'sea',
    coordinates: [18.0, 35.0],
    significance: 'Cradle of Western and Middle Eastern civilizations, connected to the Atlantic by the Strait of Gibraltar.',
    adjacentContinents: ['Europe', 'Africa', 'Asia']
  },
  {
    id: 'WATER_SEA_CARIBBEAN',
    name: 'Caribbean Sea',
    type: 'sea',
    coordinates: [-75.0, 15.0],
    significance: 'Tropical sea bounded by Central America, the Greater Antilles, and South America.',
    adjacentContinents: ['Americas']
  },
  {
    id: 'WATER_SEA_SOUTH_CHINA',
    name: 'South China Sea',
    type: 'sea',
    coordinates: [115.0, 12.0],
    significance: 'One of the world’s most contested and economically vital maritime trade corridors.',
    adjacentContinents: ['Asia']
  },
  {
    id: 'WATER_SEA_NORTH',
    name: 'North Sea',
    type: 'sea',
    coordinates: [3.0, 56.0],
    significance: 'Marginal sea of the Atlantic located between the British Isles, Scandinavia, and Western Europe.',
    adjacentContinents: ['Europe']
  },
  {
    id: 'WATER_SEA_BALTIC',
    name: 'Baltic Sea',
    type: 'sea',
    coordinates: [20.0, 58.0],
    significance: 'Brackish mediterranean inland sea in Northern Europe bounded by the Scandinavian and Baltic states.',
    adjacentContinents: ['Europe']
  },
  {
    id: 'WATER_SEA_BLACK',
    name: 'Black Sea',
    type: 'sea',
    coordinates: [35.0, 43.5],
    significance: 'Inland marginal sea between Southeastern Europe and Western Asia, linked to the Mediterranean via the Bosporus.',
    adjacentContinents: ['Europe', 'Asia']
  },
  {
    id: 'WATER_SEA_RED',
    name: 'Red Sea',
    type: 'sea',
    coordinates: [38.0, 22.0],
    significance: 'Seawater inlet of the Indian Ocean between Africa and Asia, connected to Mediterranean via the Suez Canal.',
    adjacentContinents: ['Africa', 'Asia']
  },
  {
    id: 'WATER_SEA_ARABIAN',
    name: 'Arabian Sea',
    type: 'sea',
    coordinates: [65.0, 16.0],
    significance: 'Northern part of the Indian Ocean bounded by Pakistan, Iran, the Arabian Peninsula, and India.',
    adjacentContinents: ['Asia']
  },
  {
    id: 'WATER_SEA_CORAL',
    name: 'Coral Sea',
    type: 'sea',
    coordinates: [155.0, -18.0],
    significance: 'Marginal sea off the northeast coast of Australia, home to the Great Barrier Reef.',
    adjacentContinents: ['Oceania']
  },
  {
    id: 'WATER_SEA_BERING',
    name: 'Bering Sea',
    type: 'sea',
    coordinates: [-175.0, 58.0],
    significance: 'Marginal sea of the Pacific separated from the Gulf of Alaska by the Aleutian Islands.',
    adjacentContinents: ['Americas', 'Asia']
  },
  {
    id: 'WATER_SEA_JAPAN',
    name: 'Sea of Japan',
    type: 'sea',
    coordinates: [135.0, 40.0],
    significance: 'Marginal sea between the Japanese archipelago, Sakhalin, the Korean Peninsula, and mainland Russia.',
    adjacentContinents: ['Asia']
  },
  {
    id: 'WATER_SEA_CASPIAN',
    name: 'Caspian Sea',
    type: 'sea',
    coordinates: [51.0, 42.0],
    significance: 'The world’s largest inland body of water, bounded by Russia, Kazakhstan, Turkmenistan, Iran, and Azerbaijan.',
    adjacentContinents: ['Europe', 'Asia']
  },
  {
    id: 'WATER_SEA_YELLOW',
    name: 'Yellow Sea',
    type: 'sea',
    coordinates: [124.0, 35.0],
    significance: 'Marginal sea of the Western Pacific located between mainland China and the Korean Peninsula.',
    adjacentContinents: ['Asia']
  },
  {
    id: 'WATER_SEA_NORWEGIAN',
    name: 'Norwegian Sea',
    type: 'sea',
    coordinates: [5.0, 68.0],
    significance: 'Marginal sea in the North Atlantic northwest of Norway, connecting the North Sea to the Barents Sea.',
    adjacentContinents: ['Europe']
  },
  {
    id: 'WATER_SEA_TASMAN',
    name: 'Tasman Sea',
    type: 'sea',
    coordinates: [160.0, -38.0],
    significance: 'Marginal sea between Australia and New Zealand, named after Dutch explorer Abel Tasman.',
    adjacentContinents: ['Oceania']
  },
  {
    id: 'WATER_SEA_SARGASSO',
    name: 'Sargasso Sea',
    type: 'sea',
    coordinates: [-60.0, 28.0],
    significance: 'The only sea on Earth with no land boundaries, defined entirely by the Atlantic ocean currents gyre.',
    adjacentContinents: ['Americas']
  },

  // ==========================================
  // 3. STRATEGIC STRAITS & CANALS (12)
  // ==========================================
  {
    id: 'WATER_STRAIT_GIBRALTAR',
    name: 'Strait of Gibraltar',
    type: 'strait',
    coordinates: [-5.6, 35.97],
    significance: 'Vital choke-point connecting the Atlantic Ocean to the Mediterranean Sea, separating Spain from Morocco.',
    adjacentContinents: ['Europe', 'Africa']
  },
  {
    id: 'WATER_STRAIT_HORMUZ',
    name: 'Strait of Hormuz',
    type: 'strait',
    coordinates: [56.4, 26.6],
    significance: 'The world’s most critical oil transit chokepoint between the Persian Gulf and the Gulf of Oman.',
    adjacentContinents: ['Asia']
  },
  {
    id: 'WATER_STRAIT_MALACCA',
    name: 'Strait of Malacca',
    type: 'strait',
    coordinates: [101.5, 2.5],
    significance: 'Primary shipping channel between the Indian Ocean and the Pacific Ocean, separating Malaysia and Sumatra.',
    adjacentContinents: ['Asia']
  },
  {
    id: 'WATER_STRAIT_BOSPORUS',
    name: 'Bosporus Strait',
    type: 'strait',
    coordinates: [29.07, 41.12],
    significance: 'Famous strait bisecting Istanbul, forming the continental boundary between Europe and Asia.',
    adjacentContinents: ['Europe', 'Asia']
  },
  {
    id: 'WATER_STRAIT_DARDANELLES',
    name: 'Dardanelles Strait',
    type: 'strait',
    coordinates: [26.43, 40.22],
    significance: 'Narrow strait connecting the Sea of Marmara to the Aegean Sea in northwestern Turkey.',
    adjacentContinents: ['Europe', 'Asia']
  },
  {
    id: 'WATER_STRAIT_BAB_EL_MANDEB',
    name: 'Bab-el-Mandeb Strait',
    type: 'strait',
    coordinates: [43.33, 12.58],
    significance: 'The "Gate of Tears" connecting the Red Sea to the Gulf of Aden between Yemen and Djibouti.',
    adjacentContinents: ['Africa', 'Asia']
  },
  {
    id: 'WATER_STRAIT_ENGLISH_CHANNEL',
    name: 'English Channel',
    type: 'channel',
    coordinates: [-1.5, 50.0],
    significance: 'Arm of the Atlantic separating southern England from northern France, joining the North Sea.',
    adjacentContinents: ['Europe']
  },
  {
    id: 'WATER_STRAIT_BERING',
    name: 'Bering Strait',
    type: 'strait',
    coordinates: [-168.5, 65.8],
    significance: 'Separates Russia and the United States (Alaska) by only 82 km between the Arctic and Pacific.',
    adjacentContinents: ['Asia', 'Americas']
  },
  {
    id: 'WATER_STRAIT_MAGELLAN',
    name: 'Strait of Magellan',
    type: 'strait',
    coordinates: [-71.0, -53.5],
    significance: 'Navigable natural passage between the Atlantic and Pacific Oceans in southernmost Chile.',
    adjacentContinents: ['Americas']
  },
  {
    id: 'WATER_STRAIT_TAIWAN',
    name: 'Taiwan Strait',
    type: 'strait',
    coordinates: [119.5, 24.5],
    significance: 'Strategic body of water separating the island of Taiwan from the Asian mainland.',
    adjacentContinents: ['Asia']
  },
  {
    id: 'WATER_CANAL_SUEZ',
    name: 'Suez Canal',
    type: 'strait',
    coordinates: [32.34, 30.7],
    significance: 'Artificial sea-level waterway in Egypt linking the Mediterranean Sea to the Red Sea.',
    adjacentContinents: ['Africa', 'Asia']
  },
  {
    id: 'WATER_CANAL_PANAMA',
    name: 'Panama Canal',
    type: 'strait',
    coordinates: [-79.9, 9.1],
    significance: 'Famous artificial waterway cutting through the Isthmus of Panama, connecting Atlantic and Pacific.',
    adjacentContinents: ['Americas']
  },

  // ==========================================
  // 4. MAJOR GULFS & BAYS (7)
  // ==========================================
  {
    id: 'WATER_GULF_MEXICO',
    name: 'Gulf of Mexico',
    type: 'gulf',
    coordinates: [-90.0, 25.0],
    significance: 'Ocean basin largely surrounded by the North American continent and island of Cuba.',
    adjacentContinents: ['Americas']
  },
  {
    id: 'WATER_GULF_PERSIAN',
    name: 'Persian Gulf',
    type: 'gulf',
    coordinates: [51.5, 27.0],
    significance: 'Mediterranean sea in Western Asia extension of the Indian Ocean through the Strait of Hormuz.',
    adjacentContinents: ['Asia']
  },
  {
    id: 'WATER_BAY_BENGAL',
    name: 'Bay of Bengal',
    type: 'bay',
    coordinates: [88.0, 15.0],
    significance: 'The largest water region called a bay in the world, occupying the northeastern Indian Ocean.',
    adjacentContinents: ['Asia']
  },
  {
    id: 'WATER_BAY_HUDSON',
    name: 'Hudson Bay',
    type: 'bay',
    coordinates: [-85.0, 60.0],
    significance: 'Enormous inland saltwater bay in northeastern Canada draining a major portion of North America.',
    adjacentContinents: ['Americas']
  },
  {
    id: 'WATER_GULF_GUINEA',
    name: 'Gulf of Guinea',
    type: 'gulf',
    coordinates: [2.5, 2.0],
    significance: 'The northeasternmost part of the tropical Atlantic Ocean off western Africa, where the Prime Meridian meets the Equator (0°, 0°).',
    adjacentContinents: ['Africa']
  },
  {
    id: 'WATER_GULF_ADEN',
    name: 'Gulf of Aden',
    type: 'gulf',
    coordinates: [48.0, 12.5],
    significance: 'Deepwater gulf located between Yemen and Somalia connecting the Red Sea to the Arabian Sea.',
    adjacentContinents: ['Africa', 'Asia']
  },
  {
    id: 'WATER_GULF_CALIFORNIA',
    name: 'Gulf of California',
    type: 'gulf',
    coordinates: [-111.0, 26.0],
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
