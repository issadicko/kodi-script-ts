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
      expect(result.value).toBe('big');
    });
  });

  it('should handle for loops', () => {
    const result = KodiScript.run(`
        let sum = 0
        let numbers = [1, 2, 3, 4, 5]
        for (n in numbers) {
          sum = sum + n
        }
        print(sum)
      `);
    expect(result.output).toContain('15');
  });

  it('should handle for loop variable scope', () => {
    const result = KodiScript.run(`
        let n = 100
        let numbers = [1, 2]
        for (n in numbers) {
          print(n)
        }
        print(n)
      `);
    expect(result.output).toEqual(['1', '2', '100']);
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

    it('should handle date functions', () => {
      const result = KodiScript.run(`
        let ts = now()
        print(isNumber(ts))
        print(length(date()) == 10)
        print(contains(time(), ":"))
        print(year() >= 2024)
        print(month() >= 1)
        print(day() >= 1)
      `);
      expect(result.output).toEqual(['true', 'true', 'true', 'true', 'true', 'true']);
    });

    it('should handle date parsing and formatting', () => {
      const result = KodiScript.run(`
        let ts = timestamp("2024-12-25")
        let formatted = formatDate(ts, "DD/MM/YYYY")
        print(formatted)
        print(year(ts))
        print(month(ts))
        print(day(ts))
      `);
      expect(result.output[0]).toBe('25/12/2024');
      expect(result.output[1]).toBe('2024');
      expect(result.output[2]).toBe('12');
      expect(result.output[3]).toBe('25');
    });

    it('should handle date arithmetic', () => {
      const result = KodiScript.run(`
        let ts = timestamp("2024-01-01")
        let nextWeek = addDays(ts, 7)
        let nextHour = addHours(ts, 24)
        let diff = diffDays(ts, nextWeek)
        print(diff)
        print(day(nextWeek))
      `);
      expect(result.output[0]).toBe('7');
      expect(result.output[1]).toBe('8');
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

  describe('Higher-Order Array Functions', () => {
    it('should handle map function with inline fn', () => {
      const result = KodiScript.run(`
        let arr = [1, 2, 3]
        let doubled = map(arr, fn(x) { x * 2 })
        print(doubled[0])
        print(doubled[1])
        print(doubled[2])
      `);
      expect(result.output).toEqual(['2', '4', '6']);
    });

    it('should handle filter function with inline fn', () => {
      const result = KodiScript.run(`
        let arr = [1, 2, 3, 4, 5, 6]
        let big = filter(arr, fn(x) { x > 3 })
        print(size(big))
        print(big[0])
        print(big[1])
      `);
      expect(result.output).toEqual(['3', '4', '5']);
    });

    it('should handle reduce function with inline fn', () => {
      const result = KodiScript.run(`
        let arr = [1, 2, 3, 4]
        let sum = reduce(arr, fn(acc, x) { acc + x }, 0)
        print(sum)
      `);
      expect(result.output).toEqual(['10']);
    });

    it('should handle find function with inline fn', () => {
      const result = KodiScript.run(`
        let users = [{ name: "Alice", age: 25 }, { name: "Bob", age: 30 }]
        let bob = find(users, fn(u) { u.name == "Bob" })
        print(bob.age)
      `);
      expect(result.output).toEqual(['30']);
    });

    it('should handle findIndex function with inline fn', () => {
      const result = KodiScript.run(`
        let arr = [10, 20, 30, 40]
        let idx = findIndex(arr, fn(x) { x > 25 })
        print(idx)
      `);
      expect(result.output).toEqual(['2']);
    });
  });

  describe('String Utility Functions', () => {
    it('should handle padLeft function', () => {
      const result = KodiScript.run(`
        print(padLeft("5", 3, "0"))
        print(padLeft("abc", 6))
      `);
      expect(result.output).toEqual(['005', '   abc']);
    });

    it('should handle padRight function', () => {
      const result = KodiScript.run(`
        print(padRight("hi", 5, "!"))
        print(padRight("x", 4))
      `);
      expect(result.output).toEqual(['hi!!!', 'x   ']);
    });

    it('should handle repeat function', () => {
      const result = KodiScript.run(`
        print(repeat("ab", 3))
        print(repeat("x", 5))
      `);
      expect(result.output).toEqual(['ababab', 'xxxxx']);
    });
  });

  describe('silentPrint Option', () => {
    it('should capture output but not log to console when silentPrint is true', () => {
      const result = KodiScript.builder(`
        print("Hello")
        print("World")
      `).silentPrint(true).execute();

      expect(result.output).toEqual(['Hello', 'World']);
    });
  });
});
