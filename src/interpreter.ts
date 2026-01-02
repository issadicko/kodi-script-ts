import * as AST from './ast';
import { createNatives, NativeFunction } from './natives';
import { Lexer } from './lexer';
import { Parser } from './parser';



export class LimitsExceededError extends Error {
  constructor() {
    super('max operations exceeded');
    this.name = 'LimitsExceededError';
  }
}

export class TimeoutError extends Error {
  constructor() {
    super('execution timeout');
    this.name = 'TimeoutError';
  }
}

export class ReturnValue {
  constructor(public value: unknown) { }
}

export class FunctionValue {
  constructor(
    public parameters: AST.Identifier[],
    public body: AST.BlockStatement,
    public closure: Map<string, unknown>
  ) { }
}

export interface InterpreterOptions {
  silentPrint?: boolean;
}

export class Interpreter {
  private variables: Map<string, unknown> = new Map();
  private functions: Map<string, NativeFunction> = new Map();
  private output: string[] = [];
  private silentPrint: boolean;
  private opCount = 0;
  private maxOps = 0; // 0 = unlimited
  private deadline = 0; // 0 = no timeout

  constructor(options: InterpreterOptions = {}) {
    this.silentPrint = options.silentPrint ?? false;
    // Load native functions
    const natives = createNatives();
    natives.forEach((fn, name) => this.functions.set(name, fn));
  }

  setVariable(name: string, value: unknown): void {
    this.variables.set(name, value);
  }

