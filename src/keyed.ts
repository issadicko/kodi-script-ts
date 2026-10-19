import { atPath, compareValues, equalityKey, kodiStringify, listArg, objectFrom } from './values';

// Builtins that group or aggregate a list by a key. The key is a dotted path
// read on each item, or a function called as fn(item, index); they live with
// map and filter because the function form calls back into the script.

/** What the builtins need from the interpreter. */
export interface KeyedHost {
  isCallable(value: unknown): boolean;
  call(fn: unknown, args: unknown[]): unknown;
  isTruthy(value: unknown): boolean;
}

type KeyedBuiltin = (args: unknown[], host: KeyedHost) => unknown;

// A list with the key of each item, computed once.
interface Keyed {
  items: unknown[];
  keys: unknown[];
}

function keyedList(name: string, args: unknown[], host: KeyedHost): Keyed {
  if (args.length !== 2) throw new Error(`${name} requires 2 arguments: array and key (path or function)`);
  const items = listArg(name, args[0]);
  const key = args[1];
  let keyOf: (item: unknown, index: number) => unknown;
  if (typeof key === 'string') {
    keyOf = item => atPath(item, key);
  } else if (host.isCallable(key)) {
    keyOf = (item, index) => host.call(key, [item, index]);
  } else {
    throw new Error(`${name} requires a path string or a function as key`);
  }
  return { items, keys: items.map(keyOf) };
}

function isNullish(value: unknown): boolean {
  return value === null || value === undefined;
}

function groupBy(args: unknown[], host: KeyedHost): unknown {
  const { items, keys } = keyedList('groupBy', args, host);
  const groups = new Map<string, unknown[]>();
  items.forEach((item, i) => {
    const g = kodiStringify(keys[i]);
    const group = groups.get(g);
    if (group) group.push(item);
    else groups.set(g, [item]);
  });
  return objectFrom(groups);
}

function countBy(args: unknown[], host: KeyedHost): unknown {
  const { items, keys } = keyedList('countBy', args, host);
  const counts = new Map<string, number>();
  items.forEach((_, i) => {
    const g = kodiStringify(keys[i]);
    counts.set(g, (counts.get(g) ?? 0) + 1);
  });
  return objectFrom(counts);
}

function indexBy(args: unknown[], host: KeyedHost): unknown {
  const { items, keys } = keyedList('indexBy', args, host);
  const index = new Map<string, unknown>();
  items.forEach((item, i) => index.set(kodiStringify(keys[i]), item));
  return objectFrom(index);
}

function uniqueBy(args: unknown[], host: KeyedHost): unknown {
  const { items, keys } = keyedList('uniqueBy', args, host);
  const seen = new Set<string>();
  const result: unknown[] = [];
  items.forEach((item, i) => {
    const k = equalityKey(keys[i]);
    if (!seen.has(k)) {
      seen.add(k);
      result.push(item);
    }
  });
  return result;
}

function sumBy(args: unknown[], host: KeyedHost): unknown {
  const { keys } = keyedList('sumBy', args, host);
  let total = 0;
  for (const key of keys) {
    if (isNullish(key)) continue;
    if (typeof key !== 'number') throw new Error(`sumBy requires numeric keys, got ${kodiStringify(key)}`);
    total += key;
  }
  return total;
}

// The first item wins on ties; null keys are skipped.
function extremeBy(name: string, wanted: 1 | -1): KeyedBuiltin {
  return (args, host) => {
    const { items, keys } = keyedList(name, args, host);
    let best = -1;
    keys.forEach((key, i) => {
      if (isNullish(key)) return;
      if (best < 0 || compareValues(key, keys[best]) * wanted > 0) best = i;
    });
    return best < 0 ? null : items[best];
  };
}

function partition(args: unknown[], host: KeyedHost): unknown {
  const { items, keys } = keyedList('partition', args, host);
  const yes: unknown[] = [];
  const no: unknown[] = [];
  items.forEach((item, i) => (host.isTruthy(keys[i]) ? yes : no).push(item));
  return [yes, no];
}

export const KEYED_BUILTINS: ReadonlyMap<string, KeyedBuiltin> = new Map<string, KeyedBuiltin>([
  ['groupBy', groupBy],
  ['countBy', countBy],
  ['indexBy', indexBy],
  ['uniqueBy', uniqueBy],
  ['sumBy', sumBy],
  ['minBy', extremeBy('minBy', -1)],
  ['maxBy', extremeBy('maxBy', 1)],
  ['partition', partition],
]);
