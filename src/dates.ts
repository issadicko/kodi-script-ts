import type { NativeFunction } from './natives';

// ============ Date/Time functions ============
//
// A date argument is either milliseconds since the epoch or ISO-8601 text
// (YYYY-MM-DD, optionally followed by a time and a zone). Every calendar
// computation is done in UTC so that a script gives the same answer on every
// host and in every implementation. A date that cannot be read yields null.
//
// JavaScript's own Date parser is never used on text: it accepts and normalises
// impossible dates such as 2026-02-29. The reader below is strict, and Date is
// only used for calendar arithmetic once the fields are known to be valid.

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_MINUTE = 60_000;

// Largest magnitude a JavaScript Date can hold.
const MAX_MS = 8.64e15;

class Scanner {
  pos = 0;

  constructor(readonly s: string) { }

  done(): boolean {
    return this.pos >= this.s.length;
  }

  literal(c: string): boolean {
    if (!this.done() && this.s[this.pos] === c) {
      this.pos++;
      return true;
    }
    return false;
  }

  // Reads exactly n ASCII digits; null (and no progress) otherwise.
  digits(n: number): number | null {
    if (this.pos + n > this.s.length) return null;
    let value = 0;
    for (let i = 0; i < n; i++) {
      const code = this.s.charCodeAt(this.pos + i);
      if (code < 48 || code > 57) return null;
      value = value * 10 + (code - 48);
    }
    this.pos += n;
    return value;
  }
}

