import { describe, it, expect } from 'vitest';
import { KodiScript } from './index';

function value(expr: string, vars?: Record<string, unknown>): unknown {
  const r = KodiScript.builder(`return ${expr}`).withVariables(vars ?? {}).silentPrint(true).execute();
  expect(r.errors).toEqual([]);
  return r.value;
}

function fails(expr: string): string {
  const r = KodiScript.builder(`return ${expr}`).silentPrint(true).execute();
  expect(r.errors.length).toBe(1);
  return r.errors[0];
}

describe('List natives', () => {
  it('treats null as an empty list and rejects anything else', () => {
    expect(value('compact(null)')).toEqual([]);
    expect(value('pluck(null, "a")')).toEqual([]);
    expect(value('difference(null, [1])')).toEqual([]);
    expect(value('difference([1], null)')).toEqual([1]);
    expect(value('union(null, [1], null)')).toEqual([1]);
    expect(value('zip(null, [1])')).toEqual([]);
    expect(fails('chunk({}, 2)')).toBe('chunk requires an array as first argument');
    expect(fails('difference([1], "x")')).toBe('difference requires an array as second argument');
    expect(fails('union([1], 2)')).toBe('union requires array arguments');
    expect(fails('zip([1], 2)')).toBe('zip requires an array as first argument');
    expect(fails('pluck([1], 2)')).toBe('pluck requires a string path as second argument');
  });

  it('truncates the chunk size and requires at least 1', () => {
    expect(value('chunk([1, 2, 3], 2.9)')).toEqual([[1, 2], [3]]);
    expect(value('chunk([1, 2], 10)')).toEqual([[1, 2]]);
    expect(fails('chunk([1], 0.9)')).toBe('chunk requires a size of at least 1');
    expect(fails('chunk([1], "2")')).toBe('chunk requires a size of at least 1');
    expect(fails('chunk([1], null)')).toBe('chunk requires a size of at least 1');
  });

  it('reads dotted paths without touching the prototype', () => {
    const data = { rows: [{ a: { b: [10, 20] } }, { a: null }, 'x'] };
    expect(value('pluck(rows, "a.b.1")', data)).toEqual([20, null, null]);
    expect(value('pluck(rows, "a.b.01")', data)).toEqual([null, null, null]);
    expect(value('pluck(rows, "a.b.-1")', data)).toEqual([null, null, null]);
    expect(value('pluck(rows, "a.b.2")', data)).toEqual([null, null, null]);
    expect(value('pluck(rows, "a.constructor")', data)).toEqual([null, null, null]);
    expect(value('pluck(rows, "length")', data)).toEqual([null, null, null]);
    expect(value('pluck(rows, "")', data)).toEqual(data.rows);
  });

  it('compares by type and canonical form', () => {
    expect(value('difference([1, "1", true, null], [1.0])')).toEqual(['1', true, null]);
    expect(value('intersection([[1, 2], {a: 1}, "x"], [{a: 1}, [1, 2]])')).toEqual([[1, 2], { a: 1 }]);
    expect(value('union([null], [null, 0])')).toEqual([null, 0]);
    expect(value('union()')).toEqual([]);
  });

  it('keeps the order and the duplicates the spec describes', () => {
    expect(value('difference([3, 1, 3, 2], [2])')).toEqual([3, 1, 3]);
    expect(value('intersection([3, 1, 3, 2], [2, 3, 3])')).toEqual([3, 2]);
    expect(value('union([3, 1], [1, 2], [3, 4])')).toEqual([3, 1, 2, 4]);
  });

  it('builds objects from pairs with canonical keys', () => {
    expect(value('fromEntries([[1, "a"], [true, "b"], [null, "c"], [[1], "d"]])'))
      .toEqual({ '1': 'a', 'true': 'b', 'null': 'c', '[1]': 'd' });
    expect(value('fromEntries([["a", 1, "ignored"]])')).toEqual({ a: 1 });
    expect(Object.keys(value('fromEntries([["__proto__", 1]])') as object)).toEqual(['__proto__']);
    expect(fails('fromEntries([1])')).toBe('fromEntries requires each element to be a [key, value] pair');
    expect(value('fromEntries(null)')).toEqual({});
  });

  it('does not modify its arguments', () => {
    const list = [3, null, 1];
    expect(value('compact(l)', { l: list })).toEqual([3, 1]);
    expect(value('chunk(l, 2)', { l: list })).toEqual([[3, null], [1]]);
    expect(list).toEqual([3, null, 1]);
  });

  it('works with method-call syntax', () => {
    expect(value('[[1, 2], [3]].zip([9, 8]).size()')).toBe(2);
    expect(value('[1, null, 2].compact().chunk(1)')).toEqual([[1], [2]]);
  });
});

