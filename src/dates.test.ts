import { describe, it, expect, vi } from 'vitest';
import { KodiScript } from './index';

function run(src: string): unknown[] {
  const r = KodiScript.builder(src).silentPrint(true).execute();
  expect(r.errors).toEqual([]);
  return r.output;
}

function value(expr: string): unknown {
  const r = KodiScript.builder(`return ${expr}`).silentPrint(true).execute();
  expect(r.errors).toEqual([]);
  return r.value;
}

function fails(expr: string): string {
  const r = KodiScript.builder(`return ${expr}`).silentPrint(true).execute();
  expect(r.errors.length).toBe(1);
  return r.errors[0];
}

describe('Date reading', () => {
  it('rejects dates that Date would normalise', () => {
    expect(value('isDate("2026-02-29")')).toBe(false);
    expect(value('isDate("2024-02-29")')).toBe(true);
    expect(value('isDate("1900-02-29")')).toBe(false);
    expect(value('isDate("2000-02-29")')).toBe(true);
    expect(value('isDate("2026-04-31")')).toBe(false);
    expect(value('isDate("2026-00-10")')).toBe(false);
    expect(value('isDate("2026-01-00")')).toBe(false);
    expect(value('isDate("2026-01-01T24:00")')).toBe(false);
    expect(value('isDate("2026-01-01T10:60")')).toBe(false);
    expect(value('isDate("2026-01-01T10:20:60")')).toBe(false);
  });

  it('accepts only the documented shapes', () => {
    for (const ok of ['2026-01-05', '2026-01-05T10:20', '2026-01-05 10:20:30', '2026-01-05T10:20:30.5Z',
      '2026-01-05T10:20:30+0100', '2026-01-05T10:20:30-05:30', '  2026-01-05  ']) {
      expect(value(`isDate("${ok}")`), ok).toBe(true);
    }
    for (const ko of ['2026-1-5', '20260105', '2026-01-05T', '2026-01-05T10', '2026-01-05T10:2',
      '2026-01-05T10:20.5', '2026-01-05T10:20:30.', '2026-01-05T10:20:30.1234567890',
      '2026-01-05T10:20:30z', '2026-01-05Z', '2026-01-05T10:20:30+1', '2026-01-05T10:20:30+24:00',
      '2026-01-05T10:20:30+01:60', '2026-01-05T10:20:30 extra', '2026-01-05x', '+2026-01-05', '', 'hier']) {
      expect(value(`isDate("${ko}")`), ko).toBe(false);
    }
  });

  it('applies the zone offset and defaults to UTC', () => {
    expect(value('toISO("2026-01-31T10:20:30+01:00")')).toBe('2026-01-31T09:20:30.000Z');
    expect(value('toISO("2026-01-31T10:20:30-0230")')).toBe('2026-01-31T12:50:30.000Z');
    expect(value('toISO("2026-01-01T00:30:00+01:00")')).toBe('2025-12-31T23:30:00.000Z');
    expect(value('toISO("2026-01-31T10:20:30")')).toBe('2026-01-31T10:20:30.000Z');
  });

  it('keeps milliseconds by truncating the fraction', () => {
    expect(value('toISO("2026-01-31T10:20:30.987654321Z")')).toBe('2026-01-31T10:20:30.987Z');
    expect(value('toISO("2026-01-31T10:20:30.9Z")')).toBe('2026-01-31T10:20:30.900Z');
  });

  it('keeps years below 100 as written', () => {
    expect(value('toISO("0050-03-01")')).toBe('0050-03-01T00:00:00.000Z');
    expect(value('toISO(addDays("0050-02-28", 1))')).toBe('0050-03-01T00:00:00.000Z');
    expect(value('toISO(startOfMonth("0099-12-15"))')).toBe('0099-12-01T00:00:00.000Z');
    expect(value('toISO(addYears("0004-02-29", 4))')).toBe('0008-02-29T00:00:00.000Z');
    expect(value('year("0050-03-01")')).toBe(50);
  });

  it('reads numbers as milliseconds, truncated toward zero', () => {
    expect(value('toISO(1500.9)')).toBe('1970-01-01T00:00:01.500Z');
    expect(value('toISO(-1500.9)')).toBe('1969-12-31T23:59:58.500Z');
    expect(value('isDate(sqrt(-1))')).toBe(false);
    expect(value('isDate(8640000000000000)')).toBe(true);
    expect(value('isDate(8640000000000001)')).toBe(false);
  });

  it('treats anything else as unreadable', () => {
    for (const v of ['null', 'true', '[]', '[0]', '{}', '{a: 1}']) {
      expect(value(`isDate(${v})`), v).toBe(false);
      expect(value(`toISO(${v})`), v).toBeNull();
      expect(value(`year(${v})`), v).toBeNull();
      expect(value(`addDays(${v}, 1)`), v).toBeNull();
      expect(value(`diffDays(${v}, 0)`), v).toBeNull();
    }
  });

  it('gives null for an explicit null but now for no argument', () => {
    expect(value('timestamp(null)')).toBeNull();
    expect(value('year(null)')).toBeNull();
    expect(value('year() >= 2024')).toBe(true);
    expect(value('timestamp() > 0')).toBe(true);
    expect(value('age("2000-01-01", null)')).toBeNull();
    expect(value('age("2000-01-01") >= 25')).toBe(true);
  });

  it('never reads the host zone', () => {
    const local = ['getFullYear', 'getMonth', 'getDate', 'getDay', 'getHours', 'getMinutes', 'getSeconds',
      'getMilliseconds', 'getTimezoneOffset', 'setFullYear', 'setMonth', 'setDate', 'setHours', 'setMinutes',
      'setSeconds', 'setMilliseconds', 'toTimeString', 'toDateString', 'toString'] as const;
    const spies = local.map(name => vi.spyOn(Date.prototype, name).mockImplementation(() => {
      throw new Error(`Date.${name} depends on the host time zone`);
    }));
    try {
      expect(value('formatDate("2026-03-05T07:08:09.045Z", "YYYY-MM-DD HH:mm:ss.SSS")')).toBe('2026-03-05 07:08:09.045');
      expect(value('[year(0), month(0), day(0), hour(0), minute(0), second(0), dayOfWeek(0)]')).toEqual([1970, 1, 1, 0, 0, 0, 4]);
      expect(value('toISO(addMonths("2026-01-31", 1))')).toBe('2026-02-28T00:00:00.000Z');
      expect(value('toISO(addYears("2024-02-29", 1))')).toBe('2025-02-28T00:00:00.000Z');
      expect(value('toISO(startOfDay("2026-10-19T23:30:00Z"))')).toBe('2026-10-19T00:00:00.000Z');
      expect(value('toISO(endOfMonth("2026-10-19"))')).toBe('2026-10-31T23:59:59.999Z');
      expect(value('diffMonths("2026-01-31", "2026-03-30")')).toBe(1);
      expect(value('daysInMonth("2026-02-10")')).toBe(28);
      expect(value('isWeekend("2026-10-17")')).toBe(true);
      expect(value('toISO(parseDate("19/10/2026", "DD/MM/YYYY"))')).toBe('2026-10-19T00:00:00.000Z');
      expect(value('date().length()')).toBe(10);
      expect(value('time().length()')).toBe(8);
      expect(value('datetime().length()')).toBe(24);
    } finally {
      spies.forEach(spy => spy.mockRestore());
    }
  });
});

