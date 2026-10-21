import { Country, AttributeDefinition, AttributeValidationResult } from './types';
import { fuzzyMatch, normalizeString } from './fuzzyMatch';
import { shuffleArray } from './srsEngine';

/**
 * Common English synonyms, short forms, and abbreviations for sovereign nations
 * so typing recall accepts natural variants (e.g. "UK" or "Britain" for United Kingdom).
 */
export const COUNTRY_NAME_ALIASES: Record<string, string[]> = {
  USA: ['USA', 'US', 'United States of America', 'America'],
  GBR: ['UK', 'Great Britain', 'Britain'],
  ARE: ['UAE', 'Emirates'],
  COD: ['DRC', 'DR Congo', 'Democratic Republic of Congo', 'Congo Kinshasa'],
  COG: ['Republic of Congo', 'Congo Republic', 'Congo Brazzaville', 'Congo'],
  CIV: ['Ivory Coast', "Cote d'Ivoire"],
  CZE: ['Czech Republic', 'Czechia'],
  TLS: ['East Timor', 'Timor Leste'],
  SWZ: ['Swaziland', 'eSwatini'],
  CPV: ['Cape Verde', 'Cabo Verde'],
  MMR: ['Burma', 'Myanmar'],
  VAT: ['Vatican', 'The Vatican', 'Holy See'],
  MKD: ['Macedonia', 'North Macedonia'],
  BIH: ['Bosnia', 'Bosnia Herzegovina'],
  CAF: ['CAR', 'Central African Rep'],
  STP: ['Sao Tome', 'Sao Tome and Principe'],
  VCT: ['St Vincent', 'Saint Vincent', 'Saint Vincent and the Grenadines'],
  KNA: ['St Kitts', 'Saint Kitts', 'Saint Kitts and Nevis'],
  LCA: ['St Lucia', 'Saint Lucia'],
  ATG: ['Antigua', 'Antigua and Barbuda'],
  TTO: ['Trinidad', 'Trinidad and Tobago'],
  GNB: ['Guinea Bissau'],
  FSM: ['Micronesia', 'Federated States of Micronesia'],
  GMB: ['Gambia', 'The Gambia'],
  BHS: ['Bahamas', 'The Bahamas'],
  NLD: ['Holland', 'The Netherlands'],
  PRK: ['DPRK', 'North Korea'],
  KOR: ['ROK', 'South Korea'],
  PSE: ['State of Palestine', 'Palestine'],
  BRN: ['Brunei Darussalam', 'Brunei'],
  LAO: ['Lao PDR', 'Laos'],
  RUS: ['Russian Federation', 'Russia'],
  PNG: ['PNG', 'Papua New Guinea'],
  ZAF: ['RSA', 'South Africa'],
  SLB: ['Solomons', 'Solomon Islands'],
  MHL: ['Marshalls', 'Marshall Islands']
};

/**
 * Validates a typed country name against common name, official name, and natural aliases.
 * Short acronyms (<= 3 chars, like "US", "UK", "UAE", "DRC") require an exact normalized match
 * so short typos never false-positive against an abbreviation.
 */
export function validateCountryNameAnswer(
  userAnswer: string,
  correctValue: string,
  targetCountry?: Country,
  tolerance: number = 1
): AttributeValidationResult {
  const displayTarget = targetCountry?.name || correctValue;
  const normInput = normalizeString(userAnswer);
  if (!normInput) {
    return {
      isCorrect: false,
      score: 0,
      feedback: `The country is ${displayTarget}`
    };
  }

  const aliases = targetCountry ? COUNTRY_NAME_ALIASES[targetCountry.id] || [] : [];
  const shortAliases = aliases.filter((a) => normalizeString(a).length <= 3);
  for (const shortAlias of shortAliases) {
    if (normInput === normalizeString(shortAlias)) {
      return {
        isCorrect: true,
        score: 1,
        matchedText: displayTarget,
        feedback: `Correct! (${displayTarget})`
      };
    }
  }

  const fullCandidates = [
    correctValue,
    ...(targetCountry ? [targetCountry.name, targetCountry.officialName] : []),
    ...aliases.filter((a) => normalizeString(a).length > 3)
  ].filter(Boolean);

  const res = fuzzyMatch(userAnswer, fullCandidates, tolerance);
  return {
    isCorrect: res.isMatch,
    score: res.isMatch ? 1 : 0,
    matchedText: res.bestMatch,
    feedback: res.isMatch
      ? res.distance > 0
        ? `Accepted (close spelling: ${displayTarget})`
        : `Correct! (${displayTarget})`
      : `The country is ${displayTarget}`
  };
}

