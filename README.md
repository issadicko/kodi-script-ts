# KodiScript

A lightweight, embeddable scripting language for JavaScript/TypeScript applications.

[![npm version](https://img.shields.io/npm/v/@issadicko/kodi-script)](https://www.npmjs.com/package/@issadicko/kodi-script)

📖 **Full Documentation**: [docs-kodiscript.dickode.net](https://docs-kodiscript.dickode.net/)

## Installation

```bash
npm install @issadicko/kodi-script
# or
yarn add @issadicko/kodi-script
# or
pnpm add @issadicko/kodi-script
```

## Usage

### Simple Execution

```typescript
import { KodiScript } from '@issadicko/kodi-script';

const result = KodiScript.run(`
  let name = "World"
  print("Hello " + name)
`);

console.log(result.output); // ['Hello World']
```

### Variable Injection

```typescript
const result = KodiScript.run(`
  let greeting = "Hello " + user.name
  let status = user?.active ?: "offline"
  print(greeting)
`, {
  user: { name: 'Alice', active: true }
});
```

### Builder Pattern

```typescript
const result = KodiScript.builder(`
  let greeting = customGreet("World")
  print(greeting)
`)
  .withVariable('version', '1.0')
  .registerFunction('customGreet', (name) => `Hello, ${name}!`)
  .execute();
```

## Features

- **Variables**: `let name = "value"`
- **Null-safety**: `user?.name`, `value ?: "default"`
- **Control flow**: `if/else`, `return`
- **Native functions**: String, Math, JSON, Crypto, Arrays
- **Extensible**: Register your own native functions
- **TypeScript support**: Full type definitions included

## 🔌 Extensibility

KodiScript is designed to be **extensible**. You can enrich the language by adding your own native functions, allowing scripts to interact with your system.

### Custom Functions

```typescript
const result = KodiScript.builder(`
  let greeting = greet("World")
  let price = calculatePrice(100, 0.2)
  print(greeting + " - Total: $" + price)
`)
  .registerFunction('greet', (name) => `Hello, ${name}!`)
  .registerFunction('calculatePrice', (amount, taxRate) => amount * (1 + taxRate))
  .execute();
```

### Express.js Integration

```typescript
import express from 'express';
import { KodiScript } from '@issadicko/kodi-script';

const app = express();

// Create a script engine with business functions
function createScriptEngine(context: Record<string, unknown>) {
  return KodiScript.builder('')
    .withVariables(context)
    .registerFunction('fetchUser', async (id) => {
      // Call your database
      return { id, name: 'Alice', tier: 'gold' };
    })
    .registerFunction('calculateDiscount', (tier, amount) => {
      const discounts = { gold: 0.2, silver: 0.1, bronze: 0.05 };
      return amount * (discounts[tier] || 0);
    })
    .registerFunction('sendEmail', (to, subject, body) => {
      // Send email via your service
      console.log(`Email sent to ${to}`);
      return true;
    });
}

app.post('/api/execute', (req, res) => {
  const { script, context } = req.body;
  const engine = createScriptEngine(context);
  const result = engine.withSource(script).execute();
  res.json(result);
});
```

This allows your users to write powerful scripts while you maintain control over exposed functionality.

## Native Functions

### String
`print`, `toString`, `toNumber`, `length`, `substring`, `toUpperCase`, `toLowerCase`, `trim`, `replace`, `split`, `join`, `contains`, `startsWith`, `endsWith`, `indexOf`

### Math
`abs`, `floor`, `ceil`, `round`, `min`, `max`, `pow`, `sqrt`, `sin`, `cos`, `tan`, `log`, `log10`, `exp`

### Random
`random`, `randomInt`, `randomUUID`

### JSON/Encoding
`jsonParse`, `jsonStringify`, `base64Encode`, `base64Decode`, `urlEncode`, `urlDecode`

### Arrays
`size`, `first`, `last`, `slice`, `reverse`, `sort`, `sortBy`

### Types
`typeOf`, `isNull`, `isNumber`, `isString`, `isBool`

### Crypto
`md5`, `sha1`, `sha256`

### Date/Time
`now`, `date`, `time`, `datetime`, `timestamp`, `formatDate`, `year`, `month`, `day`, `hour`, `minute`, `second`, `dayOfWeek`, `addDays`, `addHours`, `diffDays`

## Syntax

```javascript
// Variables
let name = "Kodi"
let version = 1.0

// Null-safety
let status = user?.active ?: "offline"

// Conditions
if (version > 1.0) {
  print("Modern version")
} else {
  print("Legacy version")
}

// Return
return "result"

// Arrays and Objects
let arr = [1, 2, 3]
let obj = { name: "Alice", age: 30 }
```

## Other Implementations

| Language | Package |
|----------|---------|  
| **Kotlin** | [Maven Central](https://central.sonatype.com/artifact/io.github.issadicko/kodi-script) |
| **Go** | [pkg.go.dev](https://pkg.go.dev/github.com/issadicko/kodi-script-go) |
| **Dart** | [pub.dev](https://pub.dev/packages/kodi_script) |

## License

MIT
