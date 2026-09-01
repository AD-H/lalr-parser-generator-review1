export interface Production {
  id: number;
  lhs: string;
  rhs: string[]; // Epsilon is represented as ['ε']
}

export interface Grammar {
  productions: Production[];
  terminals: Set<string>;
  nonTerminals: Set<string>;
  startSymbol: string;
  augmentedStart: string;
}

export interface LR1Item {
  productionId: number;
  dot: number;
  lookahead: Set<string>;
}

export interface LR1State {
  id: number;
  items: LR1Item[];
  transitions: Map<string, number>; // symbol -> state ID
  coreFingerprint: string;          // LR(0) core fingerprint used for merging
}

export interface LALRState extends LR1State {
  mergedFrom: number[]; // Array of original LR(1) state IDs that were merged
}

export type ActionType = 'shift' | 'reduce' | 'accept' | 'error';

export interface Action {
  type: ActionType;
  target?: number; // state ID for shift, production ID for reduce
}

export interface Conflict {
  stateId: number;
  symbol: string;
  actions: Action[];
  type: 'S/R' | 'R/R';
}

export interface ParsingTable {
  actionTable: Map<number, Map<string, Action[]>>; // State ID -> Terminal/EOF -> Action[]
  gotoTable: Map<number, Map<string, number>>;    // State ID -> Non-Terminal -> State ID
  conflicts: Conflict[];
}

export interface TraceStep {
  step: number;
  stack: number[];
  symbols: string[];
  input: string[];
  action: string;
  production?: string;
}

export interface ParseTreeNode {
  id: string;
  label: string;
  children: ParseTreeNode[];
}
