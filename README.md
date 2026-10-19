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
- **Control flow**: `if/else`, `for...in`, `while`, `return`
- **Native functions**: String, Math, JSON, Arrays, Date/Time
- **Extensible**: Register your own native functions
- **TypeScript support**: Full type definitions included
- **Browser compatible**: Works in both Node.js and browser environments

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

### Lists
Every list function takes a list as first argument, where `null` behaves as an empty list and any other
value raises an error. Arguments are never modified; each function returns a new list or object.

| Function | Result |
|---|---|
| `chunk(list, size)` | consecutive lists of `size` elements (truncated, at least 1), the last one possibly shorter |
| `compact(list)` | the list without its `null` elements |
| `pluck(list, path)` | the value at `path` for each element |
| `zip(list1, list2, …)` | `[[a0, b0, …], [a1, b1, …], …]`, as long as the shortest list; `[]` without argument |
| `fromEntries(pairs)` | object from `[[key, value], …]`; keys are converted with `toString`, a later pair wins |
| `difference(a, b)` | elements of `a` not in `b`, in order, duplicates kept |
| `intersection(a, b)` | elements of `a` also in `b`, first occurrence only |
| `union(list1, list2, …)` | every element once, in order of appearance |

A **path** is a string of segments separated by `.`: an object key, or a zero-based index written in digits
on a list. A missing key or index gives `null`; `""` designates the element itself (`pluck(items, "ville.nom")`,
`pluck(pairs, "1")`).

Elements are **equal** when they have the same type and the same `toString` form: `1` equals `1.0` but not
`"1"`, and `{a: 1, b: 2}` equals `{b: 2, a: 1}`.

### Grouping and aggregation
These work like `map` and `filter` and also accept method syntax (`ventes.groupBy("produit")`). The `key`
is either a path (see above) or a function `fn(item, index)`; any other `key` raises an error.

| Function | Result |
|---|---|
| `groupBy(list, key)` | `{groupKey: [items…]}`, items in list order |
| `countBy(list, key)` | `{groupKey: count}` |
| `indexBy(list, key)` | `{groupKey: item}`, the last item of a key wins |
| `uniqueBy(list, key)` | the first item for each distinct key |
| `sumBy(list, key)` | sum of the keys; `null` keys are skipped, a non-number raises, `0` when empty |
| `minBy(list, key)`, `maxBy(list, key)` | the item with the smallest / largest key; `null` keys are skipped, the first wins on ties, `null` when nothing is left |
| `partition(list, key)` | `[[items whose key is truthy], [the others]]` |

A group key is the `toString` form of the key value (`null` gives `"null"`). `minBy` and `maxBy` compare two
numbers numerically and anything else by their `toString` form.

### Types
`typeOf`, `isNull`, `isNumber`, `isString`, `isBool`

### Crypto (Node.js only)
`md5`, `sha1`, `sha256`

> **Note**: Crypto functions are only available in Node.js environments. In browsers, they return stub values.

### Date/Time
A parameter named `date` accepts either:

- a **number**: milliseconds since 1970-01-01T00:00:00Z (the fraction is truncated);
- a **string** in ISO form: `YYYY-MM-DD` (midnight), or `YYYY-MM-DDTHH:mm[:ss[.fraction]]` with a space
  allowed in place of the `T`. A time may end with `Z` or an offset (`+01:00`, `-0530`); without a zone it
  is UTC. The fraction is kept to milliseconds.

The text is read strictly: `2026-02-29`, `2026-13-01` or `2026-01-01T24:00` are not dates. Anything else
(`null`, unreadable text, a boolean, a list, an object) is unreadable, and **a date function given an
unreadable date returns `null`**; it does not raise. A count that is not a number does raise. Counts are
truncated toward zero.

Every calendar computation (fields, start and end of a period, adding months, weekday) is done in
**UTC**, whatever the time zone of the host, so a script gives the same result everywhere. Dates are
returned as milliseconds; use `toISO` or `formatDate` to turn them into text.

| Function | Result |
|---|---|
| `now()`, `timestamp([date])` | current time in ms; `timestamp` of a date reads it, or gives `null` |
| `date()`, `time()`, `datetime()` | current UTC date `YYYY-MM-DD`, time `HH:mm:ss`, and `toISO(now())` |
| `isDate(value)` | `true` when `value` reads as a date |
| `toISO(date)` | `YYYY-MM-DDTHH:mm:ss.SSSZ` |
| `formatDate(date, [format])` | formatted text, `YYYY-MM-DD` by default |
| `parseDate(text, format)` | ms, or `null` when `text` does not match `format` |
| `year`, `month`, `day`, `hour`, `minute`, `second`, `dayOfWeek` `([date])` | calendar field, of now without argument; `dayOfWeek` is 0 (Sunday) to 6 (Saturday) |
| `addDays`, `addHours`, `addMinutes`, `addSeconds` `(date, n)` | ms |
| `addMonths(date, n)`, `addYears(date, n)` | ms; a missing day becomes the last day of the month (`2026-01-31` + 1 month is `2026-02-28`) |
| `diffDays`, `diffHours`, `diffMinutes` `(a, b)` | whole units from `a` to `b`, truncated toward zero (negative when `b < a`) |
| `diffMonths(a, b)`, `diffYears(a, b)` | whole calendar months / years from `a` to `b` |
| `age(birth, [at])` | whole years from `birth` to `at` (now by default) |
| `startOfDay`, `endOfDay`, `startOfMonth`, `endOfMonth` `(date)` | ms at 00:00:00.000 / 23:59:59.999 UTC |
| `daysInMonth(date)` | 28 to 31 |
| `isWeekend(date)` | `true` on Saturday or Sunday |

`formatDate` and `parseDate` scan the format from left to right and take the longest token at each
position; any other character is copied (formatting) or must match exactly (parsing).

| Token | Meaning |
|---|---|
| `YYYY` | 4-digit year |
| `YY` | last 2 digits of the year (formatting only; read as two literal characters when parsing) |
| `MM`, `DD` | month 01-12, day 01-31 |
| `HH`, `mm`, `ss` | hour 00-23, minute 00-59, second 00-59 |
| `SSS` | millisecond 000-999 |

When parsing, each token reads exactly its width in digits, the whole text must be consumed, and an
out-of-range value (`31/02/2026`) gives `null`. Missing fields default to January 1st, 00:00:00.000.

```javascript
formatDate("2026-10-19T08:05:00Z", "DD/MM/YYYY HH:mm")  // "19/10/2026 08:05"
toISO(addMonths("2026-01-31", 1))                       // "2026-02-28T00:00:00.000Z"
toISO(parseDate("19/10/2026", "DD/MM/YYYY"))            // "2026-10-19T00:00:00.000Z"
age("2000-10-20", "2026-10-19")                         // 25
```

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

// Loops
for (item in items) {
  print(item)
}

while (count < 10) {
  count = count + 1
}

// Functions
let greet = fn(name) {
  return "Hello " + name
}

// Return
return "result"

// Arrays and Objects
let arr = [1, 2, 3]
let obj = { name: "Alice", age: 30 }
let obj2 = { "key": "value" }  // String keys supported
```

## Other Implementations

| Language | Package |
|----------|---------|  
| **Kotlin** | [Maven Central](https://central.sonatype.com/artifact/io.github.issadicko/kodi-script) |
| **Go** | [pkg.go.dev](https://pkg.go.dev/github.com/issadicko/kodi-script-go) |
| **Dart** | [pub.dev](https://pub.dev/packages/kodi_script) |

## License

MIT
