import { Lexer } from './lexer';
import { Parser } from './parser';
import { Interpreter } from './interpreter';
import { NativeFunction } from './natives';
import { defaultCache } from './cache';

export interface ScriptResult {
  output: string[];
  result: unknown;
}

export class KodiScriptBuilder {
  private source: string;
  private variables: Record<string, unknown> = {};
  private functions: Map<string, NativeFunction> = new Map();
  private _silentPrint = false;
  private _useCache = true;

  constructor(source: string) {
    this.source = source;
  }

  withVariable(name: string, value: unknown): KodiScriptBuilder {
    this.variables[name] = value;
    return this;
  }

  withVariables(vars: Record<string, unknown>): KodiScriptBuilder {
    Object.assign(this.variables, vars);
    return this;
  }

  registerFunction(name: string, fn: (...args: unknown[]) => unknown): KodiScriptBuilder {
    this.functions.set(name, fn);
    return this;
  }

  silentPrint(silent = true): KodiScriptBuilder {
    this._silentPrint = silent;
    return this;
  }

  withCache(enabled = true): KodiScriptBuilder {
    this._useCache = enabled;
    return this;
  }

  execute(): ScriptResult {
    // Try cache first
    let ast = this._useCache ? defaultCache.get(this.source) : undefined;

    if (!ast) {
      const lexer = new Lexer(this.source);
      const tokens = lexer.tokenize();
      const parser = new Parser(tokens);
      ast = parser.parse();

      // Store in cache
      if (this._useCache) {
        defaultCache.set(this.source, ast);
      }
    }

    const interpreter = new Interpreter({ silentPrint: this._silentPrint });
    interpreter.setVariables(this.variables);
    this.functions.forEach((fn, name) => interpreter.registerFunction(name, fn));

    return interpreter.run(ast);
  }
}

export const KodiScript = {
  run(source: string, variables?: Record<string, unknown>): ScriptResult {
    const builder = new KodiScriptBuilder(source);
    if (variables) {
      builder.withVariables(variables);
    }
    return builder.execute();
  },

  builder(source: string): KodiScriptBuilder {
    return new KodiScriptBuilder(source);
  },
};

export default KodiScript;
export { Lexer } from './lexer';
export { Parser } from './parser';
export { Interpreter } from './interpreter';
export { Token, TokenType } from './token';
export * as AST from './ast';
