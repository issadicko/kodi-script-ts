import * as AST from './ast';
import { DEFAULT_NATIVES, NativeFunction, kodiStringify } from './natives';
import { Lexer } from './lexer';
import { Parser } from './parser';

const MAX_CALL_DEPTH = 1000;
const NOT_HANDLED = Symbol('not_handled');

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

export class MaxCallDepthError extends Error {
  constructor() {
    super('maximum call depth exceeded');
    this.name = 'MaxCallDepthError';
  }
}

export class ReturnValue {
  constructor(public value: unknown) { }
}

/** Control-flow signal thrown by `break`, caught by the nearest loop. */
export class BreakSignal { }

/** Control-flow signal thrown by `continue`, caught by the nearest loop. */
export class ContinueSignal { }

export class FunctionValue {
  constructor(
    public parameters: AST.Identifier[],
    public body: AST.BlockStatement,
    public closure: Map<string, unknown>
  ) { }
}

export interface InterpreterOptions {
  silentPrint?: boolean;
  outputSink?: (line: string) => void;
}

export class Interpreter {
  private variables: Map<string, unknown> = new Map();
  private customFunctions: Map<string, NativeFunction> = new Map(); // Per-instance customs
  private output: string[] = [];
  private silentPrint: boolean;
  private outputSink?: (line: string) => void;
  private opCount = 0;
  private maxOps = 0; // 0 = unlimited
  private deadline = 0; // 0 = no timeout
  private callDepth = 0; // recursion guard

  constructor(options: InterpreterOptions = {}) {
    this.silentPrint = options.silentPrint ?? false;
    this.outputSink = options.outputSink;
    // Use shared DEFAULT_NATIVES (no per-instance creation)
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
    this.customFunctions.set(name, fn);
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
      } else if (e instanceof BreakSignal || e instanceof ContinueSignal) {
        // stray break/continue outside a loop: ignore
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
        return this.evaluateElements(node.elements);
      case 'ObjectLiteral':
        return this.evaluateObjectLiteral(node);
      case 'IndexExpr':
        return this.evaluateIndexExpr(node);
      case 'FunctionLiteral':
        return this.createFunctionValue(node);
      case 'TernaryExpr':
        return this.isTruthy(this.evaluate(node.condition))
          ? this.evaluate(node.consequent)
          : this.evaluate(node.alternate);
      case 'LetStatement':
        return this.evaluateLetStatement(node);
      case 'AssignmentStatement':
        return this.evaluateAssignmentStatement(node);
      case 'ArrayDestructure':
        return this.evaluateArrayDestructure(node);
      case 'ObjectDestructure':
        return this.evaluateObjectDestructure(node);
      case 'IfStatement':
        return this.evaluateIfStatement(node);
      case 'ForStatement':
        return this.evaluateForStatement(node);
      case 'WhileStatement':
        return this.evaluateWhileStatement(node);
      case 'TryStatement':
        return this.evaluateTryStatement(node);
      case 'BreakStatement':
        throw new BreakSignal();
      case 'ContinueStatement':
        throw new ContinueSignal();
      case 'ReturnStatement':
        throw new ReturnValue(node.value ? this.evaluate(node.value) : null);
      case 'BlockStatement':
        return this.evaluateBlockStatement(node);
      case 'ExpressionStatement':
        return this.evaluate(node.expression);
      case 'SpreadExpr':
        throw new Error("spread '...' is only valid inside arrays and call arguments");
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
    // Layered lookup: customs first, then shared builtins
    if (this.customFunctions.has(node.name)) {
      return this.customFunctions.get(node.name);
    }
    if (DEFAULT_NATIVES.has(node.name)) {
      return DEFAULT_NATIVES.get(node.name);
    }
    // Matches Go/Kotlin: referencing an unbound name is an error (not null).
    throw new Error(`undefined variable: ${node.name}`);
  }