/**
 * Intelligent distractor generator:
 * Selects realistic distractors primarily from the same continent / subregion
 * to provide authentic pedagogical discrimination challenges.
 */
function getRegionalDistractors<T>(
  target: Country,
  all: Country[],
  extractor: (c: Country) => T,
  count: number = 3
): T[] {
  const targetVal = extractor(target);
  
  // Prefer same continent
  const sameContinent = all.filter(
    (c) => c.id !== target.id && c.continent === target.continent && extractor(c) && extractor(c) !== targetVal
  );

  // Other continents fallback
  const otherContinents = all.filter(
    (c) => c.id !== target.id && c.continent !== target.continent && extractor(c) && extractor(c) !== targetVal
  );

  const pool = [...shuffleArray(sameContinent), ...shuffleArray(otherContinents)];
  const distractors: T[] = [];
  const seen = new Set<T>();

  for (const item of pool) {
    const val = extractor(item);
    if (!seen.has(val)) {
      seen.add(val);
      distractors.push(val);
      if (distractors.length >= count) break;
    }
  }

  return distractors;
}

/**
 * Capital City Attribute
 */
export const CapitalAttribute: AttributeDefinition<string> = {
  id: 'capital',
  label: 'Capital City',
  category: 'geography',
  icon: 'Building2',
  description: 'Master the official capital cities of each sovereign nation.',
  activeByDefault: true,
  supportsMultipleChoice: true,
  supportsTypingRecall: true,
  supportsMapClick: false,
  promptTemplate: (country: Country) => `What is the capital of ${country.name}?`,
  getValue: (c: Country) => c.capital,
  renderValue: (val: string) => val,
  generateDistractors: (target: Country, all: Country[], count: number = 3) => {
    return getRegionalDistractors(target, all, (c) => c.capital, count);
  },
  validateAnswer: (userAnswer: string, correctValue: string, _targetCountry?: Country, tolerance: number = 1): AttributeValidationResult => {
    const res = fuzzyMatch(userAnswer, correctValue, tolerance);
    return {
      isCorrect: res.isMatch,
      score: res.isMatch ? 1 : 0,
      matchedText: res.bestMatch,
      feedback: res.isMatch
        ? (res.distance > 0 ? `Accepted (close spelling: ${correctValue})` : 'Exact match!')
        : `The capital is ${correctValue}`
    };
  }
};

/**
 * Location on Map Attribute
 */
export const LocationAttribute: AttributeDefinition<string> = {
  id: 'location',
  label: 'Map Location',
  category: 'geography',
  icon: 'MapPin',
  description: 'Locate and identify countries directly on the interactive 2D map or 3D globe.',
  activeByDefault: true,
  supportsMultipleChoice: true,
  supportsTypingRecall: true,
  supportsMapClick: true,
  promptTemplate: (country: Country) => `Locate ${country.name} on the map`,
  getValue: (c: Country) => c.id,
  renderValue: (val: string) => val,
  generateDistractors: (target: Country, all: Country[], count: number = 3) => {
    return getRegionalDistractors(target, all, (c) => c.name, count);
  },
  validateAnswer: (userAnswer: string, correctValue: string, targetCountry?: Country): AttributeValidationResult => {
    // If answered via map click (userAnswer is country ID):
    if (userAnswer === correctValue) {
      return { isCorrect: true, score: 1, feedback: 'Correct location!' };
    }

    // If answered via typing (e.g. identify highlighted country):
    if (targetCountry) {
      const val = validateCountryNameAnswer(userAnswer, targetCountry.name, targetCountry, 1);
      if (val.isCorrect) {
        return { isCorrect: true, score: 1, feedback: 'Correct country identified!' };
      }
    }

    return {
      isCorrect: false,
      score: 0,
      feedback: targetCountry ? `Target was ${targetCountry.name}` : 'Incorrect location'
    };
  }
};

