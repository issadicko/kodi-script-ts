import { describe, it, expect } from 'vitest';
import { KodiScript } from './index';

/** Regression tests for the language features brought to parity with Go/Kotlin. */
function out(src: string): string[] {
  const r = KodiScript.builder(src).silentPrint(true).execute();
  expect(r.errors).toEqual([]);
  return r.output;
}

describe('Feature parity', () => {
  it('break / continue / compound assignment / inc-dec', () => {
    expect(out('let s=0\nfor (i in [1,2,3,4,5]) {\n if (i==3) { break }\n s = s + i\n}\nprint(s)')).toEqual(['3']);
    expect(out('let s=0\nfor (i in [1,2,3,4]) {\n if (i==2) { continue }\n s += i\n}\nprint(s)')).toEqual(['8']);
    expect(out('let i=0\nwhile (true) {\n i++\n if (i>=5) { break }\n}\nprint(i)')).toEqual(['5']);
    expect(out('let x=10\nx += 5\nx -= 2\nx *= 2\nx /= 13\nprint(x)')).toEqual(['2']);
    expect(out('let n=5\nn++\nn++\nn--\nprint(n)')).toEqual(['6']);
  });

  it('method-call syntax with chaining', () => {
    expect(out('print("hello".toUpperCase())')).toEqual(['HELLO']);
    expect(out('print("  Hi ".trim().toLowerCase())')).toEqual(['hi']);
    expect(out('print([1,2,3].size())')).toEqual(['3']);
    expect(out('print([1,2,3].map(fn(x){ x*2 }))')).toEqual(['[2, 4, 6]']);
    expect(out('print([3,1,2,1].unique().sum())')).toEqual(['6']);
  });

  it('builtins are overridable', () => {
    const r = KodiScript.builder('let print = fn(x){ x }\nprint("hidden")').silentPrint(true).execute();
    expect(r.output).toEqual([]);
  });

  it('named functions, recursion, ternary, block comments', () => {
    expect(out('fn fact(n) {\n if (n <= 1) { return 1 }\n return n * fact(n - 1)\n}\nprint(fact(5))')).toEqual(['120']);
    expect(out('let n = 2\nprint(n == 1 ? "one" : n == 2 ? "two" : "many")')).toEqual(['two']);
    expect(out('let x = 5 /* inline */ + 3\nprint(x)')).toEqual(['8']);
  });

  it('try / catch', () => {
    expect(out('let r = "none"\ntry {\n let x = boom\n} catch (e) {\n r = "caught"\n}\nprint(r)\nprint("after")')).toEqual(['caught', 'after']);
    expect(out('fn safeDiv(a, b) {\n try {\n  return a / b\n } catch (e) {\n  return -1\n }\n}\nprint(safeDiv(10, 2))\nprint(safeDiv(10, 0))')).toEqual(['5', '-1']);
  });

  it('stdlib: some/every/flatMap, regex, range/sum/keys, parseInt', () => {
    expect(out('print(some([1,2,3], fn(x){ x > 2 }))')).toEqual(['true']);
    expect(out('print(every([2,4], fn(x){ x % 2 == 0 }))')).toEqual(['true']);
    expect(out('print(flatMap([1,2], fn(x){ [x, x] }))')).toEqual(['[1, 1, 2, 2]']);
    expect(out('print(regexReplace("a1b2", "[0-9]", "X"))')).toEqual(['aXbX']);
    expect(out('print(sum([1,2,3,4]))')).toEqual(['10']);
    expect(out('print(keys({b:2, a:1, c:3}))')).toEqual(['[a, b, c]']);
    expect(out('print(parseInt("3.9"))')).toEqual(['3']);
  });

  it('spread and destructuring', () => {
    expect(out('let a = [1,2]\nprint([...a, 3])')).toEqual(['[1, 2, 3]']);
    expect(out('fn add(x,y,z){ return x+y+z }\nprint(add(...[1,2,3]))')).toEqual(['6']);
    expect(out('let [a, b] = [10, 20]\nprint(a)\nprint(b)')).toEqual(['10', '20']);
    expect(out('let {name, age} = {name: "Bob", age: 25}\nprint(name)\nprint(age)')).toEqual(['Bob', '25']);
  });

  it('canonical formatting matches Go/Kotlin', () => {
    expect(out('print(42)\nprint(3.5)\nprint([1, [2, 3]])\nprint({b: 2, a: 1})')).toEqual(['42', '3.5', '[1, [2, 3]]', '{a: 1, b: 2}']);
  });

  it('output sink receives and captures', () => {
    const sink: string[] = [];
    const r = KodiScript.builder('print("a")\nprint("b")').withOutput(s => sink.push(s)).execute();
    expect(sink).toEqual(['a', 'b']);
    expect(r.output).toEqual(['a', 'b']);
  });

  it('typed error kinds', () => {
    expect(KodiScript.builder('while (true) { let x = 1 }').withMaxOperations(100).execute().errorKind).toBe('max_operations');
    expect(KodiScript.builder('undefinedVar + 1').execute().errorKind).toBe('runtime');
    expect(KodiScript.builder('let x = 5').execute().errorKind).toBe('none');
  });

  it('recursion guard stops unbounded recursion', () => {
    const r = KodiScript.builder('fn loop() {\n return loop()\n}\nloop()').execute();
    expect(r.errors.length).toBeGreaterThan(0);
  });
});
