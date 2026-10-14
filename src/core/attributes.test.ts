import { describe, it, expect } from 'vitest';
import { COUNTRIES, COUNTRIES_BY_ID } from '../assets/data/countries';
import { LeaderAttribute, PoliticalRegimeAttribute, CuisineAttribute } from './attributes';

describe('Country Facts & Attribute Definitions', () => {
  it('ensures all 196 countries have verified, non-empty fact fields', () => {
    expect(COUNTRIES.length).toBe(196);

    for (const country of COUNTRIES) {
      expect(country.facts).toBeDefined();
      expect(country.facts.politicalRegime, `Missing politicalRegime for ${country.name}`).toBeTruthy();
      expect(country.facts.headOfState, `Missing headOfState for ${country.name}`).toBeTruthy();
      expect(country.facts.leader, `Missing leader for ${country.name}`).toBeTruthy();
      expect(country.facts.cuisine, `Missing cuisine for ${country.name}`).toBeTruthy();
      expect(country.facts.currency, `Missing currency for ${country.name}`).toBeTruthy();
    }
  });

  it('verifies recent head of state transitions in key nations', () => {
    // United States: Donald Trump
    const usa = COUNTRIES_BY_ID.get('USA')!;
    expect(usa.facts.headOfState).toBe('Donald Trump');
    expect(usa.facts.leader).toBe('Donald Trump');

    // United Kingdom: King Charles III (State) and Andy Burnham (Gov)
    const gbr = COUNTRIES_BY_ID.get('GBR')!;
    expect(gbr.facts.headOfState).toBe('King Charles III');
    expect(gbr.facts.headOfGovernment).toBe('Andy Burnham');

    // Germany: Frank-Walter Steinmeier (State) and Friedrich Merz (Gov)
    const deu = COUNTRIES_BY_ID.get('DEU')!;
    expect(deu.facts.headOfState).toBe('Frank-Walter Steinmeier');
    expect(deu.facts.headOfGovernment).toBe('Friedrich Merz');

    // France: Emmanuel Macron
    const fra = COUNTRIES_BY_ID.get('FRA')!;
    expect(fra.facts.headOfState).toBe('Emmanuel Macron');

    // Japan: Emperor Naruhito (State) and Sanae Takaichi (Gov)
    const jpn = COUNTRIES_BY_ID.get('JPN')!;
    expect(jpn.facts.headOfState).toBe('Emperor Naruhito');
    expect(jpn.facts.headOfGovernment).toBe('Sanae Takaichi');

    // South Korea: Lee Jae Myung
    const kor = COUNTRIES_BY_ID.get('KOR')!;
    expect(kor.facts.headOfState).toBe('Lee Jae Myung');

    // Syria: Ahmed al-Sharaa
    const syr = COUNTRIES_BY_ID.get('SYR')!;
    expect(syr.facts.headOfState).toBe('Ahmed al-Sharaa');

    // Uruguay: Yamandú Orsi
    const ury = COUNTRIES_BY_ID.get('URY')!;
    expect(ury.facts.headOfState).toBe('Yamandú Orsi');

    // Vatican City: Pope Leo XIV
    const vat = COUNTRIES_BY_ID.get('VAT')!;
    expect(vat.facts.headOfState).toBe('Pope Leo XIV');

    // Canada: King Charles III (State) and Mark Carney (Gov)
    const can = COUNTRIES_BY_ID.get('CAN')!;
    expect(can.facts.headOfState).toBe('King Charles III');
    expect(can.facts.headOfGovernment).toBe('Mark Carney');
  });

  it('validates LeaderAttribute functionality and educational dual acceptance', () => {
    const gbr = COUNTRIES_BY_ID.get('GBR')!;
    const correctVal = LeaderAttribute.getValue(gbr);
    expect(correctVal).toBe('King Charles III');

    // Exact head of state match
    const exactResult = LeaderAttribute.validateAnswer('King Charles III', correctVal, gbr);
    expect(exactResult.isCorrect).toBe(true);
    expect(exactResult.score).toBe(1);

    // Fuzzy match
    const fuzzyResult = LeaderAttribute.validateAnswer('Charles III', correctVal, gbr);
    expect(fuzzyResult.isCorrect).toBe(true);

    // Head of government acceptance with educational feedback
    const govResult = LeaderAttribute.validateAnswer('Andy Burnham', correctVal, gbr);
    expect(govResult.isCorrect).toBe(true);
    expect(govResult.score).toBe(1);
    expect(govResult.feedback).toContain('Head of Government');

    // Rejection of completely wrong leader
    const wrongResult = LeaderAttribute.validateAnswer('Emmanuel Macron', correctVal, gbr);
    expect(wrongResult.isCorrect).toBe(false);
    expect(wrongResult.score).toBe(0);
  });

  it('generates regional distractors correctly for Head of State', () => {
    const usa = COUNTRIES_BY_ID.get('USA')!;
    const distractors = LeaderAttribute.generateDistractors(usa, COUNTRIES, 3);
    expect(distractors).toHaveLength(3);
    expect(distractors).not.toContain(usa.facts.headOfState);
  });
});
