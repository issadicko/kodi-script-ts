import { describe, it } from 'vitest';
import { KodiScript } from './index';

describe('Benchmarks', () => {
    it('benchmark parsing performance (no cache)', () => {
        const script = `
      let factorial = fn(n) {
        if (n <= 1) { return 1 }
        return n * factorial(n - 1)
      }
      print(factorial(10))
    `;

        const iterations = 1000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
            KodiScript.builder(script).withCache(false).silentPrint().execute();
        }

        const time = performance.now() - start;
        console.log(`Parsing ${iterations} iterations (no cache): ${time.toFixed(2)}ms (${(time / iterations).toFixed(3)}ms per iteration)`);
    });

    it('benchmark execution performance (with cache)', () => {
        const script = `
      let sum = 0
      for (i in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        sum = sum + i
      }
      print(sum)
    `;

        const iterations = 10000;
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
            KodiScript.builder(script).silentPrint().execute();
        }

        const time = performance.now() - start;
        console.log(`Execution ${iterations} iterations (with cache): ${time.toFixed(2)}ms (${(time / iterations).toFixed(3)}ms per iteration)`);
    });

    it('benchmark cache effectiveness', () => {
        const script = `
      let add = fn(a, b) { return a + b }
      print(add(5, 7))
    `;

        const iterations = 5000;

        // Warm up
        for (let i = 0; i < 100; i++) {
            KodiScript.builder(script).silentPrint().execute();
        }

        // With cache
        const cachedStart = performance.now();
        for (let i = 0; i < iterations; i++) {
            KodiScript.builder(script).silentPrint().execute();
        }
        const cachedTime = performance.now() - cachedStart;

        // Without cache
        const uncachedStart = performance.now();
        for (let i = 0; i < iterations; i++) {
            KodiScript.builder(script).withCache(false).silentPrint().execute();
        }
        const uncachedTime = performance.now() - uncachedStart;

        console.log(`With cache: ${cachedTime.toFixed(2)}ms (${(cachedTime / iterations).toFixed(3)}ms per iteration)`);
        console.log(`Without cache: ${uncachedTime.toFixed(2)}ms (${(uncachedTime / iterations).toFixed(3)}ms per iteration)`);
        console.log(`Speedup: ${(uncachedTime / cachedTime).toFixed(2)}x`);
    });
});
