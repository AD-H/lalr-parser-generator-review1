import type { Production, Grammar } from './types';
import { GrammarError } from './errors';

export function parseGrammar(input: string): Grammar {
  const lines = input.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length === 0) {
    throw new GrammarError('Grammar cannot be empty.');
  }

  const productions: Production[] = [];
  const nonTerminals = new Set<string>();
  const allRhsSymbols = new Set<string>();

  // Helper to normalize arrow symbols
  const arrowRegex = /->|→/;

  // First pass: collect LHS non-terminals and parse productions
  let prodId = 1; // 0 will be reserved for augmented production S' -> S
  let startSymbol: string | null = null;

  for (const line of lines) {
    if (!arrowRegex.test(line)) {
      throw new GrammarError(`Invalid line format. Missing arrow (-> or →): "${line}"`);
    }

    const parts = line.split(arrowRegex);
    if (parts.length !== 2) {
      throw new GrammarError(`Invalid line format. Multiple arrows found: "${line}"`);
    }

    const lhs = parts[0].trim();
    const rhsPart = parts[1].trim();

    if (lhs.length === 0) {
      throw new GrammarError(`LHS of production cannot be empty: "${line}"`);
    }
    if (/\s/.test(lhs)) {
      throw new GrammarError(`LHS symbol cannot contain spaces: "${lhs}"`);
    }

    nonTerminals.add(lhs);
    if (!startSymbol) {
      startSymbol = lhs;
    }

    const alternatives = rhsPart.split('|').map(alt => alt.trim());
    for (const alt of alternatives) {
      let rhs: string[];
      if (alt.length === 0 || alt === 'ε' || alt === 'epsilon') {
        rhs = ['ε'];
      } else {
        rhs = alt.split(/\s+/).filter(sym => sym.length > 0);
      }

      productions.push({
        id: prodId++,
        lhs,
        rhs,
      });

      for (const sym of rhs) {
        if (sym !== 'ε') {
          allRhsSymbols.add(sym);
        }
      }
    }
  }

  if (!startSymbol) {
    throw new GrammarError('No valid start symbol found.');
  }

  // Validate that all referenced non-terminals have at least one production
  // and construct terminals set
  const terminals = new Set<string>();
  for (const sym of allRhsSymbols) {
    if (!nonTerminals.has(sym)) {
      terminals.add(sym);
    }
  }

  // Auto-augment: S' -> S
  const augmentedStart = startSymbol + "'";
  // Make sure augmented start is unique
  let finalAugmentedStart = augmentedStart;
  while (nonTerminals.has(finalAugmentedStart) || terminals.has(finalAugmentedStart)) {
    finalAugmentedStart += "'";
  }

  nonTerminals.add(finalAugmentedStart);
  
  const augmentedProduction: Production = {
    id: 0,
    lhs: finalAugmentedStart,
    rhs: [startSymbol],
  };

  productions.unshift(augmentedProduction);

  return {
    productions,
    terminals,
    nonTerminals,
    startSymbol,
    augmentedStart: finalAugmentedStart,
  };
}
