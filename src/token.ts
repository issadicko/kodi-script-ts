export enum TokenType {
  // Literals
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  STRING_TEMPLATE = 'STRING_TEMPLATE',
  IDENTIFIER = 'IDENTIFIER',
  TRUE = 'TRUE',
  FALSE = 'FALSE',
  NULL = 'NULL',

  // Operators
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  STAR = 'STAR',
  SLASH = 'SLASH',
  PERCENT = 'PERCENT',

  // Compound assignment and increment/decrement
  PLUS_EQ = 'PLUS_EQ',
  MINUS_EQ = 'MINUS_EQ',
  STAR_EQ = 'STAR_EQ',
  SLASH_EQ = 'SLASH_EQ',
  PLUS_PLUS = 'PLUS_PLUS',
  MINUS_MINUS = 'MINUS_MINUS',

  // Comparison
  EQ = 'EQ',
  NEQ = 'NEQ',
  LT = 'LT',
  LTE = 'LTE',
  GT = 'GT',
  GTE = 'GTE',

  // Logical
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',

  // Assignment
  ASSIGN = 'ASSIGN',

  // Delimiters
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  COMMA = 'COMMA',
  DOT = 'DOT',
  ELLIPSIS = 'ELLIPSIS',
  COLON = 'COLON',
  SEMICOLON = 'SEMICOLON',

  // Null-safety / conditional
  QUESTION_DOT = 'QUESTION_DOT',
  ELVIS = 'ELVIS',
  QUESTION = 'QUESTION',

  // Keywords
  LET = 'LET',
  IF = 'IF',
  ELSE = 'ELSE',
  RETURN = 'RETURN',
  FN = 'FN',
  FOR = 'FOR',
  IN = 'IN',
  WHILE = 'WHILE',
  BREAK = 'BREAK',
  CONTINUE = 'CONTINUE',
  TRY = 'TRY',
  CATCH = 'CATCH',

  // Special
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export function createToken(type: TokenType, value: string, line: number, column: number): Token {
  return { type, value, line, column };
}
