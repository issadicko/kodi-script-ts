import { Token, TokenType, createToken } from './token';

const KEYWORDS: Record<string, TokenType> = {
  'let': TokenType.LET,
  'if': TokenType.IF,
  'else': TokenType.ELSE,
  'return': TokenType.RETURN,
  'true': TokenType.TRUE,
  'false': TokenType.FALSE,
  'null': TokenType.NULL,
  'and': TokenType.AND,
  'or': TokenType.OR,
  'not': TokenType.NOT,
};

export class Lexer {
  private source: string;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(source: string) {
    this.source = source;
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];

    while (!this.isAtEnd()) {
      this.skipWhitespaceAndComments();
      if (this.isAtEnd()) break;

      const token = this.nextToken();
      if (token) {
        tokens.push(token);
      }
    }

    tokens.push(createToken(TokenType.EOF, '', this.line, this.column));
    return tokens;
  }

  private nextToken(): Token | null {
    const startLine = this.line;
    const startColumn = this.column;
    const char = this.current();

    // String
    if (char === '"' || char === "'") {
      return this.readString(char);
    }

    // Number
    if (this.isDigit(char)) {
      return this.readNumber();
    }

    // Identifier/Keyword
    if (this.isAlpha(char)) {
      return this.readIdentifier();
    }

    // Operators and delimiters
    this.advance();

    switch (char) {
      case '+': return createToken(TokenType.PLUS, '+', startLine, startColumn);
      case '-': return createToken(TokenType.MINUS, '-', startLine, startColumn);
      case '*': return createToken(TokenType.STAR, '*', startLine, startColumn);
      case '/': return createToken(TokenType.SLASH, '/', startLine, startColumn);
      case '%': return createToken(TokenType.PERCENT, '%', startLine, startColumn);
      case '(': return createToken(TokenType.LPAREN, '(', startLine, startColumn);
      case ')': return createToken(TokenType.RPAREN, ')', startLine, startColumn);
      case '{': return createToken(TokenType.LBRACE, '{', startLine, startColumn);
      case '}': return createToken(TokenType.RBRACE, '}', startLine, startColumn);
      case '[': return createToken(TokenType.LBRACKET, '[', startLine, startColumn);
      case ']': return createToken(TokenType.RBRACKET, ']', startLine, startColumn);
      case ',': return createToken(TokenType.COMMA, ',', startLine, startColumn);
      case '.': return createToken(TokenType.DOT, '.', startLine, startColumn);
      case ':': return createToken(TokenType.COLON, ':', startLine, startColumn);
      case ';': return createToken(TokenType.SEMICOLON, ';', startLine, startColumn);
      
      case '=':
        if (this.match('=')) {
          return createToken(TokenType.EQ, '==', startLine, startColumn);
        }
        return createToken(TokenType.ASSIGN, '=', startLine, startColumn);
      
      case '!':
        if (this.match('=')) {
          return createToken(TokenType.NEQ, '!=', startLine, startColumn);
        }
        return createToken(TokenType.NOT, '!', startLine, startColumn);
      
      case '<':
        if (this.match('=')) {
          return createToken(TokenType.LTE, '<=', startLine, startColumn);
        }
        return createToken(TokenType.LT, '<', startLine, startColumn);
      
      case '>':
        if (this.match('=')) {
          return createToken(TokenType.GTE, '>=', startLine, startColumn);
        }
        return createToken(TokenType.GT, '>', startLine, startColumn);
      
      case '&':
        if (this.match('&')) {
          return createToken(TokenType.AND, '&&', startLine, startColumn);
        }
        break;
      
      case '|':
        if (this.match('|')) {
          return createToken(TokenType.OR, '||', startLine, startColumn);
        }
        break;
      
      case '?':
        if (this.match('.')) {
          return createToken(TokenType.QUESTION_DOT, '?.', startLine, startColumn);
        }
        if (this.match(':')) {
          return createToken(TokenType.ELVIS, '?:', startLine, startColumn);
        }
        break;
    }

    throw new Error(`Unexpected character '${char}' at line ${startLine}, column ${startColumn}`);
  }

  private readString(quote: string): Token {
    const startLine = this.line;
    const startColumn = this.column;
    this.advance(); // Skip opening quote
    
    let value = '';
    while (!this.isAtEnd() && this.current() !== quote) {
      if (this.current() === '\\') {
        this.advance();
        if (!this.isAtEnd()) {
          const escaped = this.current();
          switch (escaped) {
            case 'n': value += '\n'; break;
            case 't': value += '\t'; break;
            case 'r': value += '\r'; break;
            case '\\': value += '\\'; break;
            case '"': value += '"'; break;
            case "'": value += "'"; break;
            default: value += escaped;
          }
          this.advance();
        }
      } else {
        value += this.current();
        this.advance();
      }
    }
    
    if (this.isAtEnd()) {
      throw new Error(`Unterminated string at line ${startLine}, column ${startColumn}`);
    }
    
    this.advance(); // Skip closing quote
    return createToken(TokenType.STRING, value, startLine, startColumn);
  }

  private readNumber(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';
    
    while (!this.isAtEnd() && this.isDigit(this.current())) {
      value += this.current();
      this.advance();
    }
    
    if (!this.isAtEnd() && this.current() === '.' && this.isDigit(this.peek(1))) {
      value += this.current();
      this.advance();
      while (!this.isAtEnd() && this.isDigit(this.current())) {
        value += this.current();
        this.advance();
      }
    }
    
    return createToken(TokenType.NUMBER, value, startLine, startColumn);
  }

  private readIdentifier(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';
    
    while (!this.isAtEnd() && this.isAlphaNumeric(this.current())) {
      value += this.current();
      this.advance();
    }
    
    const type = KEYWORDS[value] ?? TokenType.IDENTIFIER;
    return createToken(type, value, startLine, startColumn);
  }

  private skipWhitespaceAndComments(): void {
    while (!this.isAtEnd()) {
      const char = this.current();
      
      if (char === ' ' || char === '\t' || char === '\r') {
        this.advance();
      } else if (char === '\n') {
        this.line++;
        this.column = 0;
        this.advance();
      } else if (char === '/' && this.peek(1) === '/') {
        while (!this.isAtEnd() && this.current() !== '\n') {
          this.advance();
        }
      } else {
        break;
      }
    }
  }

  private current(): string {
    return this.source[this.pos] ?? '\0';
  }

  private peek(offset: number): string {
    return this.source[this.pos + offset] ?? '\0';
  }

  private advance(): void {
    this.pos++;
    this.column++;
  }

  private match(expected: string): boolean {
    if (this.isAtEnd() || this.current() !== expected) {
      return false;
    }
    this.advance();
    return true;
  }

  private isAtEnd(): boolean {
    return this.pos >= this.source.length;
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isAlpha(char: string): boolean {
    return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_';
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }
}