/**
 * Identify Country on Map Attribute (Map -> Country Name)
 */
export const CountryAttribute: AttributeDefinition<string> = {
  id: 'country',
  label: 'Country Name',
  category: 'geography',
  icon: 'Compass',
  description: 'Identify the highlighted country shown on the map by typing its name.',
  activeByDefault: true,
  supportsMultipleChoice: true,
  supportsTypingRecall: true,
  supportsMapClick: false,
  promptTemplate: (_country: Country) => 'Which country is highlighted on the map?',
  getValue: (c: Country) => c.name,
  renderValue: (val: string) => val,
  generateDistractors: (target: Country, all: Country[], count: number = 3) => {
    return getRegionalDistractors(target, all, (c) => c.name, count);
  },
  validateAnswer: (
    userAnswer: string,
    correctValue: string,
    targetCountry?: Country,
    tolerance: number = 1
  ): AttributeValidationResult => {
    return validateCountryNameAnswer(userAnswer, correctValue, targetCountry, tolerance);
  }
};

/**
 * National Flag Attribute (Flag -> Country Name)
 */
export const FlagAttribute: AttributeDefinition<string> = {
  id: 'flag',
  label: 'National Flag',
  category: 'geography',
  icon: 'Flag',
  description: 'Identify the sovereign nation from its national flag by typing its name.',
  activeByDefault: true,
  supportsMultipleChoice: true,
  supportsTypingRecall: true,
  supportsMapClick: false,
  promptTemplate: (_country: Country) => 'Which country does this flag belong to?',
  getValue: (c: Country) => c.name,
  renderValue: (val: string) => val,
  generateDistractors: (target: Country, all: Country[], count: number = 3) => {
    return getRegionalDistractors(target, all, (c) => c.name, count);
  },
  validateAnswer: (
    userAnswer: string,
    correctValue: string,
    targetCountry?: Country,
    tolerance: number = 1
  ): AttributeValidationResult => {
    return validateCountryNameAnswer(userAnswer, correctValue, targetCountry, tolerance);
  }
};

/**
 * Head of State / Leader Attribute (Extensible starter)
 */
export const LeaderAttribute: AttributeDefinition<string> = {
  id: 'leader',
  label: 'Head of State',
  category: 'politics',
  icon: 'UserCheck',
  description: 'Current heads of state (monarchs, presidents) and executive leaders.',
  activeByDefault: false,
  supportsMultipleChoice: true,
  supportsTypingRecall: true,
  supportsMapClick: false,
  promptTemplate: (country: Country) => `Who is the head of state of ${country.name}?`,
  getValue: (c: Country) => c.facts.headOfState || c.facts.leader || 'Unknown',
  renderValue: (val: string) => val,
  generateDistractors: (target: Country, all: Country[], count: number = 3) => {
    return getRegionalDistractors(target, all, (c) => c.facts.headOfState || c.facts.leader || '', count);
  },
  validateAnswer: (userAnswer: string, correctValue: string, targetCountry?: Country, tolerance: number = 2): AttributeValidationResult => {
    // Generate natural candidate forms: e.g. "King Charles III" -> ["King Charles III", "Charles III"]
    const candidates = [correctValue];
    const stripped = correctValue.replace(/^(King|Queen|Emperor|Pope|Prince|Sultan|President|Prime Minister)\s+/i, '').trim();
    if (stripped && stripped !== correctValue) {
      candidates.push(stripped);
    }

    const res = fuzzyMatch(userAnswer, candidates, tolerance);
    if (res.isMatch) {
      return {
        isCorrect: true,
        score: 1,
        matchedText: res.bestMatch,
        feedback: res.distance > 0 ? `Accepted (close spelling: ${correctValue})` : 'Correct head of state!'
      };
    }
    // Also accept headOfGovernment if provided!
    if (targetCountry?.facts?.headOfGovernment) {
      const govCandidates = [targetCountry.facts.headOfGovernment];
      const strippedGov = targetCountry.facts.headOfGovernment.replace(/^(Prime Minister|Chancellor|President)\s+/i, '').trim();
      if (strippedGov && strippedGov !== targetCountry.facts.headOfGovernment) {
        govCandidates.push(strippedGov);
      }
      const govRes = fuzzyMatch(userAnswer, govCandidates, tolerance);
      if (govRes.isMatch) {
        return {
          isCorrect: true,
          score: 1,
          matchedText: govRes.bestMatch,
          feedback: `Correct! (${targetCountry.facts.headOfGovernment} is Head of Government; Head of State is ${correctValue})`
        };
      }
    }
    return {
      isCorrect: false,
      score: 0,
      feedback: `The head of state is ${correctValue}`
    };
  }
};

