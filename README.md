# KodiScript

A lightweight, embeddable scripting language for JavaScript/TypeScript applications.

[![npm version](https://img.shields.io/npm/v/kodi-script)](https://www.npmjs.com/package/@issadicko/kodi-script)

## Installation

```bash
npm install kodi-script
# or
yarn add kodi-script
# or
pnpm add kodi-script
```

## Usage

### Simple Execution

```typescript
import { KodiScript } from 'kodi-script';

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
- **Custom functions**: Register your own functions
- **TypeScript support**: Full type definitions included

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

## License

MIT