describe('Date formatting and parsing', () => {
  it('replaces every occurrence of a token, left to right', () => {
    expect(value('formatDate("2026-10-19", "YYYY-MM-DD, YYYY")')).toBe('2026-10-19, 2026');
    expect(value('formatDate("2026-03-05", "DD DD/MM MM")')).toBe('05 05/03 03');
  });

  it('takes the longest token and copies the rest', () => {
    expect(value('formatDate("2026-03-05T07:08:09.045Z", "YYYYYY")')).toBe('202626');
    expect(value('formatDate("2026-03-05T07:08:09.045Z", "YYY")')).toBe('26Y');
    expect(value('formatDate("2026-03-05T07:08:09.045Z", "SSSS")')).toBe('045S');
    expect(value('formatDate("2026-03-05T07:08:09.045Z", "[HH:mm] ss")')).toBe('[07:08] 09');
    expect(value('formatDate("2026-03-05T07:08:09.045Z", "")')).toBe('');
    expect(value('formatDate("2026-03-05")')).toBe('2026-03-05');
  });

  it('pads the year to four digits', () => {
    expect(value('formatDate("0007-01-01", "YYYY")')).toBe('0007');
    expect(value('formatDate("0007-01-01", "YY")')).toBe('07');
  });

  it('raises on a format that is not text', () => {
    expect(fails('formatDate("2026-01-01", 3)')).toContain('formatDate');
    expect(fails('formatDate("2026-01-01", null)')).toContain('formatDate');
    expect(fails('parseDate("2026", 3)')).toContain('parseDate');
  });

  it('parses each token on its exact width', () => {
    expect(value('toISO(parseDate("19/10/2026 08:05:09.007", "DD/MM/YYYY HH:mm:ss.SSS"))'))
      .toBe('2026-10-19T08:05:09.007Z');
    expect(value('parseDate("9/10/2026", "DD/MM/YYYY")')).toBeNull();
    expect(value('parseDate("19/10/26", "DD/MM/YYYY")')).toBeNull();
    expect(value('parseDate("19/10/2026 ", "DD/MM/YYYY")')).toBeNull();
    expect(value('parseDate("19-10-2026", "DD/MM/YYYY")')).toBeNull();
    expect(value('parseDate("31/02/2026", "DD/MM/YYYY")')).toBeNull();
    expect(value('parseDate("29/02/2024", "DD/MM/YYYY") != null')).toBe(true);
    expect(value('parseDate("25:00", "HH:mm")')).toBeNull();
  });

  it('defaults the missing fields and ignores non-text input', () => {
    expect(value('toISO(parseDate("2026-05", "YYYY-MM"))')).toBe('2026-05-01T00:00:00.000Z');
    expect(value('parseDate(20260101, "YYYYMMDD")')).toBeNull();
    expect(value('parseDate(null, "YYYY")')).toBeNull();
  });

  it('does not support YY when parsing', () => {
    expect(value('parseDate("26", "YY")')).toBeNull();
    expect(value('toISO(parseDate("YY", "YY"))')).toBe('1970-01-01T00:00:00.000Z');
  });
});

