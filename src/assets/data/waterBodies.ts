export type WaterBodyType = 'ocean' | 'sea' | 'strait' | 'gulf' | 'bay' | 'channel';

export interface WaterBodyCircle {
  center: [number, number]; // [lng, lat]
  radiusDeg: number;
}

export interface WaterBody {
  id: string;
  name: string;
  type: WaterBodyType;
  coordinates: [number, number]; // [lng, lat]
  clickRadiusKm?: number;
  significance: string;
  adjacentContinents: string[];
  geoCircles?: WaterBodyCircle[];
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
    clickRadiusKm: 2500,
    significance: 'The largest and deepest of Earth’s oceanic divisions, covering over 30% of Earth’s surface.',
    adjacentContinents: ['Americas', 'Asia', 'Oceania'],
    geoCircles: [
      { center: [-160.0, 10.0], radiusDeg: 28 },
      { center: [160.0, 0.0], radiusDeg: 28 },
      { center: [-120.0, -20.0], radiusDeg: 24 }
    ]
  },
  {
    id: 'WATER_OCEAN_ATLANTIC',
    name: 'Atlantic Ocean',
    type: 'ocean',
    coordinates: [-30.0, 15.0],
    clickRadiusKm: 2000,
    significance: 'The second-largest ocean, separating Europe and Africa from the Americas.',
    adjacentContinents: ['Americas', 'Europe', 'Africa'],
    geoCircles: [
      { center: [-35.0, 30.0], radiusDeg: 22 },
      { center: [-20.0, -20.0], radiusDeg: 22 }
    ]
  },
  {
    id: 'WATER_OCEAN_INDIAN',
    name: 'Indian Ocean',
    type: 'ocean',
    coordinates: [75.0, -20.0],
    clickRadiusKm: 1800,
    significance: 'Bounded by Asia to the north, Africa to the west, and Australia to the east.',
    adjacentContinents: ['Asia', 'Africa', 'Oceania'],
    geoCircles: [
      { center: [75.0, -15.0], radiusDeg: 24 }
    ]
  },
  {
    id: 'WATER_OCEAN_ARCTIC',
    name: 'Arctic Ocean',
    type: 'ocean',
    coordinates: [0.0, 85.0],
    clickRadiusKm: 1200,
    significance: 'The smallest and shallowest ocean, surrounding the geographic North Pole.',
    adjacentContinents: ['Europe', 'Asia', 'Americas'],
    geoCircles: [
      { center: [0.0, 85.0], radiusDeg: 16 }
    ]
  },
  {
    id: 'WATER_OCEAN_SOUTHERN',
    name: 'Southern Ocean',
    type: 'ocean',
    coordinates: [0.0, -65.0],
    clickRadiusKm: 1500,
    significance: 'The oceanic waters encircling the entire continent of Antarctica south of 60°S.',
    adjacentContinents: ['Oceania', 'Americas', 'Africa'],
    geoCircles: [
      { center: [0.0, -65.0], radiusDeg: 20 },
      { center: [120.0, -65.0], radiusDeg: 20 },
      { center: [-120.0, -65.0], radiusDeg: 20 }
    ]
  },

  // ==========================================
  // 2. MAJOR SEAS (16)
  // ==========================================
  {
    id: 'WATER_SEA_MEDITERRANEAN',
    name: 'Mediterranean Sea',
    type: 'sea',
    coordinates: [18.0, 35.0],
    clickRadiusKm: 800,
    significance: 'Cradle of Western and Middle Eastern civilizations, connected to the Atlantic by the Strait of Gibraltar.',
    adjacentContinents: ['Europe', 'Africa', 'Asia'],
    geoCircles: [
      { center: [6.0, 39.0], radiusDeg: 7 },
      { center: [20.0, 35.0], radiusDeg: 9 }
    ]
  },
  {
    id: 'WATER_SEA_CARIBBEAN',
    name: 'Caribbean Sea',
    type: 'sea',
    coordinates: [-75.0, 15.0],
    clickRadiusKm: 700,
    significance: 'Tropical sea bounded by Central America, the Greater Antilles, and South America.',
    adjacentContinents: ['Americas'],
    geoCircles: [
      { center: [-75.0, 15.0], radiusDeg: 8.5 }
    ]
  },
  {
    id: 'WATER_SEA_SOUTH_CHINA',
    name: 'South China Sea',
    type: 'sea',
    coordinates: [115.0, 12.0],
    clickRadiusKm: 700,
    significance: 'One of the world’s most contested and economically vital maritime trade corridors.',
    adjacentContinents: ['Asia'],
    geoCircles: [
      { center: [115.0, 13.0], radiusDeg: 8.5 }
    ]
  },
  {
    id: 'WATER_SEA_NORTH',
    name: 'North Sea',
    type: 'sea',
    coordinates: [3.0, 56.0],
    clickRadiusKm: 450,
    significance: 'Marginal sea of the Atlantic located between the British Isles, Scandinavia, and Western Europe.',
    adjacentContinents: ['Europe'],
    geoCircles: [
      { center: [3.0, 56.0], radiusDeg: 5.5 }
    ]
  },
  {
    id: 'WATER_SEA_BALTIC',
    name: 'Baltic Sea',
    type: 'sea',
    coordinates: [20.0, 58.0],
    clickRadiusKm: 450,
    significance: 'Brackish mediterranean inland sea in Northern Europe bounded by the Scandinavian and Baltic states.',
    adjacentContinents: ['Europe'],
    geoCircles: [
      { center: [20.0, 58.0], radiusDeg: 5.5 }
    ]
  },
  {
    id: 'WATER_SEA_BLACK',
    name: 'Black Sea',
    type: 'sea',
    coordinates: [35.0, 43.5],
    clickRadiusKm: 450,
    significance: 'Inland marginal sea between Southeastern Europe and Western Asia, linked to the Mediterranean via the Bosporus.',
    adjacentContinents: ['Europe', 'Asia'],
    geoCircles: [
      { center: [35.0, 43.5], radiusDeg: 5.0 }
    ]
  },
  {
    id: 'WATER_SEA_RED',
    name: 'Red Sea',
    type: 'sea',
    coordinates: [38.0, 22.0],
    clickRadiusKm: 400,
    significance: 'Seawater inlet of the Indian Ocean between Africa and Asia, connected to Mediterranean via the Suez Canal.',
    adjacentContinents: ['Africa', 'Asia'],
    geoCircles: [
      { center: [38.0, 22.0], radiusDeg: 6.0 }
    ]
  },
  {
    id: 'WATER_SEA_ARABIAN',
    name: 'Arabian Sea',
    type: 'sea',
    coordinates: [65.0, 16.0],
    clickRadiusKm: 650,
    significance: 'Northern part of the Indian Ocean bounded by Pakistan, Iran, the Arabian Peninsula, and India.',
    adjacentContinents: ['Asia'],
    geoCircles: [
      { center: [65.0, 16.0], radiusDeg: 8.5 }
    ]
  },
  {
    id: 'WATER_SEA_CORAL',
    name: 'Coral Sea',
    type: 'sea',
    coordinates: [155.0, -18.0],
    clickRadiusKm: 700,
    significance: 'Marginal sea off the northeast coast of Australia, home to the Great Barrier Reef.',
    adjacentContinents: ['Oceania'],
    geoCircles: [
      { center: [155.0, -18.0], radiusDeg: 9.0 }
    ]
  },
  {
    id: 'WATER_SEA_BERING',
    name: 'Bering Sea',
    type: 'sea',
    coordinates: [-175.0, 58.0],
    clickRadiusKm: 650,
    significance: 'Marginal sea of the Pacific separated from the Gulf of Alaska by the Aleutian Islands.',
    adjacentContinents: ['Americas', 'Asia'],
    geoCircles: [
      { center: [-175.0, 58.0], radiusDeg: 8.0 }
    ]
  },
  {
    id: 'WATER_SEA_JAPAN',
    name: 'Sea of Japan',
    type: 'sea',
    coordinates: [135.0, 40.0],
    clickRadiusKm: 450,
    significance: 'Marginal sea between the Japanese archipelago, Sakhalin, the Korean Peninsula, and mainland Russia.',
    adjacentContinents: ['Asia'],
    geoCircles: [
      { center: [135.0, 40.0], radiusDeg: 5.5 }
    ]
  },
  {
    id: 'WATER_SEA_CASPIAN',
    name: 'Caspian Sea',
    type: 'sea',
    coordinates: [51.0, 42.0],
    clickRadiusKm: 400,
    significance: 'The world’s largest inland body of water, bounded by Russia, Kazakhstan, Turkmenistan, Iran, and Azerbaijan.',
    adjacentContinents: ['Europe', 'Asia'],
    geoCircles: [
      { center: [51.0, 42.0], radiusDeg: 5.0 }
    ]
  },
  {
    id: 'WATER_SEA_YELLOW',
    name: 'Yellow Sea',
    type: 'sea',
    coordinates: [124.0, 35.0],
    clickRadiusKm: 350,
    significance: 'Marginal sea of the Western Pacific located between mainland China and the Korean Peninsula.',
    adjacentContinents: ['Asia'],
    geoCircles: [
      { center: [124.0, 35.0], radiusDeg: 4.5 }
    ]
  },
  {
    id: 'WATER_SEA_NORWEGIAN',
    name: 'Norwegian Sea',
    type: 'sea',
    coordinates: [5.0, 68.0],
    clickRadiusKm: 550,
    significance: 'Marginal sea in the North Atlantic northwest of Norway, connecting the North Sea to the Barents Sea.',
    adjacentContinents: ['Europe'],
    geoCircles: [
      { center: [5.0, 68.0], radiusDeg: 7.5 }
    ]
  },
  {
    id: 'WATER_SEA_TASMAN',
    name: 'Tasman Sea',
    type: 'sea',
    coordinates: [160.0, -38.0],
    clickRadiusKm: 600,
    significance: 'Marginal sea between Australia and New Zealand, named after Dutch explorer Abel Tasman.',
    adjacentContinents: ['Oceania'],
    geoCircles: [
      { center: [160.0, -38.0], radiusDeg: 7.5 }
    ]
  },
  {
    id: 'WATER_SEA_SARGASSO',
    name: 'Sargasso Sea',
    type: 'sea',
    coordinates: [-60.0, 28.0],
    clickRadiusKm: 550,
    significance: 'The only sea on Earth with no land boundaries, defined entirely by the Atlantic ocean currents gyre.',
    adjacentContinents: ['Americas'],
    geoCircles: [
      { center: [-60.0, 28.0], radiusDeg: 7.5 }
    ]
  },

  // ==========================================
  // 3. STRATEGIC STRAITS & CANALS (12)
  // ==========================================
  {
    id: 'WATER_STRAIT_GIBRALTAR',
    name: 'Strait of Gibraltar',
    type: 'strait',
    coordinates: [-5.6, 35.97],
    clickRadiusKm: 180,
    significance: 'Vital choke-point connecting the Atlantic Ocean to the Mediterranean Sea, separating Spain from Morocco.',
    adjacentContinents: ['Europe', 'Africa'],
    geoCircles: [
      { center: [-5.6, 35.97], radiusDeg: 2.2 }
    ]
  },
  {
    id: 'WATER_STRAIT_HORMUZ',
    name: 'Strait of Hormuz',
    type: 'strait',
    coordinates: [56.4, 26.6],
    clickRadiusKm: 180,
    significance: 'The world’s most critical oil transit chokepoint between the Persian Gulf and the Gulf of Oman.',
    adjacentContinents: ['Asia'],
    geoCircles: [
      { center: [56.4, 26.6], radiusDeg: 2.2 }
    ]
  },
  {
    id: 'WATER_STRAIT_MALACCA',
    name: 'Strait of Malacca',
    type: 'strait',
    coordinates: [101.5, 2.5],
    clickRadiusKm: 220,
    significance: 'Primary shipping channel between the Indian Ocean and the Pacific Ocean, separating Malaysia and Sumatra.',
    adjacentContinents: ['Asia'],
    geoCircles: [
      { center: [101.5, 2.5], radiusDeg: 2.8 }
    ]
  },
  {
    id: 'WATER_STRAIT_BOSPORUS',
    name: 'Bosporus Strait',
    type: 'strait',
    coordinates: [29.07, 41.12],
    clickRadiusKm: 140,
    significance: 'Famous strait bisecting Istanbul, forming the continental boundary between Europe and Asia.',
    adjacentContinents: ['Europe', 'Asia'],
    geoCircles: [
      { center: [29.07, 41.12], radiusDeg: 1.8 }
    ]
  },
  {
    id: 'WATER_STRAIT_DARDANELLES',
    name: 'Dardanelles Strait',
    type: 'strait',
    coordinates: [26.43, 40.22],
    clickRadiusKm: 140,
    significance: 'Narrow strait connecting the Sea of Marmara to the Aegean Sea in northwestern Turkey.',
    adjacentContinents: ['Europe', 'Asia'],
    geoCircles: [
      { center: [26.43, 40.22], radiusDeg: 1.8 }
    ]
  },
  {
    id: 'WATER_STRAIT_BAB_EL_MANDEB',
    name: 'Bab-el-Mandeb Strait',
    type: 'strait',
    coordinates: [43.33, 12.58],
    clickRadiusKm: 160,
    significance: 'The "Gate of Tears" connecting the Red Sea to the Gulf of Aden between Yemen and Djibouti.',
    adjacentContinents: ['Africa', 'Asia'],
    geoCircles: [
      { center: [43.33, 12.58], radiusDeg: 2.0 }
    ]
  },
  {
    id: 'WATER_STRAIT_ENGLISH_CHANNEL',
    name: 'English Channel',
    type: 'channel',
    coordinates: [-1.5, 50.0],
    clickRadiusKm: 220,
    significance: 'Arm of the Atlantic separating southern England from northern France, joining the North Sea.',
    adjacentContinents: ['Europe'],
    geoCircles: [
      { center: [-1.5, 50.0], radiusDeg: 3.0 }
    ]
  },
  {
    id: 'WATER_STRAIT_BERING',
    name: 'Bering Strait',
    type: 'strait',
    coordinates: [-168.5, 65.8],
    clickRadiusKm: 200,
    significance: 'Separates Russia and the United States (Alaska) by only 82 km between the Arctic and Pacific.',
    adjacentContinents: ['Asia', 'Americas'],
    geoCircles: [
      { center: [-168.5, 65.8], radiusDeg: 2.5 }
    ]
  },
  {
    id: 'WATER_STRAIT_MAGELLAN',
    name: 'Strait of Magellan',
    type: 'strait',
    coordinates: [-71.0, -53.5],
    clickRadiusKm: 220,
    significance: 'Navigable natural passage between the Atlantic and Pacific Oceans in southernmost Chile.',
    adjacentContinents: ['Americas'],
    geoCircles: [
      { center: [-71.0, -53.5], radiusDeg: 2.8 }
    ]
  },
  {
    id: 'WATER_STRAIT_TAIWAN',
    name: 'Taiwan Strait',
    type: 'strait',
    coordinates: [119.5, 24.5],
    clickRadiusKm: 200,
    significance: 'Strategic body of water separating the island of Taiwan from the Asian mainland.',
    adjacentContinents: ['Asia'],
    geoCircles: [
      { center: [119.5, 24.5], radiusDeg: 2.5 }
    ]
  },
  {
    id: 'WATER_CANAL_SUEZ',
    name: 'Suez Canal',
    type: 'strait',
    coordinates: [32.34, 30.7],
    clickRadiusKm: 140,
    significance: 'Artificial sea-level waterway in Egypt linking the Mediterranean Sea to the Red Sea.',
    adjacentContinents: ['Africa', 'Asia'],
    geoCircles: [
      { center: [32.34, 30.7], radiusDeg: 1.8 }
    ]
  },
  {
    id: 'WATER_CANAL_PANAMA',
    name: 'Panama Canal',
    type: 'strait',
    coordinates: [-79.9, 9.1],
    clickRadiusKm: 140,
    significance: 'Famous artificial waterway cutting through the Isthmus of Panama, connecting Atlantic and Pacific.',
    adjacentContinents: ['Americas'],
    geoCircles: [
      { center: [-79.9, 9.1], radiusDeg: 1.8 }
    ]
  },

  // ==========================================
  // 4. MAJOR GULFS & BAYS (7)
  // ==========================================
  {
    id: 'WATER_GULF_MEXICO',
    name: 'Gulf of Mexico',
    type: 'gulf',
    coordinates: [-90.0, 25.0],
    clickRadiusKm: 600,
    significance: 'Ocean basin largely surrounded by the North American continent and island of Cuba.',
    adjacentContinents: ['Americas'],
    geoCircles: [
      { center: [-90.0, 25.0], radiusDeg: 7.5 }
    ]
  },
  {
    id: 'WATER_GULF_PERSIAN',
    name: 'Persian Gulf',
    type: 'gulf',
    coordinates: [51.5, 27.0],
    clickRadiusKm: 400,
    significance: 'Mediterranean sea in Western Asia extension of the Indian Ocean through the Strait of Hormuz.',
    adjacentContinents: ['Asia'],
    geoCircles: [
      { center: [51.5, 27.0], radiusDeg: 4.8 }
    ]
  },
  {
    id: 'WATER_BAY_BENGAL',
    name: 'Bay of Bengal',
    type: 'bay',
    coordinates: [88.0, 15.0],
    clickRadiusKm: 650,
    significance: 'The largest water region called a bay in the world, occupying the northeastern Indian Ocean.',
    adjacentContinents: ['Asia'],
    geoCircles: [
      { center: [88.0, 15.0], radiusDeg: 8.0 }
    ]
  },
  {
    id: 'WATER_BAY_HUDSON',
    name: 'Hudson Bay',
    type: 'bay',
    coordinates: [-85.0, 60.0],
    clickRadiusKm: 550,
    significance: 'Enormous inland saltwater bay in northeastern Canada draining a major portion of North America.',
    adjacentContinents: ['Americas'],
    geoCircles: [
      { center: [-85.0, 60.0], radiusDeg: 7.0 }
    ]
  },
  {
    id: 'WATER_GULF_GUINEA',
    name: 'Gulf of Guinea',
    type: 'gulf',
    coordinates: [2.5, 2.0],
    clickRadiusKm: 550,
    significance: 'The northeasternmost part of the tropical Atlantic Ocean off western Africa, where the Prime Meridian meets the Equator (0°, 0°).',
    adjacentContinents: ['Africa'],
    geoCircles: [
      { center: [2.5, 2.0], radiusDeg: 7.0 }
    ]
  },
  {
    id: 'WATER_GULF_ADEN',
    name: 'Gulf of Aden',
    type: 'gulf',
    coordinates: [48.0, 12.5],
    clickRadiusKm: 350,
    significance: 'Deepwater gulf located between Yemen and Somalia connecting the Red Sea to the Arabian Sea.',
    adjacentContinents: ['Africa', 'Asia'],
    geoCircles: [
      { center: [48.0, 12.5], radiusDeg: 4.5 }
    ]
  },
  {
    id: 'WATER_GULF_CALIFORNIA',
    name: 'Gulf of California',
    type: 'gulf',
    coordinates: [-111.0, 26.0],
    clickRadiusKm: 350,
    significance: 'Body of water separating the Baja California Peninsula from the Mexican mainland.',
    adjacentContinents: ['Americas'],
    geoCircles: [
      { center: [-111.0, 26.0], radiusDeg: 4.5 }
    ]
  }
];

export const WATER_BODIES_BY_ID = new Map<string, WaterBody>(
  WATER_BODIES.map((wb) => [wb.id, wb])
);

export function getWaterBodyById(id: string): WaterBody | undefined {
  return WATER_BODIES_BY_ID.get(id);
}
