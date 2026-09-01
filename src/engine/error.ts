export class GrammarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GrammarError';
  }
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}
