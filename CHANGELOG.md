# Changelog

## 0.4.0

### Added

- Array natives: `chunk`, `compact`, `pluck`, `zip`, `fromEntries`, `difference`,
  `intersection`, `union`. A `null` list behaves as an empty list.
- Grouping builtins `groupBy`, `countBy`, `indexBy`, `uniqueBy`, `sumBy`, `minBy`, `maxBy`,
  `partition`, next to `map` and `filter`. The key is a dotted path or a function
  `fn(item, index)`.
- Date natives: `parseDate`, `isDate`, `toISO`, `addMonths`, `addYears`, `addMinutes`,
  `addSeconds`, `diffHours`, `diffMinutes`, `diffMonths`, `diffYears`, `age`, `startOfDay`,
  `endOfDay`, `startOfMonth`, `endOfMonth`, `daysInMonth`, `isWeekend`.
- `formatDate` knows the `YY` and `SSS` tokens.

### Changed

- Date functions accept ISO-8601 text (`2026-10-19`, `2026-10-19T08:30:00+01:00`) as well as
  milliseconds. Fields are validated strictly: `2026-02-29` is not a date.
- A date that cannot be read gives `null` instead of raising (`timestamp`, `formatDate`,
  `year`, `month`, `day`, `hour`, `minute`, `second`, `dayOfWeek`, `addDays`, `addHours`,
  `diffDays`).
- Every calendar computation is done in UTC instead of the host's time zone, including
  `date()`, `time()`, `datetime()` and the calendar fields. `datetime()` now returns
  `YYYY-MM-DDTHH:mm:ss.SSSZ`.

## 0.3.0

- Array literals, object literals and call arguments accept a trailing comma, so a
  literal can be laid out one element per line.
- An object literal at statement start is read as a value when a property follows
  (`{ a: 1 }`, `{}`): a script whose last statement is an object yields that object.
  A brace followed by a statement still opens a block.

## 0.0.1

- 🎉 Initial release
- Variables and expressions
- Null-safety operators (`?.`, `?:`)
- Control flow (if/else, return)
- Native functions:
  - String manipulation
  - Math operations
  - Crypto (MD5, SHA1, SHA256)
  - JSON parsing/stringify
  - Base64/URL encoding
  - Array operations
- Custom function registration
- Builder pattern API
- Full TypeScript support
