import { describe, expect, it } from 'vitest';
import {
  parseCombinedSearch,
  splitSearchTokens,
  hasActiveNetworkFilters,
} from '../utils/networkSearch';

const KNOWN_CRIME_TYPES = ['Theft & Burglaries', 'Narcotics', 'Cyber Crime'];
const KNOWN_DISTRICTS = ['Bengaluru Urban', 'Mysuru', 'Belagavi'];

describe('splitSearchTokens', () => {
  it('splits on spaces, plus signs and commas', () => {
    expect(splitSearchTokens('Theft + Bengaluru,Bangalore')).toEqual([
      'Theft',
      'Bengaluru',
      'Bangalore',
    ]);
  });

  it('ignores empty and whitespace-only tokens', () => {
    expect(splitSearchTokens('  ')).toEqual([]);
    expect(splitSearchTokens('Ramu   Swamy')).toEqual(['Ramu', 'Swamy']);
  });
});

describe('parseCombinedSearch', () => {
  it('maps unknown terms to a criminal-name filter', () => {
    const result = parseCombinedSearch('Ramu Swamy', KNOWN_CRIME_TYPES, KNOWN_DISTRICTS);
    expect(result.criminalName).toBe('Ramu Swamy');
    expect(result.crimeTypes).toEqual([]);
    expect(result.districts).toEqual([]);
  });

  it('maps known crime type tokens onto the crime-type filter', () => {
    const result = parseCombinedSearch('Theft & Burglaries', KNOWN_CRIME_TYPES, KNOWN_DISTRICTS);
    expect(result.crimeTypes).toEqual(['Theft & Burglaries']);
    expect(result.criminalName).toBeUndefined();
  });

  it('combines crime type + district detection with a name term', () => {
    const result = parseCombinedSearch('Theft Bengaluru Ramu', KNOWN_CRIME_TYPES, KNOWN_DISTRICTS);
    expect(result.crimeTypes).toEqual(['Theft & Burglaries']);
    expect(result.districts).toEqual(['Bengaluru Urban']);
    expect(result.criminalName).toBe('Ramu');
  });

  it('captures a bare 4-digit year as a time window, not a suspect name', () => {
    const result = parseCombinedSearch('2025', KNOWN_CRIME_TYPES, KNOWN_DISTRICTS);
    expect(result.year).toBe('2025');
    expect(result.criminalName).toBeUndefined();
    expect(result.crimeTypes).toEqual([]);
    expect(result.districts).toEqual([]);
  });

  it('filters out a year token from a combined crime + district + year query', () => {
    const result = parseCombinedSearch('Theft Bengaluru 2025', KNOWN_CRIME_TYPES, KNOWN_DISTRICTS);
    expect(result.crimeTypes).toEqual(['Theft & Burglaries']);
    expect(result.districts).toEqual(['Bengaluru Urban']);
    expect(result.year).toBe('2025');
    expect(result.criminalName).toBeUndefined();
  });

  it('keeps a 4-digit token out of the criminal-name fallback', () => {
    const result = parseCombinedSearch('Vikram 2025', KNOWN_CRIME_TYPES, KNOWN_DISTRICTS);
    expect(result.criminalName).toBe('Vikram');
    expect(result.year).toBe('2025');
  });

  it('treats plus/comma separated tokens identically', () => {
    const a = parseCombinedSearch('Narcotics + Mysuru', KNOWN_CRIME_TYPES, KNOWN_DISTRICTS);
    const b = parseCombinedSearch('Narcotics, Mysuru', KNOWN_CRIME_TYPES, KNOWN_DISTRICTS);
    expect(a).toEqual(b);
  });

  it('returns undefined criminalName when only known terms are present', () => {
    const result = parseCombinedSearch('Bengaluru', KNOWN_CRIME_TYPES, KNOWN_DISTRICTS);
    expect(result.districts).toEqual(['Bengaluru Urban']);
    expect(result.criminalName).toBeUndefined();
  });
});

describe('hasActiveNetworkFilters', () => {
  it('is false for an empty filter object', () => {
    expect(hasActiveNetworkFilters({})).toBe(false);
  });

  it('is true when any filter dimension is populated', () => {
    expect(hasActiveNetworkFilters({ crimeTypes: ['Narcotics'] })).toBe(true);
    expect(hasActiveNetworkFilters({ districts: ['Mysuru'] })).toBe(true);
    expect(hasActiveNetworkFilters({ policeStations: ['KR Puram'] })).toBe(true);
    expect(hasActiveNetworkFilters({ firNumbers: ['FIR-1'] })).toBe(true);
    expect(hasActiveNetworkFilters({ victimName: 'Anita' })).toBe(true);
    expect(hasActiveNetworkFilters({ dateFrom: '2026-01-01' })).toBe(true);
    expect(hasActiveNetworkFilters({ dateTo: '2026-12-31' })).toBe(true);
    expect(hasActiveNetworkFilters({ criminalName: 'Ramu' })).toBe(true);
  });
});

