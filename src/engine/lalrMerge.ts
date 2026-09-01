import type { LR1State, LALRState, LR1Item } from './types';

export function mergeLR1States(lr1States: LR1State[]): LALRState[] {
  // Group states by core fingerprint
  const groups = new Map<string, LR1State[]>();
  for (const state of lr1States) {
    if (!groups.has(state.coreFingerprint)) {
      groups.set(state.coreFingerprint, []);
    }
    groups.get(state.coreFingerprint)!.push(state);
  }

  // Create merged states
  const lalrStates: LALRState[] = [];
  const originalToMerged = new Map<number, number>();

  let newId = 0;
  for (const [fingerprint, statesInGroup] of groups.entries()) {
    const mergedId = newId++;
    const mergedFrom = statesInGroup.map(s => s.id).sort((a, b) => a - b);

    // Map each original ID to the new merged ID
    for (const originalId of mergedFrom) {
      originalToMerged.set(originalId, mergedId);
    }

    // Merge items
    const itemMap = new Map<string, Set<string>>(); // "prodId:dot" -> union of lookaheads
    for (const state of statesInGroup) {
      for (const item of state.items) {
        const key = `${item.productionId}:${item.dot}`;
        if (!itemMap.has(key)) {
          itemMap.set(key, new Set());
        }
        const laSet = itemMap.get(key)!;
        for (const la of item.lookahead) {
          laSet.add(la);
        }
      }
    }

    const mergedItems: LR1Item[] = [];
    for (const [key, lookaheads] of itemMap.entries()) {
      const [prodIdStr, dotStr] = key.split(':');
      mergedItems.push({
        productionId: parseInt(prodIdStr, 10),
        dot: parseInt(dotStr, 10),
        lookahead: lookaheads,
      });
    }

    lalrStates.push({
      id: mergedId,
      items: mergedItems,
      transitions: new Map<string, number>(), // will be populated in second pass
      coreFingerprint: fingerprint,
      mergedFrom,
    });
  }

  // Second pass: Populate and remap transitions
  for (const lalrState of lalrStates) {
    // Take transitions from the first state in its group (transitions are core-identical)
    const firstOriginalId = lalrState.mergedFrom[0];
    const originalState = lr1States.find(s => s.id === firstOriginalId)!;

    for (const [symbol, targetOriginalId] of originalState.transitions.entries()) {
      const targetMergedId = originalToMerged.get(targetOriginalId);
      if (targetMergedId !== undefined) {
        lalrState.transitions.set(symbol, targetMergedId);
      }
    }
  }

  return lalrStates;
}
