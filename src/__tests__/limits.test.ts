import { describe, test, expect } from 'vitest';
import { KodiScript, KodiScriptBuilder } from '../index';

describe('KodiScript Limits & Timeout', () => {
    test('simple script completes within timeout', () => {
        const result = KodiScript.builder(`
        let x = 1
        let y = 2
        x + y
      `).withTimeout(5000).execute();

        expect(result.errors).toEqual([]);
        expect(result.value).toBe(3);
    });

    test('long loop exceeds timeout', () => {
        const largeArray = Array.from({ length: 1000000 }, (_, i) => i);

        const start = Date.now();
        const result = KodiScript.builder(`
        let sum = 0
        for (i in arr) {
          sum = sum + i
        }
        sum
      `)
            .withVariable('arr', largeArray)
            .withTimeout(50) // 50ms timeout
            .execute();
        const elapsed = Date.now() - start;

        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('execution timeout');
        expect(elapsed).toBeLessThan(200);
    });

    test('operation limit exceeded', () => {
        const result = KodiScript.builder(`
        let i = 0
        let sum = 0
        // Infinite loop structure (if not for limit)
        for (x in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
            sum = sum + x
        }
        sum
      `)
            .withMaxOperations(5)
            .execute();

        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('max operations exceeded');
    });

    test('nested loops respect timeout', () => {
        const result = KodiScript.builder(`
        let count = 0
        for (i in [1, 2, 3]) {
          for (j in [1, 2, 3]) {
            count = count + 1
            // Simulated work
            for (k in [1, 2, 3, 4, 5]) {
               count = count + 1
            }
          }
        }
        count
      `).withTimeout(5000).execute();

        expect(result.errors).toEqual([]);
    });

    test('no timeout by default', () => {
        const result = KodiScript.builder(`
        let sum = 0
        for (i in [1, 2, 3, 4, 5]) {
          sum = sum + i
        }
        sum
      `).execute();

        expect(result.errors).toEqual([]);
    });
});
