import type { Grammar, LR1Item, LR1State } from './types';
import { computeSequenceFirst } from './firstFollow';

export function getCoreFingerprint(items: LR1Item[]): string {
  return items
    .map(item => `${item.productionId}:${item.dot}`)
    .sort()
    .join('|');
}

export function getLR1StateFingerprint(items: LR1Item[]): string {
  return items
    .map(item => {
      const sortedLookaheads = [...item.lookahead].sort().join(',');
      return `${item.productionId}:${item.dot}:[${sortedLookaheads}]`;
    })
    .sort()
    .join('|');
}

export function closure(
  items: LR1Item[],
  grammar: Grammar,
  firstSets: Map<string, Set<string>>
): LR1Item[] {
  const itemMap = new Map<string, Set<string>>();
  for (const item of items) {
    const key = `${item.productionId}:${item.dot}`;
    if (!itemMap.has(key)) {
      itemMap.set(key, new Set());
    }
    const lookaheadSet = itemMap.get(key)!;
    for (const la of item.lookahead) {
      lookaheadSet.add(la);
    }
  }

  const queue: { productionId: number; dot: number }[] = [];
  for (const item of items) {
    queue.push({ productionId: item.productionId, dot: item.dot });
  }

  let qIdx = 0;
  while (qIdx < queue.length) {
    const { productionId, dot } = queue[qIdx++];
    const key = `${productionId}:${dot}`;
    const lookaheads = itemMap.get(key)!;

    const prod = grammar.productions[productionId];
    if (dot >= prod.rhs.length) continue;

    const nextSymbol = prod.rhs[dot];
    if (!grammar.nonTerminals.has(nextSymbol)) continue;

    const beta = prod.rhs.slice(dot + 1);

    for (const a of lookaheads) {
      const betaAFirst = computeSequenceFirst(beta, a, firstSets);

      for (let bProdId = 0; bProdId < grammar.productions.length; bProdId++) {
        const bProd = grammar.productions[bProdId];
        if (bProd.lhs !== nextSymbol) continue;

        const bKey = `${bProdId}:0`;
        let isNew = false;
        if (!itemMap.has(bKey)) {
          itemMap.set(bKey, new Set());
          isNew = true;
        }

        const bLookaheads = itemMap.get(bKey)!;
        let addedAny = false;
        for (const terminal of betaAFirst) {
          if (!bLookaheads.has(terminal)) {
            bLookaheads.add(terminal);
            addedAny = true;
          }
        }

        if (isNew || addedAny) {
          const alreadyInQueue = queue.slice(qIdx).some(
            q => q.productionId === bProdId && q.dot === 0
          );
          if (!alreadyInQueue) {
            queue.push({ productionId: bProdId, dot: 0 });
          }
        }
      }
    }
  }

  const result: LR1Item[] = [];
  for (const [key, lookaheads] of itemMap.entries()) {
    const [productionIdStr, dotStr] = key.split(':');
    result.push({
      productionId: parseInt(productionIdStr, 10),
      dot: parseInt(dotStr, 10),
      lookahead: lookaheads,
    });
  }

  return result;
}

export function goto(
  items: LR1Item[],
  symbol: string,
  grammar: Grammar,
  firstSets: Map<string, Set<string>>
): LR1Item[] {
  const nextItems: LR1Item[] = [];
  for (const item of items) {
    const prod = grammar.productions[item.productionId];
    if (item.dot < prod.rhs.length && prod.rhs[item.dot] === symbol) {
      nextItems.push({
        productionId: item.productionId,
        dot: item.dot + 1,
        lookahead: new Set(item.lookahead),
      });
    }
  }
  return closure(nextItems, grammar, firstSets);
}

export function buildCanonicalCollection(
  grammar: Grammar,
  firstSets: Map<string, Set<string>>
): LR1State[] {
  const states: LR1State[] = [];

  const initialItems: LR1Item[] = [
    {
      productionId: 0,
      dot: 0,
      lookahead: new Set(['$']),
    },
  ];

  const i0Items = closure(initialItems, grammar, firstSets);
  const i0State: LR1State = {
    id: 0,
    items: i0Items,
    transitions: new Map<string, number>(),
    coreFingerprint: getCoreFingerprint(i0Items),
  };

  states.push(i0State);

  const queue: number[] = [0];
  let qIdx = 0;

  while (qIdx < queue.length) {
    const stateId = queue[qIdx++];
    const state = states[stateId];

    const allSymbols = [...grammar.nonTerminals, ...grammar.terminals];

    for (const symbol of allSymbols) {
      if (symbol === 'ε') continue;

      const nextItems = goto(state.items, symbol, grammar, firstSets);
      if (nextItems.length === 0) continue;

      const fingerprint = getLR1StateFingerprint(nextItems);
      let existingStateId = states.findIndex(
        s => getLR1StateFingerprint(s.items) === fingerprint
      );

      if (existingStateId === -1) {
        const newStateId = states.length;
        const newState: LR1State = {
          id: newStateId,
          items: nextItems,
          transitions: new Map<string, number>(),
          coreFingerprint: getCoreFingerprint(nextItems),
        };
        states.push(newState);
        existingStateId = newStateId;
        queue.push(newStateId);
      }

      state.transitions.set(symbol, existingStateId);
    }
  }

  return states;
}
