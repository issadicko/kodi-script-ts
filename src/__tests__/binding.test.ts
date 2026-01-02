import { describe, test, expect } from 'vitest';
import { KodiScript } from '../index';

// Test classes
class Address {
    constructor(public city: string, public country: string) { }
}

class User {
    constructor(
        public name: string,
        public age: number,
        public address: Address
    ) { }

    sayHello(): string {
        return `Hello, I'm ${this.name}`;
    }

    getAge(): number {
        return this.age;
    }

    greet(greeting: string): string {
        return `${greeting}, ${this.name}!`;
    }

    getAddress(): Address {
        return this.address;
    }
}

class Calculator {
    add(a: number, b: number): number {
        return a + b;
    }

    multiply(x: number, y: number): number {
        return x * y;
    }
}

describe('Reflective Binding', () => {
    test('bind field access', () => {
        const user = new User('Alice', 30, new Address('Paris', 'France'));

        const result = KodiScript.builder('user.name')
            .bind('user', user)
            .execute();

        expect(result.result).toBe('Alice');
    });

    test('bind method call', () => {
        const user = new User('Bob', 25, new Address('London', 'UK'));

        const result = KodiScript.builder('user.sayHello()')
            .bind('user', user)
            .execute();

        expect(result.result).toBe("Hello, I'm Bob");
    });

    test('bind method with arguments', () => {
        const user = new User('Charlie', 28, new Address('Berlin', 'Germany'));

        const result = KodiScript.builder('user.greet("Hi")')
            .bind('user', user)
            .execute();

        expect(result.result).toBe("Hi, Charlie!");
    });

    test('bind nested objects', () => {
        const user = new User('David', 35, new Address('Tokyo', 'Japan'));

        const result = KodiScript.builder('user.address.city')
            .bind('user', user)
            .execute();

        expect(result.result).toBe('Tokyo');
    });

    test('bind method chaining', () => {
        const user = new User('Emily', 32, new Address('Madrid', 'Spain'));

        const result = KodiScript.builder('user.getAddress().city')
            .bind('user', user)
            .execute();

        expect(result.result).toBe('Madrid');
    });

    test('bind numeric operations', () => {
        const calc = new Calculator();

        const result = KodiScript.builder('calc.add(10, 20)')
            .bind('calc', calc)
            .execute();

        expect(result.result).toBe(30);
    });

    test('bind multiple objects', () => {
        const user = new User('Frank', 40, new Address('Rome', 'Italy'));
        const calc = new Calculator();

        const script = `
      let greeting = user.sayHello()
      let sum = calc.add(5, 3)
      greeting + " " + sum
    `;

        const result = KodiScript.builder(script)
            .bind('user', user)
            .bind('calc', calc)
            .execute();

        expect(result.result).toBe("Hello, I'm Frank 8");
    });

    test('bind with variables', () => {
        const calc = new Calculator();

        const script = `
      let x = 10
      let y = 5
      calc.add(x, y)
    `;

        const result = KodiScript.builder(script)
            .bind('calc', calc)
            .execute();

        expect(result.result).toBe(15);
    });

    test('bind in loop', () => {
        const calc = new Calculator();

        const script = `
      let numbers = [1, 2, 3, 4, 5]
      let sum = 0
      for (n in numbers) {
        sum = calc.add(sum, n)
      }
      sum
    `;

        const result = KodiScript.builder(script)
            .bind('calc', calc)
            .execute();

        expect(result.result).toBe(15);
    });
});
