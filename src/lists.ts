import type { NativeFunction } from './natives';
import { atPath, equalityKey, kodiStringify, listArg, objectFrom } from './values';

// ============ List utilities ============
//
// A list argument may be null, which behaves as an empty list; any other
// non-list value is an error. Two values are equal when they have the same
// type and the same canonical form, so 1 equals 1.0 but not "1".

function keySet(list: unknown[]): Set<string> {
  return new Set(list.map(equalityKey));
}

function twoLists(name: string, args: unknown[]): [unknown[], unknown[]] {
  if (args.length !== 2) throw new Error(`${name} requires 2 arguments (array, array)`);
  const a = listArg(name, args[0]);
  if (args[1] !== null && args[1] !== undefined && !Array.isArray(args[1])) {
    throw new Error(`${name} requires an array as second argument`);
  }
  return [a, listArg(name, args[1])];
}

export function registerListNatives(natives: Map<string, NativeFunction>): void {
  natives.set('chunk', (...args) => {
    if (args.length !== 2) throw new Error('chunk requires 2 arguments (array, size)');
    const list = listArg('chunk', args[0]);
    const size = typeof args[1] === 'number' ? Math.trunc(args[1]) : NaN;
    if (!(size >= 1)) throw new Error('chunk requires a size of at least 1');
    const result: unknown[][] = [];
    for (let start = 0; start < list.length; start += size) {
      result.push(list.slice(start, start + size));
    }
    return result;
  });

  natives.set('compact', (...args) => {
    if (args.length !== 1) throw new Error('compact requires 1 argument (array)');
    return listArg('compact', args[0]).filter(item => item !== null && item !== undefined);
  });

  natives.set('pluck', (...args) => {
    if (args.length !== 2) throw new Error('pluck requires 2 arguments (array, path)');
    const list = listArg('pluck', args[0]);
    const path = args[1];
    if (typeof path !== 'string') throw new Error('pluck requires a string path as second argument');
    return list.map(item => atPath(item, path));
  });

  natives.set('zip', (...args) => {
    const lists = args.map(a => listArg('zip', a));
    if (lists.length === 0) return [];
    const shortest = Math.min(...lists.map(l => l.length));
    const result: unknown[][] = [];
    for (let row = 0; row < shortest; row++) {
      result.push(lists.map(l => l[row]));
    }
    return result;
  });

  natives.set('fromEntries', (...args) => {
    if (args.length !== 1) throw new Error('fromEntries requires 1 argument (array of pairs)');
    const list = listArg('fromEntries', args[0]);
    const entries = new Map<string, unknown>();
    for (const item of list) {
      if (!Array.isArray(item) || item.length < 2) {
        throw new Error('fromEntries requires each element to be a [key, value] pair');
      }
      entries.set(kodiStringify(item[0]), item[1]);
    }
    return objectFrom(entries);
  });

  natives.set('difference', (...args) => {
    const [a, b] = twoLists('difference', args);
    const excluded = keySet(b);
    return a.filter(item => !excluded.has(equalityKey(item)));
  });

  natives.set('intersection', (...args) => {
    const [a, b] = twoLists('intersection', args);
    const kept = keySet(b);
    const seen = new Set<string>();
    const result: unknown[] = [];
    for (const item of a) {
      const k = equalityKey(item);
      if (kept.has(k) && !seen.has(k)) {
        seen.add(k);
        result.push(item);
      }
    }
    return result;
  });

  natives.set('union', (...args) => {
    const seen = new Set<string>();
    const result: unknown[] = [];
    args.forEach((a, i) => {
      if (i > 0 && a !== null && a !== undefined && !Array.isArray(a)) {
        throw new Error('union requires array arguments');
      }
      for (const item of listArg('union', a)) {
        const k = equalityKey(item);
        if (!seen.has(k)) {
          seen.add(k);
          result.push(item);
        }
      }
    });
    return result;
  });
}
