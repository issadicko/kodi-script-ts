import { Lexer } from './lexer';
import { Parser } from './parser';
import { Interpreter, LimitsExceededError, TimeoutError, MaxCallDepthError } from './interpreter';
import { NativeFunction } from './natives';
import { defaultCache } from './cache';

export type ErrorKind = 'none' | 'parse' | 'runtime' | 'timeout' | 'max_operations';

export interface ScriptResult {
  output: string[];
  value: unknown;
  errors: string[];
  errorKind: ErrorKind;
}

export class KodiScriptBuilder {
  private source: string;
  private variables: Record<string, unknown> = {};
  private functions: Map<string, NativeFunction> = new Map();
  private _silentPrint = false;
  private _useCache = true;
  private _maxOps = 0;
  private _timeout = 0;
  private _outputSink?: (line: string) => void;

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

  bind(name: string, obj: unknown): KodiScriptBuilder {
    this.variables[name] = obj;
    return this;
  }

  silentPrint(silent = true): KodiScriptBuilder {
    this._silentPrint = silent;
    return this;
  }

  /** Route print() output to a callback instead of console.log. Output is still captured. */
  withOutput(sink: (line: string) => void): KodiScriptBuilder {
    this._outputSink = sink;
    return this;
  }

  withCache(enabled = true): KodiScriptBuilder {
    this._useCache = enabled;
    return this;
  }

  withMaxOperations(maxOps: number): KodiScriptBuilder {
    this._maxOps = maxOps;
    return this;
  }

  withTimeout(timeoutMs: number): KodiScriptBuilder {
    this._timeout = timeoutMs;
    return this;
  }

  execute(): ScriptResult {
    // Parse (with cache)
    let ast = this._useCache ? defaultCache.get(this.source) : undefined;

    if (!ast) {
      try {
        const lexer = new Lexer(this.source);
        const tokens = lexer.tokenize();
        const parser = new Parser(tokens);
        ast = parser.parse();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { output: [], value: null, errors: [msg], errorKind: 'parse' };
      }
      if (this._useCache) {
        defaultCache.set(this.source, ast);
      }
    }

    const interpreter = new Interpreter({
      silentPrint: this._silentPrint,
      outputSink: this._outputSink,
    });
    interpreter.setVariables(this.variables);
    interpreter.setMaxOperations(this._maxOps);
    if (this._timeout > 0) {
      interpreter.setDeadline(Date.now() + this._timeout);
    }
    this.functions.forEach((fn, name) => interpreter.registerFunction(name, fn));

    try {
      const { output, result } = interpreter.run(ast);
      return { output, value: result, errors: [], errorKind: 'none' };
    } catch (e) {
      let errorMessage = e instanceof Error ? e.message : String(e);
      let errorKind: ErrorKind = 'runtime';
      if (e instanceof LimitsExceededError) errorKind = 'max_operations';
      else if (e instanceof TimeoutError) errorKind = 'timeout';
      else if (e instanceof MaxCallDepthError) errorKind = 'runtime';
      else if (e instanceof RangeError) {
        // JS stack overflow from deep recursion -> aligned message.
        errorMessage = 'maximum call depth exceeded';
        errorKind = 'runtime';
      }
      return { output: [], value: null, errors: [errorMessage], errorKind };
    }
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