  setVariables(vars: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(vars)) {
      this.variables.set(key, value);
    }
  }

  registerFunction(name: string, fn: NativeFunction): void {
    this.functions.set(name, fn);
  }

  setMaxOperations(maxOps: number): void {
    this.maxOps = maxOps;
    this.opCount = 0;
  }

  setDeadline(deadline: number): void {
    this.deadline = deadline;
  }

  private checkLimits(): void {
    if (this.maxOps > 0) {
      this.opCount++;
      if (this.opCount > this.maxOps) {
        throw new LimitsExceededError();
      }
    }

    if (this.deadline > 0) {
      if (Date.now() > this.deadline) {
        throw new TimeoutError();
      }
    }
  }

  run(program: AST.Program): { output: string[]; result: unknown } {
    this.output = [];
    let result: unknown = null;

    try {
      for (const stmt of program.statements) {
        result = this.evaluate(stmt);
      }
    } catch (e) {
      if (e instanceof ReturnValue) {
        result = e.value;
      } else {
        throw e;
      }
    }

    return { output: this.output, result };
  }

  private evaluate(node: AST.AstNode): unknown {
    this.checkLimits();
    switch (node.type) {
      case 'Program':
        return this.evaluateProgram(node);
      case 'NumberLiteral':
        return node.value;
      case 'StringLiteral':
        return node.value;
      case 'StringTemplate':
        return this.evaluateStringTemplate(node);
      case 'BooleanLiteral':
        return node.value;
      case 'NullLiteral':
        return null;
      case 'Identifier':
        return this.evaluateIdentifier(node);
      case 'BinaryExpr':
        return this.evaluateBinaryExpr(node);
      case 'UnaryExpr':
        return this.evaluateUnaryExpr(node);
      case 'CallExpr':
        return this.evaluateCallExpr(node);
      case 'MemberExpr':
        return this.evaluateMemberExpr(node);
      case 'SafeMemberExpr':
        return this.evaluateSafeMemberExpr(node);
      case 'ElvisExpr':
        return this.evaluateElvisExpr(node);
      case 'ArrayLiteral':
        return node.elements.map(e => this.evaluate(e));
      case 'ObjectLiteral':
        return this.evaluateObjectLiteral(node);
      case 'IndexExpr':
        return this.evaluateIndexExpr(node);
      case 'FunctionLiteral':
        return this.createFunctionValue(node);
      case 'LetStatement':
        return this.evaluateLetStatement(node);
      case 'AssignmentStatement':
        return this.evaluateAssignmentStatement(node);
      case 'IfStatement':
        return this.evaluateIfStatement(node);
      case 'ForStatement':
        return this.evaluateForStatement(node);
      case 'ReturnStatement':
        throw new ReturnValue(node.value ? this.evaluate(node.value) : null);
      case 'BlockStatement':
        return this.evaluateBlockStatement(node);
      case 'ExpressionStatement':
        return this.evaluate(node.expression);
      default:
        throw new Error(`Unknown node type: ${(node as AST.AstNode).type}`);
    }
  }

  private createFunctionValue(node: AST.FunctionLiteral): FunctionValue {
    return new FunctionValue(node.parameters, node.body, new Map(this.variables));
  }

  private evaluateProgram(node: AST.Program): unknown {
    let result: unknown = null;
    for (const stmt of node.statements) {
      result = this.evaluate(stmt);
    }
    return result;
  }

  private evaluateIdentifier(node: AST.Identifier): unknown {
    if (this.variables.has(node.name)) {
      return this.variables.get(node.name);
    }
    if (this.functions.has(node.name)) {
      return this.functions.get(node.name);
    }
    return null;
  }

  private evaluateBinaryExpr(node: AST.BinaryExpr): unknown {
    const left = this.evaluate(node.left);
    const right = this.evaluate(node.right);

    switch (node.operator) {
      case '+':
        if (typeof left === 'string' || typeof right === 'string') {
          return String(left ?? '') + String(right ?? '');
        }
        return Number(left) + Number(right);
      case '-':
        return Number(left) - Number(right);
      case '*':
        return Number(left) * Number(right);
      case '/':
        return Number(left) / Number(right);
      case '%':
        return Number(left) % Number(right);
      case '==':
        return left === right;
      case '!=':
        return left !== right;
      case '<':
        return Number(left) < Number(right);
      case '<=':
        return Number(left) <= Number(right);
      case '>':
        return Number(left) > Number(right);
      case '>=':
        return Number(left) >= Number(right);
      case '&&':
      case 'and':
        return this.isTruthy(left) && this.isTruthy(right);
      case '||':
      case 'or':
        return this.isTruthy(left) || this.isTruthy(right);
      default:
        throw new Error(`Unknown operator: ${node.operator}`);
    }
  }

  private evaluateUnaryExpr(node: AST.UnaryExpr): unknown {
    const operand = this.evaluate(node.operand);

    switch (node.operator) {
      case '-':
        return -Number(operand);
      case '!':
      case 'not':
        return !this.isTruthy(operand);
      default:
        throw new Error(`Unknown unary operator: ${node.operator}`);
    }
  }

  private evaluateCallExpr(node: AST.CallExpr): unknown {
    const args = node.args.map(a => this.evaluate(a));

    // Get function name
    let calleeName: string | undefined;
    if (node.callee.type === 'Identifier') {
      calleeName = node.callee.name;
    }

    // Special handling for higher-order array functions with FunctionValue callbacks
    if (calleeName && ['map', 'filter', 'reduce', 'find', 'findIndex'].includes(calleeName)) {
      const arr = args[0];
      const callback = args[1];

      if (Array.isArray(arr) && callback instanceof FunctionValue) {
        switch (calleeName) {
          case 'map':
            return arr.map((item, index) => this.applyFunction(callback, [item, index]));
          case 'filter':
            return arr.filter((item, index) => this.isTruthy(this.applyFunction(callback, [item, index])));
          case 'reduce':
            const initial = args[2] ?? null;
            return arr.reduce((acc, item, index) => this.applyFunction(callback, [acc, item, index]), initial);
          case 'find':
            return arr.find((item, index) => this.isTruthy(this.applyFunction(callback, [item, index]))) ?? null;
          case 'findIndex':
            return arr.findIndex((item, index) => this.isTruthy(this.applyFunction(callback, [item, index])));
        }
      }
    }

    // Check if it's a registered function
    if (calleeName && this.functions.has(calleeName)) {
      const fn = this.functions.get(calleeName)!;
      const result = fn(...args);
      // Special handling for print
      if (calleeName === 'print') {
        const output = String(result);
        if (!this.silentPrint) {
          console.log(output);
        }
        this.output.push(output);
        return null;
      }
      return result;
    }

    // Try to evaluate as a callable value
    const callee = this.evaluate(node.callee);

    // Handle user-defined FunctionValue
    if (callee instanceof FunctionValue) {
      return this.applyFunction(callee, args);
    }

    if (typeof callee === 'function') {
      return (callee as NativeFunction)(...args);
    }

    throw new Error(`${calleeName ?? 'value'} is not a function`);
  }

  private applyFunction(fn: FunctionValue, args: unknown[]): unknown {
    // Create new scope with closure
    const previousVars = new Map(this.variables);

    // Copy closure variables
    fn.closure.forEach((value, key) => {
      this.variables.set(key, value);
    });

    // Bind parameters to arguments
    for (let i = 0; i < fn.parameters.length; i++) {
      this.variables.set(fn.parameters[i].name, args[i] ?? null);
    }

    try {
      let result: unknown = null;
      for (const stmt of fn.body.statements) {
        result = this.evaluate(stmt);
      }
      return result;
    } catch (e) {
      if (e instanceof ReturnValue) {
        return e.value;
      }
      throw e;
    } finally {
      // Restore previous scope
      this.variables = previousVars;
    }
  }

  private evaluateMemberExpr(node: AST.MemberExpr): unknown {
    const obj = this.evaluate(node.object);
    if (obj === null || obj === undefined) {
      throw new Error(`Cannot read property '${node.property}' of null`);
    }

    // First check if it's a plain object (Map-like)
    if (this.isPlainObject(obj)) {
      return (obj as Record<string, unknown>)[node.property] ?? null;
    }

    // Use dynamic property access for bound objects
    const value = (obj as any)[node.property];

    // If it's a function (method), bind it to the object
    if (typeof value === 'function') {
      return (...args: unknown[]) => value.apply(obj, args);
    }

    return value ?? null;
  }

  // Helper method to check if object is a plain object (not a class instance)
  private isPlainObject(obj: unknown): boolean {
    if (typeof obj !== 'object' || obj === null) return false;
    const proto = Object.getPrototypeOf(obj);
    return proto === null || proto === Object.prototype;
  }

  private evaluateSafeMemberExpr(node: AST.SafeMemberExpr): unknown {
    const obj = this.evaluate(node.object);
    if (obj === null || obj === undefined) {
      return null;
    }
    return (obj as Record<string, unknown>)[node.property] ?? null;
  }

  private evaluateElvisExpr(node: AST.ElvisExpr): unknown {
    const left = this.evaluate(node.left);
    if (left !== null && left !== undefined) {
      return left;
    }
    return this.evaluate(node.right);
  }

  private evaluateObjectLiteral(node: AST.ObjectLiteral): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const prop of node.properties) {
      obj[prop.key] = this.evaluate(prop.value);
    }
    return obj;
  }

  private evaluateIndexExpr(node: AST.IndexExpr): unknown {
    const obj = this.evaluate(node.object);
    const index = this.evaluate(node.index);

    if (Array.isArray(obj)) {
      return obj[Number(index)] ?? null;
    }
    if (typeof obj === 'object' && obj !== null) {
      return (obj as Record<string, unknown>)[String(index)] ?? null;
    }
    return null;
  }

  private evaluateLetStatement(node: AST.LetStatement): unknown {
    const value = this.evaluate(node.value);
    this.variables.set(node.name, value);
    return value;
  }

  private evaluateAssignmentStatement(node: AST.AssignmentStatement): unknown {
    const value = this.evaluate(node.value);
    if (!this.variables.has(node.name)) {
      throw new Error(`Variable '${node.name}' not defined`);
    }
    this.variables.set(node.name, value);
    return value;
  }

  private evaluateIfStatement(node: AST.IfStatement): unknown {
    const condition = this.evaluate(node.condition);

    if (this.isTruthy(condition)) {
      return this.evaluate(node.thenBranch);
    } else if (node.elseBranch) {
      return this.evaluate(node.elseBranch);
    }
    return null;
  }

  private evaluateForStatement(node: AST.ForStatement): unknown {
    const iterable = this.evaluate(node.iterable);

    if (!Array.isArray(iterable)) {
      throw new Error(`for loop expects an array, got ${typeof iterable}`);
    }

    let result: unknown = null;
    const previousValue = this.variables.get(node.variable.name);

    try {
      for (const item of iterable) {
        this.variables.set(node.variable.name, item);
        result = this.evaluateBlockStatement(node.body);
      }
    } finally {
      // Restore previous variable value if it existed, or delete if it didn't
      if (previousValue === undefined) {
        this.variables.delete(node.variable.name);
      } else {
        this.variables.set(node.variable.name, previousValue);
      }
    }

    return result;
  }

  private evaluateBlockStatement(node: AST.BlockStatement): unknown {
    let result: unknown = null;
    for (const stmt of node.statements) {
      result = this.evaluate(stmt);
    }
    return result;
  }

  private evaluateStringTemplate(node: AST.StringTemplate): string {
    // The parser stores the raw template string in parts[0]
    const rawTemplate = (node.parts[0] as AST.StringLiteral).value;
    let result = '';
    let i = 0;

    while (i < rawTemplate.length) {
      if (rawTemplate[i] === '$' && rawTemplate[i + 1] === '{') {
        // Find matching closing brace
        let braceCount = 1;
        let j = i + 2;
        while (j < rawTemplate.length && braceCount > 0) {
          if (rawTemplate[j] === '{') braceCount++;
          else if (rawTemplate[j] === '}') braceCount--;
          j++;
        }

        // Extract and evaluate the expression
        const exprStr = rawTemplate.slice(i + 2, j - 1);
        const lexer = new Lexer(exprStr);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        const expr = parser.parseExpression();
        const value = this.evaluate(expr);

        if (value === null || value === undefined) {
          result += 'null';
        } else {
          result += String(value);
        }

        i = j;
      } else {
        result += rawTemplate[i];
        i++;
      }
    }

    return result;
  }

  private isTruthy(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    return true;
  }
}
