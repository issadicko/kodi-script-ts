import { describe, it, expect } from 'vitest';
import { KodiScript } from './index';

describe('KodiScript', () => {
  describe('Variables', () => {
    it('should declare and use variables', () => {
      const result = KodiScript.run(`
        let name = "World"
        let greeting = "Hello " + name
        print(greeting)
      `);
      expect(result.output).toContain('Hello World');
    });

    it('should handle number variables', () => {
      const result = KodiScript.run(`
        let x = 10
        let y = 20
        print(x + y)
      `);
      expect(result.output).toContain('30');
    });
  });

  describe('Expressions', () => {
    it('should evaluate arithmetic expressions', () => {
      const result = KodiScript.run(`print(2 + 3 * 4)`);
      expect(result.output).toContain('14');
    });

    it('should handle string concatenation', () => {
      const result = KodiScript.run(`print("Hello" + " " + "World")`);
      expect(result.output).toContain('Hello World');
    });

    it('should handle comparison operators', () => {
      const result = KodiScript.run(`
        print(5 > 3)
        print(5 < 3)
        print(5 == 5)
        print(5 != 3)
      `);
      expect(result.output).toEqual(['true', 'false', 'true', 'true']);
    });
  });

  describe('Null Safety', () => {
    it('should handle safe member access', () => {
      const result = KodiScript.run(`
        let user = null
        let name = user?.name
        print(name)
      `);
      expect(result.output).toContain('null');
    });

    it('should handle elvis operator', () => {
      const result = KodiScript.run(`
        let value = null
        let result = value ?: "default"
        print(result)
      `);
      expect(result.output).toContain('default');
    });

    it('should handle safe navigation with injected variables', () => {
      const result = KodiScript.run(`
        let name = user?.name ?: "Anonymous"
        print(name)
      `, { user: { name: 'Alice' } });
      expect(result.output).toContain('Alice');
    });
  });

  describe('Control Flow', () => {
    it('should handle if statements', () => {
      const result = KodiScript.run(`
        let x = 10
        if (x > 5) {
          print("big")
        } else {
          print("small")
        }
      `);
      expect(result.output).toContain('big');
    });

    it('should handle return statements', () => {
      const result = KodiScript.run(`
        let x = 10
        if (x > 5) {
          return "big"
        }
        return "small"
      `);
      expect(result.result).toBe('big');
    });
  });

  describe('Native Functions', () => {
    it('should handle string functions', () => {
      const result = KodiScript.run(`
        print(toUpperCase("hello"))
        print(length("hello"))
        print(substring("hello", 0, 2))
      `);
      expect(result.output).toEqual(['HELLO', '5', 'he']);
    });

    it('should handle math functions', () => {
      const result = KodiScript.run(`
        print(abs(-5))
        print(floor(3.7))
        print(ceil(3.2))
        print(max(1, 5, 3))
      `);
      expect(result.output).toEqual(['5', '3', '4', '5']);
    });

    it('should handle array functions', () => {
      const result = KodiScript.run(`
        let arr = [3, 1, 2]
        print(size(arr))
        print(first(arr))
        print(last(arr))
      `);
      expect(result.output).toEqual(['3', '3', '2']);
    });

    it('should handle JSON functions', () => {
      const result = KodiScript.run(`
        let obj = { name: "Alice", age: 30 }
        let json = jsonStringify(obj)
        print(json)
      `);
      expect(result.output[0]).toContain('Alice');
    });
  });

  describe('Variable Injection', () => {
    it('should access injected variables', () => {
      const result = KodiScript.run(`
        print(user.name)
        print(user.age)
      `, {
        user: { name: 'Bob', age: 25 }
      });
      expect(result.output).toEqual(['Bob', '25']);
    });
  });

  describe('Custom Functions', () => {
    it('should allow registering custom functions', () => {
      const result = KodiScript.builder(`
        let greeting = customGreet("World")
        print(greeting)
      `)
        .registerFunction('customGreet', (name) => `Hello, ${name}!`)
        .execute();
      
      expect(result.output).toContain('Hello, World!');
    });
  });

  describe('Arrays and Objects', () => {
    it('should handle array literals', () => {
      const result = KodiScript.run(`
        let arr = [1, 2, 3]
        print(arr[0])
        print(arr[2])
      `);
      expect(result.output).toEqual(['1', '3']);
    });

    it('should handle object literals', () => {
      const result = KodiScript.run(`
        let obj = { name: "Alice", age: 30 }
        print(obj.name)
        print(obj.age)
      `);
      expect(result.output).toEqual(['Alice', '30']);
    });
  });
});
