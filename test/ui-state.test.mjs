import { describe, it, expect } from "vitest";
import { analyzeSheetText, collectOverwriteHeaders, computeStatus, duplicateColumns, resolveFieldValue } from "../src/logic/ui-state.js";

const NO_INPUT = "--";

const allUnmapped = {
  location_name: NO_INPUT,
  street_address: NO_INPUT,
  city: NO_INPUT,
  region: NO_INPUT,
  postal_code: NO_INPUT,
  latitude: NO_INPUT,
  longitude: NO_INPUT,
  iso_country_code: NO_INPUT,
};

describe("duplicateColumns", () => {
  it("returns empty set when no duplicates", () => {
    expect(duplicateColumns({ a: "A", b: "B" })).toEqual(new Set());
  });

  it("detects a duplicate column", () => {
    expect(duplicateColumns({ a: "Col", b: "Col" })).toEqual(new Set(["Col"]));
  });

  it("ignores NO_INPUT values", () => {
    expect(duplicateColumns({ a: NO_INPUT, b: NO_INPUT, c: "A" })).toEqual(new Set());
  });
});

describe("computeStatus", () => {
  it("returns 'none' kind when nothing mapped", () => {
    expect(computeStatus(allUnmapped).kind).toBe("none");
  });

  it("returns 'ready' when lat+long mapped", () => {
    const m = { ...allUnmapped, latitude: "Lat", longitude: "Lng" };
    expect(computeStatus(m).kind).toBe("ready");
  });

  it("returns 'ready' for full US address set", () => {
    const m = {
      ...allUnmapped,
      street_address: "Street",
      city: "City",
      region: "State",
      postal_code: "Zip",
      iso_country_code: "Country",
    };
    expect(computeStatus(m).kind).toBe("ready");
  });

  it("returns 'partial' when close but incomplete", () => {
    const m = { ...allUnmapped, latitude: "Lat" };
    const status = computeStatus(m);
    expect(status.kind).toBe("partial");
    expect(status.text).toContain("Lng");
  });

  it("returns 'conflict' on duplicate columns", () => {
    const m = { ...allUnmapped, latitude: "Same", longitude: "Same" };
    expect(computeStatus(m).kind).toBe("conflict");
  });
});

describe("resolveFieldValue", () => {
  const headers = ["Name", "Street", "City", "State"];

  it("uses saved per-sheet mapping when still present in headers", () => {
    const mapData = { city: "State" };
    const automap = { city: "City" };
    expect(resolveFieldValue("city", headers, mapData, automap)).toBe("State");
  });

  it("falls back to automap when saved mapping no longer matches a header", () => {
    const mapData = { city: "Town" };
    const automap = { city: "City" };
    expect(resolveFieldValue("city", headers, mapData, automap)).toBe("City");
  });

  it("ignores NO_INPUT saved mappings and uses automap", () => {
    const mapData = { city: NO_INPUT };
    const automap = { city: "City" };
    expect(resolveFieldValue("city", headers, mapData, automap)).toBe("City");
  });

  it("returns NO_INPUT when neither saved nor automap provide a valid header", () => {
    expect(resolveFieldValue("city", headers, {}, {})).toBe(NO_INPUT);
  });

  it("falls back to NO_INPUT when automap picks a column no longer present", () => {
    const automap = { city: "NotThere" };
    expect(resolveFieldValue("city", headers, {}, automap)).toBe(NO_INPUT);
  });

  it("handles missing mapData and automap args gracefully", () => {
    expect(resolveFieldValue("city", headers, null, null)).toBe(NO_INPUT);
    expect(resolveFieldValue("city", headers, undefined, undefined)).toBe(NO_INPUT);
  });
});

describe("analyzeSheetText", () => {
  it("returns empty-state for null / empty input", () => {
    expect(analyzeSheetText(null)).toEqual({ cols: false, rowCount: 0, columnCount: 0, headersMissing: false });
    expect(analyzeSheetText([])).toEqual({ cols: false, rowCount: 0, columnCount: 0, headersMissing: false });
  });

  it("recognizes a normal header row", () => {
    const result = analyzeSheetText([
      ["Name", "City", "State"],
      ["A", "B", "C"],
    ]);
    expect(result.cols).toEqual([["Name", "City", "State"]]);
    expect(result.rowCount).toBe(2);
    expect(result.columnCount).toBe(3);
    expect(result.headersMissing).toBe(false);
  });

  it("flags headersMissing when row 1 is empty but later rows have content (data island)", () => {
    const result = analyzeSheetText([
      ["", "", ""],
      ["", "stuff", ""],
      ["", "", "more"],
    ]);
    expect(result.cols).toBe(false);
    expect(result.headersMissing).toBe(true);
    expect(result.rowCount).toBe(3);
  });

  it("returns empty (not headersMissing) when row 1 and all other rows are empty", () => {
    const result = analyzeSheetText([
      ["", "", ""],
      ["", "", ""],
    ]);
    expect(result.cols).toBe(false);
    expect(result.headersMissing).toBe(false);
  });

  it("coerces null / numeric cells to strings", () => {
    const result = analyzeSheetText([
      ["Name", "Zip"],
      ["A", 94131],
      ["B", null],
    ]);
    expect(result.cols).toEqual([["Name", "Zip"]]);
    expect(result.rowCount).toBe(3);
  });

  it("treats a row-1 mix of empty and populated cells as valid headers", () => {
    const result = analyzeSheetText([
      ["Name", "", "State"],
      ["A", "", "CA"],
    ]);
    expect(result.cols).toEqual([["Name", "", "State"]]);
    expect(result.headersMissing).toBe(false);
  });
});

describe("collectOverwriteHeaders", () => {
  it("returns existing header name when a field targets an in-range column", () => {
    const fields = { placekey: { columnIndex: 2 } };
    const headers = ["Name", "Address", "Placekey"];
    expect(collectOverwriteHeaders(fields, headers)).toEqual(["Placekey"]);
  });

  it("ignores fields that target columns past the end of the header row (appended)", () => {
    const fields = {
      placekey: { columnIndex: 2 },
      confidence_score: { columnIndex: 3 },
    };
    const headers = ["Name", "Address"];
    expect(collectOverwriteHeaders(fields, headers)).toEqual([]);
  });

  it("filters out blank headers (padded columns) so the confirm dialog does not show empty entries", () => {
    // Simulates Code.gs:342 bug: headers row is padded with mid-array empties,
    // but prepareOutputFields packs new fields at effectiveLength (trailing
    // empties trimmed), so a field can land on an empty-string header cell.
    const fields = {
      placekey: { columnIndex: 2 },
      confidence_score: { columnIndex: 3 },
    };
    const headers = ["Name", "Address", "", ""];
    expect(collectOverwriteHeaders(fields, headers)).toEqual([]);
  });

  it("returns mix of real and blank correctly — only real header names appear", () => {
    const fields = {
      placekey: { columnIndex: 1 },
      confidence_score: { columnIndex: 2 },
      gers: { columnIndex: 3 },
    };
    const headers = ["Name", "Placekey", "", "OtherExisting"];
    expect(collectOverwriteHeaders(fields, headers)).toEqual(["Placekey", "OtherExisting"]);
  });

  it("treats null header cells the same as empty strings", () => {
    const fields = { placekey: { columnIndex: 1 } };
    const headers = ["Name", null];
    expect(collectOverwriteHeaders(fields, headers)).toEqual([]);
  });

  it("returns empty list when fields is empty", () => {
    expect(collectOverwriteHeaders({}, ["Name", "Address"])).toEqual([]);
  });
});
