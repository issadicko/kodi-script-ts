export type AstNode =
  | NumberLiteral
  | StringLiteral
  | StringTemplate
  | BooleanLiteral
  | NullLiteral
  | Identifier
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | MemberExpr
  | SafeMemberExpr
  | ElvisExpr
  | ArrayLiteral
  | ObjectLiteral
  | IndexExpr
  | FunctionLiteral
  | LetStatement
  | AssignmentStatement
  | IfStatement
  | ForStatement
  | WhileStatement
  | ReturnStatement
  | BlockStatement
  | ExpressionStatement
  | Program;

export interface NumberLiteral {
  type: 'NumberLiteral';
  value: number;
}

export interface StringLiteral {
  type: 'StringLiteral';
  value: string;
}

export interface StringTemplate {
  type: 'StringTemplate';
  parts: AstNode[];
}

export interface BooleanLiteral {
  type: 'BooleanLiteral';
  value: boolean;
}

export interface NullLiteral {
  type: 'NullLiteral';
}

export interface Identifier {
  type: 'Identifier';
  name: string;
}

export interface BinaryExpr {
  type: 'BinaryExpr';
  operator: string;
  left: AstNode;
  right: AstNode;
}

export interface UnaryExpr {
  type: 'UnaryExpr';
  operator: string;
  operand: AstNode;
}

export interface CallExpr {
  type: 'CallExpr';
  callee: AstNode;
  args: AstNode[];
}

export interface MemberExpr {
  type: 'MemberExpr';
  object: AstNode;
  property: string;
}

export interface SafeMemberExpr {
  type: 'SafeMemberExpr';
  object: AstNode;
  property: string;
}

export interface ElvisExpr {
  type: 'ElvisExpr';
  left: AstNode;
  right: AstNode;
}

export interface ArrayLiteral {
  type: 'ArrayLiteral';
  elements: AstNode[];
}

export interface ObjectLiteral {
  type: 'ObjectLiteral';
  properties: { key: string; value: AstNode }[];
}

export interface IndexExpr {
  type: 'IndexExpr';
  object: AstNode;
  index: AstNode;
}

export interface FunctionLiteral {
  type: 'FunctionLiteral';
  parameters: Identifier[];
  body: BlockStatement;
}

export interface LetStatement {
  type: 'LetStatement';
  name: string;
  value: AstNode;
}

export interface AssignmentStatement {
  type: 'AssignmentStatement';
  name: string;
  value: AstNode;
}

export interface IfStatement {
  type: 'IfStatement';
  condition: AstNode;
  thenBranch: AstNode;
  elseBranch: AstNode | null;
}

export interface ForStatement {
  type: 'ForStatement';
  variable: Identifier;
  iterable: AstNode;
  body: BlockStatement;
}

export interface WhileStatement {
  type: 'WhileStatement';
  condition: AstNode;
  body: BlockStatement;
}

export interface ReturnStatement {
  type: 'ReturnStatement';
  value: AstNode | null;
}

export interface BlockStatement {
  type: 'BlockStatement';
  statements: AstNode[];
}

export interface ExpressionStatement {
  type: 'ExpressionStatement';
  expression: AstNode;
}

export interface Program {
  type: 'Program';
  statements: AstNode[];
}