describe('Date arithmetic', () => {
  it('truncates counts toward zero', () => {
    expect(value('toISO(addDays("2026-01-10", 1.9))')).toBe('2026-01-11T00:00:00.000Z');
    expect(value('toISO(addDays("2026-01-10", -1.9))')).toBe('2026-01-09T00:00:00.000Z');
    expect(value('toISO(addMonths("2026-01-10", 0.5))')).toBe('2026-01-10T00:00:00.000Z');
  });

  it('raises on a count that is not a number, before looking at the date', () => {
    expect(fails('addDays("2026-01-10", "2")')).toContain('addDays');
    expect(fails('addMonths(null, "2")')).toContain('addMonths');
    expect(fails('addYears("2026-01-10")')).toContain('addYears');
  });

  it('clamps the day when adding months and years', () => {
    expect(value('toISO(addMonths("2026-01-31T10:20:30.123Z", 1))')).toBe('2026-02-28T10:20:30.123Z');
    expect(value('toISO(addMonths("2026-03-31", -13))')).toBe('2025-02-28T00:00:00.000Z');
    expect(value('toISO(addMonths("2026-12-15", 1))')).toBe('2027-01-15T00:00:00.000Z');
    expect(value('toISO(addMonths("2026-01-15", -1))')).toBe('2025-12-15T00:00:00.000Z');
    expect(value('toISO(addMonths("2026-01-15", 24))')).toBe('2028-01-15T00:00:00.000Z');
    expect(value('toISO(addYears("2023-02-28", -3))')).toBe('2020-02-28T00:00:00.000Z');
  });

  it('gives null when the result leaves the supported range', () => {
    expect(value('addDays("9999-12-31", 1000000000000)')).toBeNull();
    expect(value('addYears("2026-01-01", 1000000000000)')).toBeNull();
    expect(value('addMonths("2026-01-01", pow(10, 300))')).toBeNull();
  });

  it('truncates differences toward zero', () => {
    expect(value('diffDays("2026-10-19T12:00:00Z", "2026-10-21T11:59:59Z")')).toBe(1);
    expect(value('diffDays("2026-10-21T11:59:59Z", "2026-10-19T12:00:00Z")')).toBe(-1);
    expect(value('diffDays("2026-10-19T12:00:00Z", "2026-10-19T23:00:00Z")')).toBe(0);
    expect(value('diffHours("2026-10-19T08:00:00Z", "2026-10-19T07:01:00Z")')).toBe(0);
    expect(value('diffMinutes("2026-10-19T08:00:30Z", "2026-10-19T07:00:00Z")')).toBe(-60);
  });

  it('counts whole calendar months and years', () => {
    expect(value('diffMonths("2026-01-31", "2026-02-28")')).toBe(0);
    expect(value('diffMonths("2026-01-31", "2026-03-31")')).toBe(2);
    expect(value('diffMonths("2026-01-15T10:00:00Z", "2026-02-15T09:59:59Z")')).toBe(0);
    expect(value('diffMonths("2026-01-15T10:00:00Z", "2026-02-15T10:00:00Z")')).toBe(1);
    expect(value('diffMonths("2025-12-31", "2026-01-01")')).toBe(0);
    expect(value('diffMonths("2026-03-15", "2026-01-16")')).toBe(-1);
    expect(value('diffMonths("2026-05-05", "2026-05-05")')).toBe(0);
    expect(value('diffYears("2000-02-29", "2024-02-28")')).toBe(23);
    expect(value('diffYears("2024-02-28", "2000-02-29")')).toBe(-23);
    expect(value('diffYears("2024-02-28", "2025-01-01")')).toBe(0);
  });

  it('computes an age on the birthday', () => {
    expect(value('age("2000-10-19", "2026-10-18")')).toBe(25);
    expect(value('age("2000-10-19", "2026-10-19")')).toBe(26);
    expect(value('age("2000-10-19T10:00:00Z", "2026-10-19T09:59:59Z")')).toBe(25);
    expect(value('age("2026-10-19", "2000-10-19")')).toBe(-26);
    expect(value('age(null, "2026-10-19")')).toBeNull();
  });

  it('finds the bounds of a day and a month', () => {
    expect(value('toISO(endOfMonth("2026-02-10"))')).toBe('2026-02-28T23:59:59.999Z');
    expect(value('toISO(endOfMonth("2026-12-31T23:59:59.999Z"))')).toBe('2026-12-31T23:59:59.999Z');
    expect(value('daysInMonth("1900-02-01")')).toBe(28);
    expect(value('daysInMonth("2000-02-01")')).toBe(29);
    expect(value('daysInMonth("2026-04-30")')).toBe(30);
    expect(value('daysInMonth("2026-12-01")')).toBe(31);
    expect(value('daysInMonth("nope")')).toBeNull();
  });

  it('numbers the weekdays from Sunday', () => {
    expect(value('dayOfWeek("2026-10-18")')).toBe(0);
    expect(value('dayOfWeek("2026-10-24")')).toBe(6);
    expect(value('isWeekend("2026-10-18")')).toBe(true);
    expect(value('isWeekend("2026-10-24")')).toBe(true);
    expect(value('isWeekend("2026-10-23")')).toBe(false);
    expect(value('isWeekend(null)')).toBeNull();
    expect(value('dayOfWeek("1969-12-31")')).toBe(3);
  });

  it('formats the current date and time in UTC', () => {
    const [d, t, dt] = run('print(date())\nprint(time())\nprint(datetime())');
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(t).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(dt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('works with method-call syntax', () => {
    expect(value('"2026-01-31".addMonths(1).toISO()')).toBe('2026-02-28T00:00:00.000Z');
    expect(value('"2026-10-19".isWeekend()')).toBe(false);
  });
});
