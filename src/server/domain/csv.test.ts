import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";

describe("toCsv (Story 7.5)", () => {
  it("renders headers and rows with CRLF endings", () => {
    const csv = toCsv(["Name", "Count"], [["Alder", 3], ["Birch", 0]]);
    expect(csv).toBe("Name,Count\r\nAlder,3\r\nBirch,0\r\n");
  });

  it("quotes commas, quotes, and newlines per RFC 4180", () => {
    const csv = toCsv(["A"], [['He said "hi", twice\nnew line']]);
    expect(csv).toBe('A\r\n"He said ""hi"", twice\nnew line"\r\n');
  });

  it("renders null as an empty cell", () => {
    expect(toCsv(["A", "B"], [[null, "x"]])).toBe("A,B\r\n,x\r\n");
  });

  it("neutralizes spreadsheet formula injection", () => {
    const csv = toCsv(["A"], [["=SUM(1,2)"], ["+1"], ["@cmd"], ["-2"]]);
    const lines = csv.trimEnd().split("\r\n").slice(1);
    expect(lines[0]).toBe("\"'=SUM(1,2)\"");
    expect(lines[1]).toBe("'+1");
    expect(lines[2]).toBe("'@cmd");
    expect(lines[3]).toBe("'-2");
  });

  it("throws on a row width mismatch instead of misaligning columns", () => {
    expect(() => toCsv(["A", "B"], [["only-one"]])).toThrow(/row width/);
  });
});