/**
 * Political Regime Attribute (Extensible starter)
 */
export const PoliticalRegimeAttribute: AttributeDefinition<string> = {
  id: 'politicalRegime',
  label: 'Political Regime',
  category: 'politics',
  icon: 'Scale',
  description: 'Government system and political structure (e.g. Parliamentary republic, Constitutional monarchy).',
  activeByDefault: false,
  supportsMultipleChoice: true,
  supportsTypingRecall: true,
  supportsMapClick: false,
  promptTemplate: (country: Country) => `What type of government / political regime does ${country.name} have?`,
  getValue: (c: Country) => c.facts.politicalRegime || 'Unknown',
  renderValue: (val: string) => val,
  generateDistractors: (target: Country, all: Country[], count: number = 3) => {
    return getRegionalDistractors(target, all, (c) => c.facts.politicalRegime || '', count);
  },
  validateAnswer: (userAnswer: string, correctValue: string, _targetCountry?: Country, tolerance: number = 2): AttributeValidationResult => {
    const res = fuzzyMatch(userAnswer, correctValue, tolerance);
    return {
      isCorrect: res.isMatch,
      score: res.isMatch ? 1 : 0,
      feedback: res.isMatch ? 'Correct regime!' : `The regime is ${correctValue}`
    };
  }
};

/**
 * Culinary Dish Attribute (Extensible starter)
 */
export const CuisineAttribute: AttributeDefinition<string> = {
  id: 'cuisine',
  label: 'National Dish',
  category: 'culture',
  icon: 'Utensils',
  description: 'Famous traditional culinary dishes and national gastronomy.',
  activeByDefault: false,
  supportsMultipleChoice: true,
  supportsTypingRecall: true,
  supportsMapClick: false,
  promptTemplate: (country: Country) => `What is a renowned traditional dish of ${country.name}?`,
  getValue: (c: Country) => c.facts.cuisine || 'Unknown',
  renderValue: (val: string) => val,
  generateDistractors: (target: Country, all: Country[], count: number = 3) => {
    return getRegionalDistractors(target, all, (c) => c.facts.cuisine || '', count);
  },
  validateAnswer: (userAnswer: string, correctValue: string, _targetCountry?: Country, tolerance: number = 2): AttributeValidationResult => {
    const res = fuzzyMatch(userAnswer, correctValue, tolerance);
    return {
      isCorrect: res.isMatch,
      score: res.isMatch ? 1 : 0,
      feedback: res.isMatch ? 'Correct dish!' : `A national dish is ${correctValue}`
    };
  }
};

export const ALL_ATTRIBUTES: AttributeDefinition[] = [
  CapitalAttribute,
  LocationAttribute,
  CountryAttribute,
  FlagAttribute,
  LeaderAttribute,
  PoliticalRegimeAttribute,
  CuisineAttribute
];

export const ATTRIBUTE_REGISTRY = new Map<string, AttributeDefinition>(
  ALL_ATTRIBUTES.map((attr) => [attr.id, attr])
);
