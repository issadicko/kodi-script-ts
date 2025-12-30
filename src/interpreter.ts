import * as AST from './ast';
import { createNatives, NativeFunction } from './natives';

export class ReturnValue {
  constructor(public value: unknown) {}
}

export class Interpreter {
  private variables: Map<string, unknown> = new Map();
  private functions: Map<string, NativeFunction> = new Map();
  private output: string[] = [];

  constructor() {
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
    switch (node.type) {
      case 'Program':
        return this.evaluateProgram(node);
      case 'NumberLiteral':
        return node.value;
      case 'StringLiteral':
        return node.value;
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
      case 'LetStatement':
        return this.evaluateLetStatement(node);
      case 'IfStatement':
        return this.evaluateIfStatement(node);
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

    // Check if it's a registered function
    if (calleeName && this.functions.has(calleeName)) {
      const fn = this.functions.get(calleeName)!;
      const result = fn(...args);
      // Special handling for print
      if (calleeName === 'print') {
        this.output.push(String(result));
        return null;
      }
      return result;
    }

    // Try to evaluate as a callable value
    const callee = this.evaluate(node.callee);
    if (typeof callee === 'function') {
      return (callee as NativeFunction)(...args);
    }

    throw new Error(`${calleeName ?? 'value'} is not a function`);
  }

  private evaluateMemberExpr(node: AST.MemberExpr): unknown {
    const obj = this.evaluate(node.object);
    if (obj === null || obj === undefined) {
      throw new Error(`Cannot read property '${node.property}' of null`);
    }
    return (obj as Record<string, unknown>)[node.property] ?? null;
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

  private evaluateIfStatement(node: AST.IfStatement): unknown {
    const condition = this.evaluate(node.condition);

    if (this.isTruthy(condition)) {
      return this.evaluate(node.thenBranch);
    } else if (node.elseBranch) {
      return this.evaluate(node.elseBranch);
    }
    return null;
  }

  private evaluateBlockStatement(node: AST.BlockStatement): unknown {
    let result: unknown = null;
    for (const stmt of node.statements) {
      result = this.evaluate(stmt);
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