  private evaluateBinaryExpr(node: AST.BinaryExpr): unknown {
    const left = this.evaluate(node.left);
    const right = this.evaluate(node.right);

    switch (node.operator) {
      case '+':
        if (typeof left === 'string' || typeof right === 'string') {
          return kodiStringify(left) + kodiStringify(right);
        }
        return Number(left) + Number(right);
      case '-':
        return Number(left) - Number(right);
      case '*':
        return Number(left) * Number(right);
      case '/': {
        const r = Number(right);
        if (r === 0) throw new Error('division by zero');
        return Number(left) / r;
      }
      case '%': {
        const r = Number(right);
        if (r === 0) throw new Error('modulo by zero');
        return Number(left) % r;
      }
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
    // Method-call syntax: receiver.method(args)
    if (node.callee.type === 'MemberExpr') {
      return this.evaluateMethodCall(node.callee, node.args);
    }

    const args = this.evaluateElements(node.args);
    const calleeName = node.callee.type === 'Identifier' ? node.callee.name : undefined;

    // Builtins that need the interpreter (print + higher-order fns), unless
    // overridden by a user binding or a registered custom of the same name.
    if (calleeName && !this.variables.has(calleeName) && !this.customFunctions.has(calleeName)) {
      const builtin = this.callInterpreterBuiltin(calleeName, args);
      if (builtin !== NOT_HANDLED) return builtin;
    }

    // Registry native (customs first, then builtins), unless shadowed by a variable.
    if (calleeName && !this.variables.has(calleeName)) {
      const nativeFn = this.customFunctions.get(calleeName) ?? DEFAULT_NATIVES.get(calleeName);
      if (nativeFn) return nativeFn(...args);
    }

    // Otherwise evaluate the callee and apply it.
    const callee = this.evaluate(node.callee);
    return this.callValue(callee, args, calleeName);
  }

  // Implements method-call syntax: receiver.method(args).
  private evaluateMethodCall(member: AST.MemberExpr, argNodes: AST.AstNode[]): unknown {
    const receiver = this.evaluate(member.object);
    const method = member.property;
    const args = this.evaluateElements(argNodes);

    // 1. A callable stored under that key on a plain object wins (obj.fn()).
    if (this.isPlainObject(receiver)) {
      const v = (receiver as Record<string, unknown>)[method];
      if (v instanceof FunctionValue || typeof v === 'function') {
        return this.invoke(v, args);
      }
    }

    // 2. Interpreter builtin invoked as a method: prepend the receiver.
    const builtin = this.callInterpreterBuiltin(method, [receiver, ...args]);
    if (builtin !== NOT_HANDLED) return builtin;

    // 3. Registry native invoked as a method: prepend the receiver.
    const nativeFn = this.customFunctions.get(method) ?? DEFAULT_NATIVES.get(method);
    if (nativeFn) return nativeFn(receiver, ...args);

    // 4. Bound object: JS method/property via dynamic access.
    if (receiver === null || receiver === undefined) {
      throw new Error(`Cannot call method '${method}' on null`);
    }
    const value = (receiver as Record<string, unknown>)[method];
    if (typeof value === 'function') return (value as Function).apply(receiver, args);
    throw new Error(`undefined method '${method}'`);
  }

  // Built-in functions that need the interpreter (output capture or calling back
  // into user functions). Returns NOT_HANDLED if name is not such a builtin.
  private callInterpreterBuiltin(name: string, args: unknown[]): unknown {
    switch (name) {
      case 'print': {
        for (const arg of args) {
          const line = kodiStringify(arg);
          if (this.outputSink) this.outputSink(line);
          else if (!this.silentPrint) console.log(line);
          this.output.push(line);
        }
        return null;
      }
      case 'map': {
        const [arr, fn] = args;
        return Array.isArray(arr) ? arr.map((item, i) => this.invoke(fn, [item, i])) : [];
      }
      case 'filter': {
        const [arr, fn] = args;
        return Array.isArray(arr) ? arr.filter((item, i) => this.isTruthy(this.invoke(fn, [item, i]))) : [];
      }
      case 'reduce': {
        const [arr, fn, initial] = args;
        return Array.isArray(arr) ? arr.reduce((acc, item, i) => this.invoke(fn, [acc, item, i]), initial ?? null) : (initial ?? null);
      }
      case 'find': {
        const [arr, fn] = args;
        return Array.isArray(arr) ? (arr.find((item, i) => this.isTruthy(this.invoke(fn, [item, i]))) ?? null) : null;
      }
      case 'findIndex': {
        const [arr, fn] = args;
        return Array.isArray(arr) ? arr.findIndex((item, i) => this.isTruthy(this.invoke(fn, [item, i]))) : -1;
      }
      case 'some': {
        const [arr, fn] = args;
        return Array.isArray(arr) ? arr.some((item, i) => this.isTruthy(this.invoke(fn, [item, i]))) : false;
      }
      case 'every': {
        const [arr, fn] = args;
        return Array.isArray(arr) ? arr.every((item, i) => this.isTruthy(this.invoke(fn, [item, i]))) : true;
      }
      case 'flatMap': {
        const [arr, fn] = args;
        if (!Array.isArray(arr)) return [];
        const result: unknown[] = [];
        arr.forEach((item, i) => {
          const v = this.invoke(fn, [item, i]);
          if (Array.isArray(v)) result.push(...v);
          else result.push(v);
        });
        return result;
      }
    }
    return NOT_HANDLED;
  }

  private invoke(fn: unknown, args: unknown[]): unknown {
    if (fn instanceof FunctionValue) return this.applyFunction(fn, args);
    if (typeof fn === 'function') return (fn as Function)(...args);
    throw new Error('not a function');
  }

  private callValue(callee: unknown, args: unknown[], name?: string): unknown {
    if (callee instanceof FunctionValue) return this.applyFunction(callee, args);
    if (typeof callee === 'function') return (callee as NativeFunction)(...args);
    throw new Error(`${name ?? 'value'} is not a function`);
  }

  // Evaluates a list of expressions, expanding any ...spread elements.
  private evaluateElements(nodes: AST.AstNode[]): unknown[] {
    const result: unknown[] = [];
    for (const n of nodes) {
      if (n.type === 'SpreadExpr') {
        const v = this.evaluate(n.value);
        if (Array.isArray(v)) result.push(...v);
        else throw new Error('spread operator requires an array');
      } else {
        result.push(this.evaluate(n));
      }
    }
    return result;
  }

  private applyFunction(fn: FunctionValue, args: unknown[]): unknown {
    if (this.callDepth >= MAX_CALL_DEPTH) throw new MaxCallDepthError();
    this.callDepth++;

    // Create new scope: closure variables overlaid on the current scope (so a
    // top-level named function remains visible to itself for recursion).
    const previousVars = new Map(this.variables);
    fn.closure.forEach((value, key) => { this.variables.set(key, value); });
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
      if (e instanceof ReturnValue) return e.value;
      // A stray break/continue must not escape the function as a value.
      if (e instanceof BreakSignal || e instanceof ContinueSignal) return null;
      throw e;
    } finally {
      this.variables = previousVars;
      this.callDepth--;
    }
  }

