import type { Grammar, LALRState, ParsingTable, Action, Conflict } from './types';

export function buildParsingTable(grammar: Grammar, states: LALRState[]): ParsingTable {
  const actionTable = new Map<number, Map<string, Action[]>>();
  const gotoTable = new Map<number, Map<string, number>>();
  const conflicts: Conflict[] = [];

  // Initialize tables for each state
  for (const state of states) {
    actionTable.set(state.id, new Map<string, Action[]>());
    gotoTable.set(state.id, new Map<string, number>());
  }

  // Helper to add action to action table and handle conflicts
  const addAction = (stateId: number, symbol: string, newAction: Action) => {
    const stateActions = actionTable.get(stateId)!;
    if (!stateActions.has(symbol)) {
      stateActions.set(symbol, []);
    }
    const actions = stateActions.get(symbol)!;

    // Avoid duplicate actions
    const exists = actions.some(
      a => a.type === newAction.type && a.target === newAction.target
    );
    if (!exists) {
      actions.push(newAction);
    }
  };

  // Populate ACTION and GOTO tables
  for (const state of states) {
    // 1. Shift and Goto transitions
    for (const [symbol, targetStateId] of state.transitions.entries()) {
      if (grammar.terminals.has(symbol)) {
        addAction(state.id, symbol, { type: 'shift', target: targetStateId });
      } else if (grammar.nonTerminals.has(symbol)) {
        gotoTable.get(state.id)!.set(symbol, targetStateId);
      }
    }

    // 2. Reduce and Accept actions
    for (const item of state.items) {
      const prod = grammar.productions[item.productionId];
      
      // If dot is at the end of the RHS
      // Note: for epsilon productions, LHS -> ε, dot is at 0, which equals rhs.length (1) when we treat 'ε' as matching, or we can check if rhs is ['ε'] and dot is 0.
      const isEpsilon = prod.rhs.length === 1 && prod.rhs[0] === 'ε';
      const isDotAtEnd = item.dot === prod.rhs.length || (isEpsilon && item.dot === 0);

      if (isDotAtEnd) {
        if (prod.lhs === grammar.augmentedStart) {
          // S' -> S.
          for (const la of item.lookahead) {
            if (la === '$') {
              addAction(state.id, '$', { type: 'accept' });
            }
          }
        } else {
          // Standard production reduce
          for (const la of item.lookahead) {
            addAction(state.id, la, { type: 'reduce', target: item.productionId });
          }
        }
      }
    }
  }

  // 3. Detect conflicts
  for (const [stateId, symbolActions] of actionTable.entries()) {
    for (const [symbol, actions] of symbolActions.entries()) {
      if (actions.length > 1) {
        const hasShift = actions.some(a => a.type === 'shift');
        const reduces = actions.filter(a => a.type === 'reduce');

        let conflictType: 'S/R' | 'R/R' = 'S/R';
        if (reduces.length > 1 && !hasShift) {
          conflictType = 'R/R';
        } else if (hasShift && reduces.length > 0) {
          conflictType = 'S/R';
        }

        conflicts.push({
          stateId,
          symbol,
          actions,
          type: conflictType,
        });
      }
    }
  }

  return {
    actionTable,
    gotoTable,
    conflicts,
  };
}
