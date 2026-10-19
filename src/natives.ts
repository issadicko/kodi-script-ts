// import { createHash } from 'crypto';
import { registerDateNatives } from './dates';
import { registerListNatives } from './lists';
import { isPlainObj, kodiStringify } from './values';

export { kodiStringify };

export type NativeFunction = (...args: unknown[]) => unknown;

export function createNatives(): Map<string, NativeFunction> {
  const natives = new Map<string, NativeFunction>();

  // Print
  natives.set('print', (...args) => {
    return args.map(a => stringify(a)).join(' ');
  });

  // Type conversion
  natives.set('toString', (val) => stringify(val));
  natives.set('toNumber', (val) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val) || 0;
    if (typeof val === 'boolean') return val ? 1 : 0;
    return 0;
  });

  // String functions
  natives.set('length', (str) => String(str).length);
  natives.set('substring', (str, start, end?) =>
    String(str).substring(Number(start), end !== undefined ? Number(end) : undefined));
  natives.set('toUpperCase', (str) => String(str).toUpperCase());
  natives.set('toLowerCase', (str) => String(str).toLowerCase());
  natives.set('trim', (str) => String(str).trim());
  natives.set('replace', (str, old, newStr) => String(str).replace(String(old), String(newStr)));
  natives.set('split', (str, sep) => String(str).split(String(sep)));
  natives.set('join', (arr, sep) => Array.isArray(arr) ? arr.map(kodiStringify).join(String(sep)) : '');
  natives.set('contains', (str, substr) => String(str).includes(String(substr)));
  natives.set('startsWith', (str, prefix) => String(str).startsWith(String(prefix)));
  natives.set('endsWith', (str, suffix) => String(str).endsWith(String(suffix)));
  natives.set('indexOf', (str, substr) => String(str).indexOf(String(substr)));
  natives.set('padLeft', (str, length, char?) => String(str).padStart(Number(length), char ? String(char) : ' '));
  natives.set('padRight', (str, length, char?) => String(str).padEnd(Number(length), char ? String(char) : ' '));
  natives.set('repeat', (str, count) => String(str).repeat(Math.max(0, Math.floor(Number(count)))));

  // Math functions
  natives.set('abs', (n) => Math.abs(Number(n)));
  natives.set('floor', (n) => Math.floor(Number(n)));
  natives.set('ceil', (n) => Math.ceil(Number(n)));
  natives.set('round', (n) => Math.round(Number(n)));
  natives.set('min', (...args) => Math.min(...args.map(Number)));
  natives.set('max', (...args) => Math.max(...args.map(Number)));
  natives.set('pow', (base, exp) => Math.pow(Number(base), Number(exp)));
  natives.set('sqrt', (n) => Math.sqrt(Number(n)));
  natives.set('sin', (n) => Math.sin(Number(n)));
  natives.set('cos', (n) => Math.cos(Number(n)));
  natives.set('tan', (n) => Math.tan(Number(n)));
  natives.set('log', (n) => Math.log(Number(n)));
  natives.set('log10', (n) => Math.log10(Number(n)));
  natives.set('exp', (n) => Math.exp(Number(n)));

  // Random
  natives.set('random', () => Math.random());
  natives.set('randomInt', (min, max) => {
    const minVal = Math.ceil(Number(min));
    const maxVal = Math.floor(Number(max));
    return Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
  });
  natives.set('randomUUID', () => globalThis.crypto?.randomUUID() ?? '00000000-0000-0000-0000-000000000000');

  // JSON
  natives.set('jsonParse', (str) => {
    try {
      return JSON.parse(String(str));
    } catch {
      return null;
    }
  });
  natives.set('jsonStringify', (val) => JSON.stringify(val));

  // Base64 (universal - works in browser and Node.js)
  natives.set('base64Encode', (str) => {
    const s = String(str);
    try {
      return btoa(unescape(encodeURIComponent(s)));
    } catch {
      // Fallback for environments without btoa
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let output = '';
      for (let i = 0; i < s.length; i += 3) {
        const a = s.charCodeAt(i);
        const b = s.charCodeAt(i + 1) || 0;
        const c = s.charCodeAt(i + 2) || 0;
        output += chars[(a >> 2)] + chars[((a & 3) << 4) | (b >> 4)] +
          chars[((b & 15) << 2) | (c >> 6)] + chars[c & 63];
      }
      return output;
    }
  });
  natives.set('base64Decode', (str) => {
    const s = String(str);
    try {
      return decodeURIComponent(escape(atob(s)));
    } catch {
      return s;
    }
  });

  // URL encoding
  natives.set('urlEncode', (str) => encodeURIComponent(String(str)));
  natives.set('urlDecode', (str) => decodeURIComponent(String(str)));

  // Array functions
  natives.set('size', (arr) => Array.isArray(arr) ? arr.length : 0);
  natives.set('first', (arr) => Array.isArray(arr) && arr.length > 0 ? arr[0] : null);
  natives.set('last', (arr) => Array.isArray(arr) && arr.length > 0 ? arr[arr.length - 1] : null);
  natives.set('slice', (arr, start, end?) =>
    Array.isArray(arr) ? arr.slice(Number(start), end !== undefined ? Number(end) : undefined) : []);
  natives.set('reverse', (arr) => Array.isArray(arr) ? [...arr].reverse() : []);
  natives.set('sort', (arr, order?) => {
    if (!Array.isArray(arr)) return [];
    const sorted = [...arr].sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      return String(a).localeCompare(String(b));
    });
    return order === 'desc' ? sorted.reverse() : sorted;
  });
  natives.set('sortBy', (arr, field, order?) => {
    if (!Array.isArray(arr)) return [];
    const sorted = [...arr].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)?.[String(field)];
      const bVal = (b as Record<string, unknown>)?.[String(field)];
      if (typeof aVal === 'number' && typeof bVal === 'number') return aVal - bVal;
      return String(aVal).localeCompare(String(bVal));
    });
    return order === 'desc' ? sorted.reverse() : sorted;
  });

  // Higher-order array functions
  natives.set('map', (arr, fn) => {
    if (!Array.isArray(arr) || typeof fn !== 'function') return [];
    return arr.map((item, index) => (fn as Function)(item, index));
  });
  natives.set('filter', (arr, fn) => {
    if (!Array.isArray(arr) || typeof fn !== 'function') return [];
    return arr.filter((item, index) => (fn as Function)(item, index));
  });
  natives.set('reduce', (arr, fn, initial) => {
    if (!Array.isArray(arr) || typeof fn !== 'function') return initial ?? null;
    return arr.reduce((acc, item, index) => (fn as Function)(acc, item, index), initial ?? 0);
  });
  natives.set('find', (arr, fn) => {
    if (!Array.isArray(arr) || typeof fn !== 'function') return null;
    return arr.find((item, index) => (fn as Function)(item, index)) ?? null;
  });
  natives.set('findIndex', (arr, fn) => {
    if (!Array.isArray(arr) || typeof fn !== 'function') return -1;
    return arr.findIndex((item, index) => (fn as Function)(item, index));
  });

  // Expanded array functions
  natives.set('range', (a, b?) => {
    const start = b === undefined ? 0 : Math.trunc(Number(a));
    const end = b === undefined ? Math.trunc(Number(a)) : Math.trunc(Number(b));
    const result: number[] = [];
    for (let i = start; i < end; i++) result.push(i);
    return result;
  });
  natives.set('sum', (arr) => Array.isArray(arr) ? arr.reduce((acc, x) => acc + Number(x), 0) : 0);
  natives.set('avg', (arr) => Array.isArray(arr) && arr.length > 0 ? arr.reduce((acc, x) => acc + Number(x), 0) / arr.length : 0);
  natives.set('unique', (arr) => {
    if (!Array.isArray(arr)) return [];
    const seen = new Set<string>();
    const result: unknown[] = [];
    for (const v of arr) {
      const key = typeof v + ':' + kodiStringify(v);
      if (!seen.has(key)) { seen.add(key); result.push(v); }
    }
    return result;
  });
  natives.set('flatten', (arr) => {
    if (!Array.isArray(arr)) return [];
    const result: unknown[] = [];
    for (const v of arr) {
      if (Array.isArray(v)) result.push(...v);
      else result.push(v);
    }
    return result;
  });
  natives.set('push', (arr, ...items) => Array.isArray(arr) ? [...arr, ...items] : [...items]);
  natives.set('concat', (...arrs) => {
    const result: unknown[] = [];
    for (const a of arrs) {
      if (!Array.isArray(a)) throw new Error('concat requires array arguments');
      result.push(...a);
    }
    return result;
  });

  // Object functions
  natives.set('keys', (obj) => isPlainObj(obj) ? Object.keys(obj as object).sort() : []);
  natives.set('values', (obj) => isPlainObj(obj) ? Object.keys(obj as object).sort().map(k => (obj as Record<string, unknown>)[k]) : []);
  natives.set('entries', (obj) => isPlainObj(obj) ? Object.keys(obj as object).sort().map(k => [k, (obj as Record<string, unknown>)[k]]) : []);
  natives.set('has', (coll, key) => {
    if (Array.isArray(coll)) return coll.some(v => kodiStringify(v) === kodiStringify(key) && typeof v === typeof key);
    if (isPlainObj(coll)) return Object.prototype.hasOwnProperty.call(coll, String(key));
    return false;
  });

  // Number parsing
  natives.set('parseInt', (val) => {
    const n = typeof val === 'string' ? parseFloat(val.trim()) : Number(val);
    if (isNaN(n)) throw new Error(`cannot parse '${val}' as integer`);
    return Math.trunc(n);
  });
  natives.set('parseFloat', (val) => {
    const n = typeof val === 'string' ? parseFloat(val.trim()) : Number(val);
    if (isNaN(n)) throw new Error(`cannot parse '${val}' as number`);
    return n;
  });

  // Regex
  natives.set('regexMatch', (str, pattern) => new RegExp(String(pattern)).test(String(str)));
  natives.set('regexReplace', (str, pattern, replacement) =>
    String(str).replace(new RegExp(String(pattern), 'g'), String(replacement)));

  // Type checking
  natives.set('typeOf', (val) => {
    if (val === null) return 'null';
    if (Array.isArray(val)) return 'array';
    return typeof val;
  });
  natives.set('isNull', (val) => val === null || val === undefined);
  natives.set('isNumber', (val) => typeof val === 'number');
  natives.set('isString', (val) => typeof val === 'string');
  natives.set('isBool', (val) => typeof val === 'boolean');

  // Crypto hash functions (Node.js via crypto; browsers fall back to a stub).
  natives.set('md5', (str) => nodeHash('md5', String(str)) ?? 'md5_not_supported_in_browser');
  natives.set('sha1', (str) => nodeHash('sha1', String(str)) ?? 'sha1_not_supported_in_browser');
  natives.set('sha256', (str) => nodeHash('sha256', String(str)) ?? 'sha256_not_supported_in_browser');

  registerDateNatives(natives);
  registerListNatives(natives);

  return natives;
}

// Backwards-compatible alias used within this module.
const stringify = kodiStringify;

// Lazily resolves Node's crypto module. Returns null in environments (e.g.
// browsers) where it is unavailable, so callers can fall back gracefully.
let nodeCryptoModule: { createHash?: (a: string) => { update: (d: string) => { digest: (e: string) => string } } } | null | undefined;
function nodeHash(algo: string, data: string): string | null {
  if (nodeCryptoModule === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      nodeCryptoModule = typeof require !== 'undefined' ? require('crypto') : null;
    } catch {
      nodeCryptoModule = null;
    }
  }
  if (nodeCryptoModule && nodeCryptoModule.createHash) {
    return nodeCryptoModule.createHash(algo).update(data).digest('hex');
  }
  return null;
}

// Shared singleton for built-in functions (memory optimization)
export const DEFAULT_NATIVES: ReadonlyMap<string, NativeFunction> = createNatives();
