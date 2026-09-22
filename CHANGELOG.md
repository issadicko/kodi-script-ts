# Changelog

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