  private evaluateTryStatement(node: AST.TryStatement): unknown {
    try {
      return this.evaluateBlockStatement(node.body);
    } catch (e) {
      // Control-flow and limit signals are not catchable from script.
      if (e instanceof ReturnValue || e instanceof BreakSignal || e instanceof ContinueSignal ||
        e instanceof LimitsExceededError || e instanceof TimeoutError || e instanceof MaxCallDepthError) {
        throw e;
      }
      const msg = e instanceof Error ? e.message : String(e);
      if (node.catchVar) this.variables.set(node.catchVar, msg);
      return this.evaluateBlockStatement(node.handler);
    }
  }

  private evaluateArrayDestructure(node: AST.ArrayDestructure): unknown {
    const value = this.evaluate(node.value);
    if (!Array.isArray(value)) {
      throw new Error('cannot destructure non-array value');
    }
    node.names.forEach((name, i) => this.variables.set(name, value[i] ?? null));
    return value;
  }

  private evaluateObjectDestructure(node: AST.ObjectDestructure): unknown {
    const value = this.evaluate(node.value);
    if (!this.isPlainObject(value)) {
      throw new Error('cannot destructure non-object value');
    }
    for (const name of node.names) {
      this.variables.set(name, (value as Record<string, unknown>)[name] ?? null);
    }
    return value;
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
        try {
          result = this.evaluateBlockStatement(node.body);
        } catch (e) {
          if (e instanceof BreakSignal) break;
          if (e instanceof ContinueSignal) continue;
          throw e;
        }
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

  private evaluateWhileStatement(node: AST.WhileStatement): unknown {
    let result: unknown = null;

    while (true) {
      // Check limits at each iteration
      this.checkLimits();

      // Evaluate condition
      const conditionValue = this.evaluate(node.condition);

      // Exit if condition is falsy
      if (!this.isTruthy(conditionValue)) {
        break;
      }

      // Execute body
      try {
        result = this.evaluateBlockStatement(node.body);
      } catch (e) {
        if (e instanceof BreakSignal) break;
        if (e instanceof ContinueSignal) continue;
        throw e;
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
        result += kodiStringify(value);

        i = j;
      } else {
        result += rawTemplate[i];
        i++;
      }
    }

    return result;
  }

  private isTruthy(value: unknown): boolean {
    // Matches Go/Kotlin: only null and false are falsy (0 and "" are truthy).
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    return true;
  }
}