describe('Suspect <-> Offender Nexus Subgraph Logic', () => {
  const isSuspectOrOffender = (cat: string) => cat === 'suspect' || cat === 'offender';

  const sampleNodes = [
    { id: 'S1', name: 'Khalid Mehmood', category: 'suspect' },
    { id: 'O1', name: 'Ramu Swamy', category: 'offender' },
    { id: 'S2', name: 'Tariq Bashir', category: 'suspect' },
    { id: 'O2', name: 'Imran Khan', category: 'offender' },
    { id: 'S_ISOLATED', name: 'Isolated Suspect', category: 'suspect' },
    { id: 'CDR1', name: '+91-98765-43210', category: 'cdr' },
    { id: 'TXN1', name: 'Bank Transfer #4410', category: 'financial_transaction' },
    { id: 'CASE1', name: 'FIR-2026-001', category: 'case' },
    { id: 'LOC1', name: 'KR Puram Junction', category: 'location' },
  ];

  const sampleLinks = [
    { source: 'S1', target: 'O1', relationship: 'CO_CONSPIRATOR' },
    { source: 'S1', target: 'CDR1', relationship: 'USED_PHONE' },
    { source: 'CDR1', target: 'O2', relationship: 'CALLED' },
    { source: 'S2', target: 'O2', relationship: 'ASSOCIATE' },
    { source: 'O1', target: 'O2', relationship: 'CRIMINAL_GANG' },
    { source: 'S1', target: 'TXN1', relationship: 'SENT_FUNDS' },
    { source: 'TXN1', target: 'CASE1', relationship: 'EVIDENCE_IN' },
  ];

  function computeSuspectOffenderNexus(nodes: typeof sampleNodes, links: typeof sampleLinks) {
    const candidateNodes = nodes.filter((n) => isSuspectOrOffender(n.category));
    const candidateIds = new Set(candidateNodes.map((n) => n.id));

    const candidateLinks = links.filter((l) => {
      const sId = typeof l.source === 'object' ? (l.source as any).id : String(l.source);
      const tId = typeof l.target === 'object' ? (l.target as any).id : String(l.target);
      return candidateIds.has(sId) && candidateIds.has(tId);
    });

    const connectedIds = new Set<string>();
    candidateLinks.forEach((l) => {
      const sId = typeof l.source === 'object' ? (l.source as any).id : String(l.source);
      const tId = typeof l.target === 'object' ? (l.target as any).id : String(l.target);
      connectedIds.add(sId);
      connectedIds.add(tId);
    });

    const activeNodes = candidateNodes.filter((n) => connectedIds.has(n.id));
    return {
      nodes: activeNodes.length > 0 ? activeNodes : candidateNodes,
      links: candidateLinks,
    };
  }

  it('filters out non-suspect and non-offender entities (CDRs, Transactions, Cases, Locations)', () => {
    const result = computeSuspectOffenderNexus(sampleNodes, sampleLinks);
    const categories = new Set(result.nodes.map((n) => n.category));
    expect(categories.has('cdr')).toBe(false);
    expect(categories.has('financial_transaction')).toBe(false);
    expect(categories.has('case')).toBe(false);
    expect(categories.has('location')).toBe(false);
  });

  it('isolates criminal connections between suspects and offenders', () => {
    const result = computeSuspectOffenderNexus(sampleNodes, sampleLinks);
    expect(result.links.length).toBe(3);
    const linkRels = result.links.map((l) => l.relationship);
    expect(linkRels).toContain('CO_CONSPIRATOR');
    expect(linkRels).toContain('ASSOCIATE');
    expect(linkRels).toContain('CRIMINAL_GANG');
  });

  it('retains connected suspects and offenders and excludes disconnected outliers', () => {
    const result = computeSuspectOffenderNexus(sampleNodes, sampleLinks);
    const nodeIds = result.nodes.map((n) => n.id);
    expect(nodeIds).toContain('S1');
    expect(nodeIds).toContain('O1');
    expect(nodeIds).toContain('S2');
    expect(nodeIds).toContain('O2');
    expect(nodeIds).not.toContain('S_ISOLATED');
  });

  it('handles object references in links seamlessly', () => {
    const objectLinks = [
      { source: { id: 'S1' }, target: { id: 'O1' }, relationship: 'CO_CONSPIRATOR' },
    ];
    const result = computeSuspectOffenderNexus(sampleNodes, objectLinks as any);
    expect(result.links.length).toBe(1);
    expect(result.nodes.length).toBe(2);
  });
});