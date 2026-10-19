// Value helpers shared by the natives and the interpreter: canonical form,
// equality, ordering, list arguments and dotted paths.

/**
 * Renders a value in canonical KodiScript form, shared with the interpreter so
 * output matches the Go and Kotlin implementations:
 * - integral numbers print without ".0" (JS Number.toString already does this)
 * - arrays as "[1, 2, 3]"; objects as "{a: 1, b: 2}" with keys sorted
 * - strings are not quoted (use jsonStringify for quoted output)
 */
export function kodiStringify(val: unknown): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) return '[' + val.map(kodiStringify).join(', ') + ']';
  if (typeof val === 'object') {
    const proto = Object.getPrototypeOf(val);
    if (proto === Object.prototype || proto === null) {
      const keys = Object.keys(val as object).sort();
      return '{' + keys.map(k => `${k}: ${kodiStringify((val as Record<string, unknown>)[k])}`).join(', ') + '}';
    }
  }
  return String(val);
}

export function isPlainObj(val: unknown): boolean {
  if (typeof val !== 'object' || val === null || Array.isArray(val)) return false;
  const proto = Object.getPrototypeOf(val);
  return proto === Object.prototype || proto === null;
}

/** Same names as the `typeOf` native; `undefined` counts as null. */
export function typeName(val: unknown): string {
  if (val === null || val === undefined) return 'null';
  if (Array.isArray(val)) return 'array';
  return typeof val;
}

/** Identifies a value for equality: its type and its canonical form (1 equals 1.0, not "1"). */
export function equalityKey(val: unknown): string {
  return typeName(val) + ':' + kodiStringify(val);
}

/** Orders two values: numbers numerically, anything else by canonical form (null first). */
export function compareValues(a: unknown, b: unknown): number {
  const aNull = a === null || a === undefined;
  const bNull = b === null || b === undefined;
  if (aNull && bNull) return 0;
  if (aNull) return -1;
  if (bNull) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0;
  const x = kodiStringify(a);
  const y = kodiStringify(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** Reads a list argument for the function `name`; null is an empty list, anything else is an error. */
export function listArg(name: string, val: unknown): unknown[] {
  if (val === null || val === undefined) return [];
  if (Array.isArray(val)) return val;
  throw new Error(`${name} requires an array as first argument`);
}

const LIST_INDEX = /^(0|[1-9][0-9]*)$/;

/**
 * Reads a dotted path: object keys, or list indexes written in digits. The empty
 * path is the value itself; a missing step gives null.
 */
export function atPath(val: unknown, path: string): unknown {
  if (path === '') return val;
  let current = val;
  for (const segment of path.split('.')) {
    if (Array.isArray(current)) {
      if (!LIST_INDEX.test(segment)) return null;
      const idx = Number(segment);
      if (idx >= current.length) return null;
      current = current[idx];
    } else if (isPlainObj(current)) {
      if (!Object.prototype.hasOwnProperty.call(current, segment)) return null;
      current = (current as Record<string, unknown>)[segment];
    } else {
      return null;
    }
    if (current === undefined) current = null;
  }
  return current;
}

/**
 * Builds an object from entries. A key such as "__proto__" or "constructor" comes
 * from script data and must stay an ordinary key.
 */
export function objectFrom(entries: Iterable<[string, unknown]>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    Object.defineProperty(out, key, { value, enumerable: true, writable: true, configurable: true });
  }
  return out;
}