function isDigit(code: number): boolean {
  return code >= 48 && code <= 57;
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysIn(year: number, month: number): number {
  if (month === 2) return isLeap(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

// Milliseconds of a UTC calendar date. Date.UTC would read the years 0 to 99 as
// 1900 to 1999, so the year goes through setUTCFullYear.
function utc(year: number, month: number, day: number, hour: number, minute: number, second: number, ms: number): number | null {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  d.setUTCHours(hour, minute, second, ms);
  return inRange(d.getTime());
}

// A result outside the range of a JavaScript Date is not a date.
function inRange(ms: number): number | null {
  return Number.isFinite(ms) && Math.abs(ms) <= MAX_MS ? ms + 0 : null;
}

// Rejects out-of-range fields instead of letting Date normalise them.
function buildDate(year: number, month: number, day: number, hour: number, minute: number, second: number, ms: number): number | null {
  if (month < 1 || month > 12 || day < 1 || day > daysIn(year, month) || hour > 23 || minute > 59 || second > 59) {
    return null;
  }
  return utc(year, month, day, hour, minute, second, ms);
}

// Reads YYYY-MM-DD[(T| )HH:mm[:ss[.fraction]][Z|±HH:mm|±HHmm]].
function parseISO(s: string): number | null {
  const p = new Scanner(s);
  const year = p.digits(4);
  if (year === null || !p.literal('-')) return null;
  const month = p.digits(2);
  if (month === null || !p.literal('-')) return null;
  const day = p.digits(2);
  if (day === null) return null;

  let hour = 0;
  let minute = 0;
  let second = 0;
  let millis = 0;
  let offsetSeconds = 0;
  if (!p.done()) {
    if (!p.literal('T') && !p.literal(' ')) return null;
    const h = p.digits(2);
    if (h === null || !p.literal(':')) return null;
    hour = h;
    const mi = p.digits(2);
    if (mi === null) return null;
    minute = mi;
    if (p.literal(':')) {
      const sec = p.digits(2);
      if (sec === null) return null;
      second = sec;
      if (p.literal('.')) {
        const start = p.pos;
        while (!p.done() && isDigit(p.s.charCodeAt(p.pos)) && p.pos - start < 9) p.pos++;
        const fraction = p.s.slice(start, p.pos);
        if (fraction === '') return null;
        millis = Number(fraction.slice(0, 3).padEnd(3, '0'));
      }
    }
    if (!p.done() && !p.literal('Z')) {
      const sign = p.s[p.pos];
      if (sign !== '+' && sign !== '-') return null;
      p.pos++;
      const oh = p.digits(2);
      if (oh === null) return null;
      p.literal(':');
      const om = p.digits(2);
      if (om === null || oh > 23 || om > 59) return null;
      offsetSeconds = oh * 3600 + om * 60;
      if (sign === '-') offsetSeconds = -offsetSeconds;
    }
  }
  if (!p.done()) return null;
  const ms = buildDate(year, month, day, hour, minute, second, millis);
  return ms === null ? null : inRange(ms - offsetSeconds * 1000);
}

// Reads a date argument: milliseconds (fraction truncated) or ISO text; null when it is not a date.
function readDate(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? inRange(Math.trunc(v)) : null;
  if (typeof v === 'string') return parseISO(v.trim());
  return null;
}

// Reads an optional date argument: absent means now.
function dateOrNow(args: unknown[]): number | null {
  return args.length === 0 ? Date.now() : readDate(args[0]);
}

// Reads a whole-number argument, truncated toward zero.
function count(name: string, v: unknown): number {
  if (typeof v !== 'number') throw new Error(`${name} requires a number as second argument`);
  return Math.trunc(v);
}

function pad(n: number, width: number): string {
  const digits = String(Math.abs(n)).padStart(n < 0 ? width - 1 : width, '0');
  return n < 0 ? '-' + digits : digits;
}

// ---- Format tokens ----

// Tried longest first at each position of a format.
const DATE_TOKENS = ['YYYY', 'SSS', 'YY', 'MM', 'DD', 'HH', 'mm', 'ss'];

function tokenAt(format: string, i: number): string {
  for (const tok of DATE_TOKENS) {
    if (format.startsWith(tok, i)) return tok;
  }
  return '';
}

function formatMs(ms: number, format: string): string {
  const d = new Date(ms);
  let out = '';
  for (let i = 0; i < format.length;) {
    const tok = tokenAt(format, i);
    switch (tok) {
      case 'YYYY': out += pad(d.getUTCFullYear(), 4); break;
      case 'YY': out += pad(d.getUTCFullYear() % 100, 2); break;
      case 'MM': out += pad(d.getUTCMonth() + 1, 2); break;
      case 'DD': out += pad(d.getUTCDate(), 2); break;
      case 'HH': out += pad(d.getUTCHours(), 2); break;
      case 'mm': out += pad(d.getUTCMinutes(), 2); break;
      case 'ss': out += pad(d.getUTCSeconds(), 2); break;
      case 'SSS': out += pad(d.getUTCMilliseconds(), 3); break;
      default:
        out += format[i];
        i++;
        continue;
    }
    i += tok.length;
  }
  return out;
}

function isoString(ms: number): string {
  return formatMs(ms, 'YYYY-MM-DDTHH:mm:ss.SSS') + 'Z';
}

// ---- Calendar arithmetic ----

function floorDiv(a: number, b: number): number {
  return Math.floor(a / b);
}

// Keeps the day when it exists in the target month, else takes its last day.
function addMonthsClamped(ms: number, n: number): number | null {
  const d = new Date(ms);
  const total = d.getUTCMonth() + n;
  if (!Number.isSafeInteger(total)) return null;
  const yearShift = floorDiv(total, 12);
  const year = d.getUTCFullYear() + yearShift;
  const month = total - yearShift * 12 + 1;
  const day = Math.min(d.getUTCDate(), daysIn(year, month));
  return utc(year, month, day, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
}

function timeOfDay(ms: number): number {
  return ((ms % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY;
}

// Counts whole calendar months from a to b.
function monthsBetween(a: number, b: number): number {
  if (b < a) return 0 - monthsBetween(b, a);
  const da = new Date(a);
  const db = new Date(b);
  let months = (db.getUTCFullYear() - da.getUTCFullYear()) * 12 + db.getUTCMonth() - da.getUTCMonth();
  if (db.getUTCDate() < da.getUTCDate() || (db.getUTCDate() === da.getUTCDate() && timeOfDay(b) < timeOfDay(a))) {
    months--;
  }
  return months;
}

// Whole units from a to b, truncated toward zero (exact: the remainder is removed before dividing).
function elapsed(unit: number): (a: number, b: number) => number {
  return (a, b) => {
    const diff = b - a;
    return (diff - (diff % unit)) / unit;
  };
}

// ---- Native factories ----

function calendarField(name: string, field: (d: Date) => number): NativeFunction {
  return (...args) => {
    if (args.length > 1) throw new Error(`${name} requires 0 or 1 argument ([date])`);
    const ms = dateOrNow(args);
    return ms === null ? null : field(new Date(ms));
  };
}

function shift(name: string, apply: (ms: number, n: number) => number | null): NativeFunction {
  return (...args) => {
    if (args.length !== 2) throw new Error(`${name} requires 2 arguments (date, n)`);
    const n = count(name, args[1]);
    const ms = readDate(args[0]);
    if (ms === null) return null;
    const result = apply(ms, n);
    return result === null ? null : inRange(result);
  };
}

function between(name: string, measure: (a: number, b: number) => number): NativeFunction {
  return (...args) => {
    if (args.length !== 2) throw new Error(`${name} requires 2 arguments (date1, date2)`);
    const a = readDate(args[0]);
    const b = readDate(args[1]);
    if (a === null || b === null) return null;
    return measure(a, b) + 0;
  };
}

function period(name: string, bound: (d: Date) => number | null): NativeFunction {
  return (...args) => {
    if (args.length !== 1) throw new Error(`${name} requires 1 argument (date)`);
    const ms = readDate(args[0]);
    return ms === null ? null : bound(new Date(ms));
  };
}

export function registerDateNatives(natives: Map<string, NativeFunction>): void {
  // ---- Current date and time ----
  natives.set('now', () => Date.now());
  natives.set('date', () => isoString(Date.now()).slice(0, 10));
  natives.set('time', () => isoString(Date.now()).slice(11, 19));
  natives.set('datetime', () => isoString(Date.now()));

  natives.set('timestamp', (...args) => dateOrNow(args));

  // ---- Reading and writing dates ----
  natives.set('toISO', (...args) => {
    if (args.length !== 1) throw new Error('toISO requires 1 argument (date)');
    const ms = readDate(args[0]);
    return ms === null ? null : isoString(ms);
  });

  natives.set('isDate', (...args) => {
    if (args.length !== 1) throw new Error('isDate requires 1 argument');
    return readDate(args[0]) !== null;
  });

  natives.set('formatDate', (...args) => {
    if (args.length < 1 || args.length > 2) throw new Error('formatDate requires 1 or 2 arguments (date, [format])');
    let format = 'YYYY-MM-DD';
    if (args.length === 2) {
      if (typeof args[1] !== 'string') throw new Error('formatDate requires a string as second argument');
      format = args[1];
    }
    const ms = readDate(args[0]);
    return ms === null ? null : formatMs(ms, format);
  });

  natives.set('parseDate', (...args) => {
    if (args.length !== 2) throw new Error('parseDate requires 2 arguments (text, format)');
    const format = args[1];
    if (typeof format !== 'string') throw new Error('parseDate requires a string format as second argument');
    const text = args[0];
    if (typeof text !== 'string') return null;

    let year = 1970;
    let month = 1;
    let day = 1;
    let hour = 0;
    let minute = 0;
    let second = 0;
    let millis = 0;
    const p = new Scanner(text);
    for (let i = 0; i < format.length;) {
      const tok = tokenAt(format, i);
      let width = 0;
      switch (tok) {
        case 'YYYY': width = 4; break;
        case 'MM': case 'DD': case 'HH': case 'mm': case 'ss': width = 2; break;
        case 'SSS': width = 3; break;
      }
      // YY has no width: it is read as two literal characters.
      if (width === 0) {
        if (!p.literal(format[i])) return null;
        i++;
        continue;
      }
      const v = p.digits(width);
      if (v === null) return null;
      switch (tok) {
        case 'YYYY': year = v; break;
        case 'MM': month = v; break;
        case 'DD': day = v; break;
        case 'HH': hour = v; break;
        case 'mm': minute = v; break;
        case 'ss': second = v; break;
        case 'SSS': millis = v; break;
      }
      i += tok.length;
    }
    if (!p.done()) return null;
    return buildDate(year, month, day, hour, minute, second, millis);
  });

  // ---- Calendar fields ----
  natives.set('year', calendarField('year', d => d.getUTCFullYear()));
  natives.set('month', calendarField('month', d => d.getUTCMonth() + 1));
  natives.set('day', calendarField('day', d => d.getUTCDate()));
  natives.set('hour', calendarField('hour', d => d.getUTCHours()));
  natives.set('minute', calendarField('minute', d => d.getUTCMinutes()));
  natives.set('second', calendarField('second', d => d.getUTCSeconds()));
  natives.set('dayOfWeek', calendarField('dayOfWeek', d => d.getUTCDay()));

  natives.set('daysInMonth', (...args) => {
    if (args.length !== 1) throw new Error('daysInMonth requires 1 argument (date)');
    const ms = readDate(args[0]);
    if (ms === null) return null;
    const d = new Date(ms);
    return daysIn(d.getUTCFullYear(), d.getUTCMonth() + 1);
  });

  natives.set('isWeekend', (...args) => {
    if (args.length !== 1) throw new Error('isWeekend requires 1 argument (date)');
    const ms = readDate(args[0]);
    if (ms === null) return null;
    const weekday = new Date(ms).getUTCDay();
    return weekday === 0 || weekday === 6;
  });

  // ---- Arithmetic ----
  natives.set('addDays', shift('addDays', (ms, n) => ms + n * MS_PER_DAY));
  natives.set('addHours', shift('addHours', (ms, n) => ms + n * MS_PER_HOUR));
  natives.set('addMinutes', shift('addMinutes', (ms, n) => ms + n * MS_PER_MINUTE));
  natives.set('addSeconds', shift('addSeconds', (ms, n) => ms + n * 1000));
  natives.set('addMonths', shift('addMonths', addMonthsClamped));
  natives.set('addYears', shift('addYears', (ms, n) => addMonthsClamped(ms, 12 * n)));

  natives.set('diffDays', between('diffDays', elapsed(MS_PER_DAY)));
  natives.set('diffHours', between('diffHours', elapsed(MS_PER_HOUR)));
  natives.set('diffMinutes', between('diffMinutes', elapsed(MS_PER_MINUTE)));
  natives.set('diffMonths', between('diffMonths', monthsBetween));
  natives.set('diffYears', between('diffYears', (a, b) => Math.trunc(monthsBetween(a, b) / 12)));

  natives.set('age', (...args) => {
    if (args.length < 1 || args.length > 2) throw new Error('age requires 1 or 2 arguments (birth, [at])');
    const birth = readDate(args[0]);
    if (birth === null) return null;
    const at = dateOrNow(args.slice(1));
    if (at === null) return null;
    return Math.trunc(monthsBetween(birth, at) / 12) + 0;
  });

  // ---- Periods ----
  natives.set('startOfDay', period('startOfDay', d => utc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 0, 0, 0, 0)));
  natives.set('endOfDay', period('endOfDay', d => utc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 23, 59, 59, 999)));
  natives.set('startOfMonth', period('startOfMonth', d => utc(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0)));
  natives.set('endOfMonth', period('endOfMonth', d => {
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    return utc(year, month, daysIn(year, month), 23, 59, 59, 999);
  }));
}
