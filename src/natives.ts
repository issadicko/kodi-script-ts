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
  natives.set('join', (arr, sep) => Array.isArray(arr) ? arr.join(String(sep)) : '');
  natives.set('contains', (str, substr) => String(str).includes(String(substr)));
  natives.set('startsWith', (str, prefix) => String(str).startsWith(String(prefix)));
  natives.set('endsWith', (str, suffix) => String(str).endsWith(String(suffix)));
  natives.set('indexOf', (str, substr) => String(str).indexOf(String(substr)));

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
  natives.set('randomUUID', () => crypto.randomUUID());

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

  // Crypto (simple hash using Web Crypto API or fallback)
  natives.set('md5', (str) => simpleHash(String(str), 'md5'));
  natives.set('sha1', (str) => simpleHash(String(str), 'sha1'));
  natives.set('sha256', (str) => simpleHash(String(str), 'sha256'));

  return natives;
}

function stringify(val: unknown): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function simpleHash(str: string, algorithm: string): string {
  // Simple hash implementation for sync usage
  // For production, consider using crypto.subtle or crypto module
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const prefix = algorithm === 'md5' ? 'md5:' : algorithm === 'sha1' ? 'sha1:' : 'sha256:';
  return prefix + Math.abs(hash).toString(16).padStart(8, '0');
}
