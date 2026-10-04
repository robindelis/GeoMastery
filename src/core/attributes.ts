import { Country, AttributeDefinition, AttributeValidationResult } from './types';
import { fuzzyMatch } from './fuzzyMatch';

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

  // Shuffle array utility
  const shuffle = <ArrayType>(arr: ArrayType[]): ArrayType[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const pool = [...shuffle(sameContinent), ...shuffle(otherContinents)];
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
  validateAnswer: (userAnswer: string, correctValue: string): AttributeValidationResult => {
    const res = fuzzyMatch(userAnswer, correctValue);
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
      const match = fuzzyMatch(userAnswer, [targetCountry.name, targetCountry.officialName]);
      if (match.isMatch) {
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
 * Head of State / Leader Attribute (Extensible starter)
 */
export const LeaderAttribute: AttributeDefinition<string> = {
  id: 'leader',
  label: 'Head of State / Leader',
  category: 'politics',
  icon: 'UserCheck',
  description: 'Current presidents, prime ministers, monarchs, or heads of government.',
  activeByDefault: false,
  supportsMultipleChoice: true,
  supportsTypingRecall: true,
  supportsMapClick: false,
  promptTemplate: (country: Country) => `Who is the leader / head of state of ${country.name}?`,
  getValue: (c: Country) => c.facts.leader || 'Unknown',
  renderValue: (val: string) => val,
  generateDistractors: (target: Country, all: Country[], count: number = 3) => {
    return getRegionalDistractors(target, all, (c) => c.facts.leader || '', count);
  },
  validateAnswer: (userAnswer: string, correctValue: string): AttributeValidationResult => {
    const res = fuzzyMatch(userAnswer, correctValue, 2);
    return {
      isCorrect: res.isMatch,
      score: res.isMatch ? 1 : 0,
      matchedText: res.bestMatch,
      feedback: res.isMatch ? 'Correct leader!' : `The leader is ${correctValue}`
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
  validateAnswer: (userAnswer: string, correctValue: string): AttributeValidationResult => {
    const res = fuzzyMatch(userAnswer, correctValue, 2);
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
  validateAnswer: (userAnswer: string, correctValue: string): AttributeValidationResult => {
    const res = fuzzyMatch(userAnswer, correctValue, 2);
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
  LeaderAttribute,
  PoliticalRegimeAttribute,
  CuisineAttribute
];

export const ATTRIBUTE_REGISTRY = new Map<string, AttributeDefinition>(
  ALL_ATTRIBUTES.map((attr) => [attr.id, attr])
);
