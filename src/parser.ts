import { Token, TokenType } from './token';
import * as AST from './ast';

export class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): AST.Program {
    const statements: AST.AstNode[] = [];

    while (!this.isAtEnd()) {
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
    }

    return { type: 'Program', statements };
  }

  private parseStatement(): AST.AstNode | null {
    this.skipSemicolons();
    if (this.isAtEnd()) return null;

    if (this.check(TokenType.LET)) {
      return this.parseLetStatement();
    }
    if (this.check(TokenType.IF)) {
      return this.parseIfStatement();
    }
    if (this.check(TokenType.RETURN)) {
      return this.parseReturnStatement();
    }
    if (this.check(TokenType.FOR)) {
      return this.parseForStatement();
    }
    if (this.check(TokenType.WHILE)) {
      return this.parseWhileStatement();
    }
    if (this.check(TokenType.TRY)) {
      return this.parseTryStatement();
    }
    if (this.check(TokenType.BREAK)) {
      this.advance();
      this.consumeOptionalSemicolon();
      return { type: 'BreakStatement' };
    }
    if (this.check(TokenType.CONTINUE)) {
      this.advance();
      this.consumeOptionalSemicolon();
      return { type: 'ContinueStatement' };
    }
    // Named function declaration: fn name(...) { ... }
    if (this.check(TokenType.FN) && this.peek(1).type === TokenType.IDENTIFIER) {
      return this.parseFunctionDeclaration();
    }
    if (this.check(TokenType.IDENTIFIER)) {
      const next = this.peek(1).type;
      if (next === TokenType.ASSIGN) {
        return this.parseAssignmentStatement();
      }
      if (next === TokenType.PLUS_EQ || next === TokenType.MINUS_EQ ||
        next === TokenType.STAR_EQ || next === TokenType.SLASH_EQ) {
        return this.parseCompoundAssignment();
      }
      if (next === TokenType.PLUS_PLUS || next === TokenType.MINUS_MINUS) {
        return this.parseIncDec();
      }
    }
    if (this.check(TokenType.LBRACE)) {
      return this.parseBlockStatement();
    }

    return this.parseExpressionStatement();
  }

  private parseCompoundAssignment(): AST.AssignmentStatement {
    const name = this.advance().value; // identifier
    const opType = this.advance().type; // compound-assign operator
    const op = opType === TokenType.PLUS_EQ ? '+'
      : opType === TokenType.MINUS_EQ ? '-'
        : opType === TokenType.STAR_EQ ? '*' : '/';
    const right = this.parseExpression();
    this.consumeOptionalSemicolon();
    return {
      type: 'AssignmentStatement',
      name,
      value: { type: 'BinaryExpr', operator: op, left: { type: 'Identifier', name }, right },
    };
  }

  private parseIncDec(): AST.AssignmentStatement {
    const name = this.advance().value; // identifier
    const op = this.advance().type === TokenType.PLUS_PLUS ? '+' : '-';
    this.consumeOptionalSemicolon();
    return {
      type: 'AssignmentStatement',
      name,
      value: {
        type: 'BinaryExpr',
        operator: op,
        left: { type: 'Identifier', name },
        right: { type: 'NumberLiteral', value: 1 },
      },
    };
  }

  private parseTryStatement(): AST.TryStatement {
    this.advance(); // consume 'try'
    const body = this.parseBlockStatement();
    this.expect(TokenType.CATCH, "Expected 'catch' after try block");
    let catchVar: string | null = null;
    if (this.match(TokenType.LPAREN)) {
      catchVar = this.expect(TokenType.IDENTIFIER, "Expected catch variable name").value;
      this.expect(TokenType.RPAREN, "Expected ')' after catch variable");
    }
    const handler = this.parseBlockStatement();
    return { type: 'TryStatement', body, catchVar, handler };
  }

  private parseFunctionDeclaration(): AST.LetStatement {
    this.advance(); // consume 'fn'
    const name = this.expect(TokenType.IDENTIFIER, "Expected function name").value;
    const value = this.parseFunctionRest();
    this.consumeOptionalSemicolon();
    return { type: 'LetStatement', name, value };
  }

  private parseLetStatement(): AST.AstNode {
    this.advance(); // consume 'let'
    // Destructuring: let [a, b] = expr  /  let {a, b} = expr
    if (this.check(TokenType.LBRACKET)) return this.parseDestructure(TokenType.RBRACKET, true);
    if (this.check(TokenType.LBRACE)) return this.parseDestructure(TokenType.RBRACE, false);
    const name = this.expect(TokenType.IDENTIFIER, "Expected variable name").value;
    this.expect(TokenType.ASSIGN, "Expected '=' after variable name");
    const value = this.parseExpression();
    this.consumeOptionalSemicolon();
    return { type: 'LetStatement', name, value };
  }

  private parseDestructure(close: TokenType, isArray: boolean): AST.AstNode {
    this.advance(); // consume opening [ or {
    const names: string[] = [];
    if (!this.check(close)) {
      do {
        names.push(this.expect(TokenType.IDENTIFIER, "Expected name in destructuring").value);
      } while (this.match(TokenType.COMMA));
    }
    this.expect(close, "Expected closing bracket in destructuring");
    this.expect(TokenType.ASSIGN, "Expected '=' in destructuring");
    const value = this.parseExpression();
    this.consumeOptionalSemicolon();
    return isArray
      ? { type: 'ArrayDestructure', names, value }
      : { type: 'ObjectDestructure', names, value };
  }

  private parseAssignmentStatement(): AST.AssignmentStatement {
    const name = this.expect(TokenType.IDENTIFIER, "Expected variable name").value;
    this.expect(TokenType.ASSIGN, "Expected '=' after variable name");
    const value = this.parseExpression();
    this.consumeOptionalSemicolon();
    return { type: 'AssignmentStatement', name, value };
  }

  private parseIfStatement(): AST.IfStatement {
    this.advance(); // consume 'if'
    this.expect(TokenType.LPAREN, "Expected '(' after 'if'");
    const condition = this.parseExpression();
    this.expect(TokenType.RPAREN, "Expected ')' after condition");

    const thenBranch = this.check(TokenType.LBRACE)
      ? this.parseBlockStatement()
      : this.parseStatement()!;

    let elseBranch: AST.AstNode | null = null;
    if (this.check(TokenType.ELSE)) {
      this.advance();
      elseBranch = this.check(TokenType.LBRACE)
        ? this.parseBlockStatement()
        : this.parseStatement()!;
    }

    return { type: 'IfStatement', condition, thenBranch, elseBranch };
  }

  private parseReturnStatement(): AST.ReturnStatement {
    this.advance(); // consume 'return'
    let value: AST.AstNode | null = null;

    if (!this.check(TokenType.SEMICOLON) && !this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      value = this.parseExpression();
    }

    this.consumeOptionalSemicolon();
    return { type: 'ReturnStatement', value };
  }

  private parseForStatement(): AST.ForStatement {
    this.advance(); // consume 'for'
    this.expect(TokenType.LPAREN, "Expected '(' after 'for'");

    const variable = { type: 'Identifier', name: this.expect(TokenType.IDENTIFIER, "Expected variable name").value } as AST.Identifier;

    this.expect(TokenType.IN, "Expected 'in' after variable name");

    const iterable = this.parseExpression();

    this.expect(TokenType.RPAREN, "Expected ')' after iterable");

    const body = this.parseBlockStatement();

    return { type: 'ForStatement', variable, iterable, body };
  }

  private parseWhileStatement(): AST.WhileStatement {
    this.advance(); // consume 'while'
    this.expect(TokenType.LPAREN, "Expected '(' after 'while'");

    const condition = this.parseExpression();

    this.expect(TokenType.RPAREN, "Expected ')' after condition");

    const body = this.parseBlockStatement();

    return { type: 'WhileStatement', condition, body };
  }

  private parseBlockStatement(): AST.BlockStatement {
    this.advance(); // consume '{'
    const statements: AST.AstNode[] = [];

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
    }

    this.expect(TokenType.RBRACE, "Expected '}' after block");
    return { type: 'BlockStatement', statements };
  }

  private parseExpressionStatement(): AST.ExpressionStatement {
    const expression = this.parseExpression();
    this.consumeOptionalSemicolon();
    return { type: 'ExpressionStatement', expression };
  }

  parseExpression(): AST.AstNode {
    return this.parseTernary();
  }

  private parseTernary(): AST.AstNode {
    const condition = this.parseElvis();
    if (this.check(TokenType.QUESTION)) {
      this.advance();
      const consequent = this.parseExpression();
      this.expect(TokenType.COLON, "Expected ':' in ternary expression");
      const alternate = this.parseExpression(); // right-associative
      return { type: 'TernaryExpr', condition, consequent, alternate };
    }
    return condition;
  }

  private parseElvis(): AST.AstNode {
    let left = this.parseOr();

    while (this.check(TokenType.ELVIS)) {
      this.advance();
      const right = this.parseOr();
      left = { type: 'ElvisExpr', left, right };
    }

    return left;
  }

  private parseOr(): AST.AstNode {
    let left = this.parseAnd();

    while (this.check(TokenType.OR)) {
      const operator = this.advance().value;
      const right = this.parseAnd();
      left = { type: 'BinaryExpr', operator, left, right };
    }

    return left;
  }

  private parseAnd(): AST.AstNode {
    let left = this.parseEquality();

    while (this.check(TokenType.AND)) {
      const operator = this.advance().value;
      const right = this.parseEquality();
      left = { type: 'BinaryExpr', operator, left, right };
    }

    return left;
  }

  private parseEquality(): AST.AstNode {
    let left = this.parseComparison();

    while (this.check(TokenType.EQ) || this.check(TokenType.NEQ)) {
      const operator = this.advance().value;
      const right = this.parseComparison();
      left = { type: 'BinaryExpr', operator, left, right };
    }

    return left;
  }

  private parseComparison(): AST.AstNode {
    let left = this.parseAdditive();

    while (this.check(TokenType.LT) || this.check(TokenType.LTE) ||
      this.check(TokenType.GT) || this.check(TokenType.GTE)) {
      const operator = this.advance().value;
      const right = this.parseAdditive();
      left = { type: 'BinaryExpr', operator, left, right };
    }

    return left;
  }

  private parseAdditive(): AST.AstNode {
    let left = this.parseMultiplicative();

    while (this.check(TokenType.PLUS) || this.check(TokenType.MINUS)) {
      const operator = this.advance().value;
      const right = this.parseMultiplicative();
      left = { type: 'BinaryExpr', operator, left, right };
    }

    return left;
  }

  private parseMultiplicative(): AST.AstNode {
    let left = this.parseUnary();

    while (this.check(TokenType.STAR) || this.check(TokenType.SLASH) || this.check(TokenType.PERCENT)) {
      const operator = this.advance().value;
      const right = this.parseUnary();
      left = { type: 'BinaryExpr', operator, left, right };
    }

    return left;
  }

  private parseUnary(): AST.AstNode {
    if (this.check(TokenType.NOT) || this.check(TokenType.MINUS)) {
      const operator = this.advance().value;
      const operand = this.parseUnary();
      return { type: 'UnaryExpr', operator, operand };
    }

    return this.parsePostfix();
  }

  private parsePostfix(): AST.AstNode {
    let expr = this.parsePrimary();

    while (true) {
      if (this.check(TokenType.LPAREN)) {
        this.advance();
        const args: AST.AstNode[] = [];

        if (!this.check(TokenType.RPAREN)) {
          do {
            args.push(this.parseSpreadOrExpression());
          } while (this.match(TokenType.COMMA));
        }

        this.expect(TokenType.RPAREN, "Expected ')' after arguments");
        expr = { type: 'CallExpr', callee: expr, args };
      } else if (this.check(TokenType.DOT)) {
        this.advance();
        const property = this.expect(TokenType.IDENTIFIER, "Expected property name").value;
        expr = { type: 'MemberExpr', object: expr, property };
      } else if (this.check(TokenType.QUESTION_DOT)) {
        this.advance();
        const property = this.expect(TokenType.IDENTIFIER, "Expected property name").value;
        expr = { type: 'SafeMemberExpr', object: expr, property };
      } else if (this.check(TokenType.LBRACKET)) {
        this.advance();
        const index = this.parseExpression();
        this.expect(TokenType.RBRACKET, "Expected ']' after index");
        expr = { type: 'IndexExpr', object: expr, index };
      } else {
        break;
      }
    }

    return expr;
  }

  private parsePrimary(): AST.AstNode {
    if (this.check(TokenType.NUMBER)) {
      return { type: 'NumberLiteral', value: parseFloat(this.advance().value) };
    }

    if (this.check(TokenType.STRING)) {
      return { type: 'StringLiteral', value: this.advance().value };
    }

    if (this.check(TokenType.STRING_TEMPLATE)) {
      return this.parseStringTemplate();
    }

    if (this.check(TokenType.TRUE)) {
      this.advance();
      return { type: 'BooleanLiteral', value: true };
    }

    if (this.check(TokenType.FALSE)) {
      this.advance();
      return { type: 'BooleanLiteral', value: false };
    }

    if (this.check(TokenType.NULL)) {
      this.advance();
      return { type: 'NullLiteral' };
    }

    if (this.check(TokenType.IDENTIFIER)) {
      return { type: 'Identifier', name: this.advance().value };
    }

    if (this.check(TokenType.FN)) {
      return this.parseFunctionLiteral();
    }

    if (this.check(TokenType.LPAREN)) {
      this.advance();
      const expr = this.parseExpression();
      this.expect(TokenType.RPAREN, "Expected ')' after expression");
      return expr;
    }

    if (this.check(TokenType.LBRACKET)) {
      return this.parseArrayLiteral();
    }

    if (this.check(TokenType.LBRACE)) {
      return this.parseObjectLiteral();
    }

    throw new Error(`Unexpected token: ${this.current().value} at line ${this.current().line}`);
  }

  private parseArrayLiteral(): AST.ArrayLiteral {
    this.advance(); // consume '['
    const elements: AST.AstNode[] = [];

    if (!this.check(TokenType.RBRACKET)) {
      do {
        elements.push(this.parseSpreadOrExpression());
      } while (this.match(TokenType.COMMA));
    }

    this.expect(TokenType.RBRACKET, "Expected ']' after array elements");
    return { type: 'ArrayLiteral', elements };
  }

  private parseSpreadOrExpression(): AST.AstNode {
    if (this.check(TokenType.ELLIPSIS)) {
      this.advance();
      return { type: 'SpreadExpr', value: this.parseExpression() };
    }
    return this.parseExpression();
  }

  private parseObjectLiteral(): AST.ObjectLiteral {
    this.advance(); // consume '{'
    const properties: { key: string; value: AST.AstNode }[] = [];

    if (!this.check(TokenType.RBRACE)) {
      do {
        // Accept both identifiers and string literals as keys
        let key: string;
        if (this.check(TokenType.IDENTIFIER)) {
          key = this.advance().value;
        } else if (this.check(TokenType.STRING)) {
          key = this.advance().value;
        } else {
          throw new Error(`Expected property name at line ${this.current().line}`);
        }
        this.expect(TokenType.COLON, "Expected ':' after property name");
        const value = this.parseExpression();
        properties.push({ key, value });
      } while (this.match(TokenType.COMMA));
    }

    this.expect(TokenType.RBRACE, "Expected '}' after object properties");
    return { type: 'ObjectLiteral', properties };
  }

  private parseFunctionLiteral(): AST.FunctionLiteral {
    this.advance(); // consume 'fn'
    return this.parseFunctionRest();
  }

  // Parses `(params) { body }` after the `fn` keyword (and optional name) is consumed.
  private parseFunctionRest(): AST.FunctionLiteral {
    this.expect(TokenType.LPAREN, "Expected '(' after 'fn'");

    const parameters: AST.Identifier[] = [];

    if (!this.check(TokenType.RPAREN)) {
      do {
        const param = this.expect(TokenType.IDENTIFIER, "Expected parameter name");
        parameters.push({ type: 'Identifier', name: param.value });
      } while (this.match(TokenType.COMMA));
    }

    this.expect(TokenType.RPAREN, "Expected ')' after parameters");

    const body = this.parseBlockStatement();

    return { type: 'FunctionLiteral', parameters, body };
  }

  private parseStringTemplate(): AST.StringTemplate {
    // Store the raw template string - interpreter will parse ${} expressions
    const templateValue = this.advance().value;
    return { type: 'StringTemplate', parts: [{ type: 'StringLiteral', value: templateValue }] };
  }

  private skipSemicolons(): void {
    while (this.check(TokenType.SEMICOLON)) {
      this.advance();
    }
  }

  private consumeOptionalSemicolon(): void {
    this.match(TokenType.SEMICOLON);
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private peek(offset: number): Token {
    const index = this.pos + offset;
    if (index >= this.tokens.length) return this.tokens[this.tokens.length - 1]; // EOF
    return this.tokens[index];
  }

  private check(type: TokenType): boolean {
    return !this.isAtEnd() && this.current().type === type;
  }

  private match(type: TokenType): boolean {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.pos++;
    return this.tokens[this.pos - 1];
  }

  private expect(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw new Error(`${message} at line ${this.current().line}`);
  }

  private isAtEnd(): boolean {
    return this.current().type === TokenType.EOF;
  }
}
