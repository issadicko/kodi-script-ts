import { describe, it, expect } from 'vitest';
import { KodiScript } from './index';

/** Literals can be laid out one element per line, with a trailing comma, in arrays, objects and calls. */
function run(src: string) {
  const r = KodiScript.builder(src).silentPrint(true).execute();
  expect(r.errors).toEqual([]);
  return r;
}

describe('Multi-line literals', () => {
  it('accepts a trailing comma in arrays, objects and call arguments', () => {
    expect(run('let t = [\n  1,\n  2,\n  3,\n]\nprint(t[2])').output).toEqual(['3']);
    expect(run('let o = {\n  "a": 1,\n  "b": 2,\n}\nprint(o.a + o.b)').output).toEqual(['3']);
    expect(run('let f = fn(a, b) { return a + b }\nprint(f(\n  1,\n  2,\n))').output).toEqual(['3']);
    expect(run('let o = {\n  "a": [\n    1,\n    {"b": 2}\n  ]\n}\nprint(o.a[1].b)').output).toEqual(['2']);
  });

  it('still refuses a missing separator', () => {
    const r = KodiScript.builder('let t = [1 2]').silentPrint(true).execute();
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('reads an object literal at statement start as a value', () => {
    expect(run('let x = 1\n{\n  "a": x,\n  "b": [\n    x\n  ]\n}').value).toEqual({ a: 1, b: [1] });
    expect(run('{ name: "kodi" }').value).toEqual({ name: 'kodi' });
    expect(run('{}').value).toEqual({});
  });

  it('still reads a block at statement start', () => {
    expect(run('let r = 0\n{\n  r = 5\n}\nprint(r)').output).toEqual(['5']);
  });
});