describe('Keyed builtins', () => {
  const sales = [
    { region: 'Centre', amount: 5, tags: ['a'] },
    { region: 'Nord', amount: 2.5, tags: [] },
    { region: 'Centre', amount: 7, tags: ['b'] },
  ];

  it('accepts a path or a function called with the item and its index', () => {
    expect(value('groupBy(s, "region")', { s: sales })).toEqual({ Centre: [sales[0], sales[2]], Nord: [sales[1]] });
    expect(value('countBy(s, fn(v, i) { return i % 2 })', { s: sales })).toEqual({ '0': 2, '1': 1 });
    expect(value('indexBy(s, "tags.0")', { s: sales })).toEqual({ a: sales[0], null: sales[1], b: sales[2] });
    expect(value('sumBy(s, "amount")', { s: sales })).toBe(14.5);
    expect(value('size(s.groupBy(fn(v) { return v.region == "Centre" })["true"])', { s: sales })).toBe(2);
  });

  it('rejects a key that is neither a path nor a function, even on an empty list', () => {
    expect(fails('groupBy([], 3)')).toBe('groupBy requires a path string or a function as key');
    expect(fails('minBy([1], null)')).toBe('minBy requires a path string or a function as key');
    expect(fails('groupBy([1])')).toBe('groupBy requires 2 arguments: array and key (path or function)');
    expect(fails('uniqueBy("abc", "x")')).toBe('uniqueBy requires an array as first argument');
    expect(fails('sumBy([{a: "x"}], "a")')).toBe('sumBy requires numeric keys, got x');
  });

  it('keeps group keys that look like object members', () => {
    const rows = [{ k: 'constructor' }, { k: '__proto__' }, { k: 'toString' }, { k: 'constructor' }];
    const groups = value('groupBy(r, "k")', { r: rows }) as Record<string, unknown[]>;
    expect(Object.keys(groups).sort()).toEqual(['__proto__', 'constructor', 'toString']);
    expect(groups['constructor']).toEqual([rows[0], rows[3]]);
    expect(value('countBy(r, "k").constructor', { r: rows })).toBe(2);
  });

  it('uses the canonical text as group key', () => {
    const rows = [{ k: 1 }, { k: 1.0 }, { k: '1' }, { k: null }, {}, { k: true }];
    expect(value('countBy(r, "k")', { r: rows })).toEqual({ '1': 3, 'null': 2, 'true': 1 });
    expect(value('size(uniqueBy(r, "k"))', { r: rows })).toBe(4);
  });

  it('takes the first item on ties and skips null keys', () => {
    const rows = [{ id: 'a', n: null }, { id: 'b', n: 3 }, { id: 'c', n: 3 }, { id: 'd', n: 1 }, { id: 'e', n: 1 }];
    expect(value('maxBy(r, "n").id', { r: rows })).toBe('b');
    expect(value('minBy(r, "n").id', { r: rows })).toBe('d');
    expect(value('maxBy(r, "missing")', { r: rows })).toBeNull();
    expect(value('maxBy(["b", "a", "c"], "")')).toBe('c');
    expect(value('minBy([10, 9, "8"], "")')).toBe('8');
  });

  it('keeps the last item per key in indexBy', () => {
    const rows = [{ k: 'x', v: 1 }, { k: 'x', v: 2 }];
    expect(value('indexBy(r, "k").x.v', { r: rows })).toBe(2);
  });

  it('only treats null and false as false when partitioning', () => {
    expect(value('partition([0, "", false, null, [], 1], "")')).toEqual([[0, '', [], 1], [false, null]]);
  });

  it('lets a script binding or a registered function override the builtin', () => {
    const r = KodiScript.builder('let groupBy = fn(l, k) { return "mine" }\nreturn groupBy([1], "x")').silentPrint(true).execute();
    expect(r.value).toBe('mine');
    const custom = KodiScript.builder('return countBy([1], "x")').registerFunction('countBy', () => 'host').silentPrint(true).execute();
    expect(custom.value).toBe('host');
  });
});
