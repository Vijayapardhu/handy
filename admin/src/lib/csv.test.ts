import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvWithHeader, toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes a field containing a comma, quote, or newline", () => {
    expect(toCsv(["a"], [["has,comma"]])).toBe('a\r\n"has,comma"');
    expect(toCsv(["a"], [['has"quote']])).toBe('a\r\n"has""quote"');
    expect(toCsv(["a"], [["has\nline"]])).toBe('a\r\n"has\nline"');
  });

  it("leaves an ordinary field bare", () => {
    expect(toCsv(["a"], [["plain"]])).toBe("a\r\nplain");
  });
});

describe("parseCsv — round-trips what toCsv produces", () => {
  it("parses a plain, unquoted row", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("parses a quoted field containing a comma", () => {
    expect(parseCsv('a,b\n"has,comma",2')).toEqual([
      ["a", "b"],
      ["has,comma", "2"],
    ]);
  });

  it("un-escapes a doubled quote inside a quoted field", () => {
    expect(parseCsv('a\n"has""quote"')).toEqual([["a"], ['has"quote']]);
  });

  it("parses a quoted field containing an embedded newline as one field", () => {
    expect(parseCsv('a\n"line one\nline two"')).toEqual([["a"], ["line one\nline two"]]);
  });

  it("handles CRLF and bare LF line endings the same way", () => {
    expect(parseCsv("a,b\r\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("ignores trailing blank lines rather than emitting an empty row", () => {
    expect(parseCsv("a,b\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseCsvWithHeader — what StudentsPage's bulk import actually calls", () => {
  it("keys each row by the trimmed header, in order", () => {
    const result = parseCsvWithHeader("rollNumber,name\n23A31A05B1,Jane Doe\n23A31A05B2,John Roe");
    expect(result).toEqual([
      { rollNumber: "23A31A05B1", name: "Jane Doe" },
      { rollNumber: "23A31A05B2", name: "John Roe" },
    ]);
  });

  it("fills a short row's missing trailing columns with an empty string, not undefined", () => {
    const result = parseCsvWithHeader("rollNumber,name,section\n23A31A05B1,Jane Doe");
    expect(result).toEqual([{ rollNumber: "23A31A05B1", name: "Jane Doe", section: "" }]);
  });

  it("returns an empty array for header-only input", () => {
    expect(parseCsvWithHeader("rollNumber,name")).toEqual([]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsvWithHeader("")).toEqual([]);
  });
});
