import type { Grammar } from './types';

export function computeFirstSets(grammar: Grammar): Map<string, Set<string>> {
  const first = new Map<string, Set<string>>();

  // Initialize
  for (const t of grammar.terminals) {
    first.set(t, new Set([t]));
  }
  for (const nt of grammar.nonTerminals) {
    first.set(nt, new Set());
  }
  first.set('ε', new Set(['ε']));

  let changed = true;
  while (changed) {
    changed = false;

    for (const prod of grammar.productions) {
      const lhs = prod.lhs;
      const rhs = prod.rhs;
      const currentFirst = first.get(lhs)!;
      const beforeSize = currentFirst.size;

      // Rule: If RHS is epsilon, add epsilon to FIRST(LHS)
      if (rhs.length === 1 && rhs[0] === 'ε') {
        currentFirst.add('ε');
      } else {
        let allDeriveEpsilon = true;
        for (const symbol of rhs) {
          const symFirst = first.get(symbol);
          if (!symFirst) continue;

          for (const val of symFirst) {
            if (val !== 'ε') {
              currentFirst.add(val);
            }
          }

          if (!symFirst.has('ε')) {
            allDeriveEpsilon = false;
            break;
          }
        }
        if (allDeriveEpsilon) {
          currentFirst.add('ε');
        }
      }

      if (currentFirst.size > beforeSize) {
        changed = true;
      }
    }
  }

  return first;
}

export function computeSequenceFirst(
  sequence: string[],
  lookahead: string,
  firstSets: Map<string, Set<string>>
): Set<string> {
  const result = new Set<string>();
  let allDeriveEpsilon = true;

  for (const sym of sequence) {
    if (sym === 'ε') continue;

    const symFirst = firstSets.get(sym);
    if (!symFirst) {
      // Treat as terminal if not found
      result.add(sym);
      allDeriveEpsilon = false;
      break;
    }

    for (const val of symFirst) {
      if (val !== 'ε') {
        result.add(val);
      }
    }

    if (!symFirst.has('ε')) {
      allDeriveEpsilon = false;
      break;
    }
  }

  if (allDeriveEpsilon) {
    result.add(lookahead);
  }

  return result;
}

export function computeFollowSets(
  grammar: Grammar,
  firstSets: Map<string, Set<string>>
): Map<string, Set<string>> {
  const follow = new Map<string, Set<string>>();

  // Initialize
  for (const nt of grammar.nonTerminals) {
    follow.set(nt, new Set());
  }

  // Follow of augmented start includes $
  follow.get(grammar.augmentedStart)!.add('$');

  let changed = true;
  while (changed) {
    changed = false;

    for (const prod of grammar.productions) {
      const lhs = prod.lhs;
      const rhs = prod.rhs;

      for (let i = 0; i < rhs.length; i++) {
        const symbol = rhs[i];
        if (!grammar.nonTerminals.has(symbol)) continue;

        const currentFollow = follow.get(symbol)!;
        const beforeSize = currentFollow.size;

        const rest = rhs.slice(i + 1);
        const restFirst = computeSequenceFirst(rest, 'ε', firstSets);

        for (const val of restFirst) {
          if (val !== 'ε') {
            currentFollow.add(val);
          }
        }

        if (restFirst.has('ε')) {
          const lhsFollow = follow.get(lhs)!;
          for (const val of lhsFollow) {
            currentFollow.add(val);
          }
        }

        if (currentFollow.size > beforeSize) {
          changed = true;
        }
      }
    }
  }

  return follow;
}
