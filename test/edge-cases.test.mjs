import { describe, it, expect, beforeAll } from "vitest";
import { transformColumnMappings, prepareOutputFields } from "../src/logic/transform.js";
import { mapRowToObject, hasValidLatLongValues, isValidRow, validateAllRows } from "../src/logic/validation.js";

const NO_INPUT = "--";
const FULL_HEADERS = ["Name", "Street Address", "City", "State", "Zip", "Lat", "Lng", "Country", "Phone", "NAICS", "Website", "StoreID", "MCC"];

function buildMappings(colsHeader, overrides = {}) {
  const base = {
    location_name: "Name",
    street_address: "Street Address",
    city: "City",
    region: "State",
    postal_code: "Zip",
    latitude: "Lat",
    longitude: "Lng",
    iso_country_code: "Country",
    store_id: NO_INPUT,
    phone_number: NO_INPUT,
    website: NO_INPUT,
    naics_code: NO_INPUT,
    mcc_code: NO_INPUT,
    ...overrides,
  };
  return transformColumnMappings(base, colsHeader);
}

describe("transformColumnMappings edge cases", () => {
  it("returns rowIndex -1 when column not found in header", () => {
    const result = transformColumnMappings({ city: "NonExistent" }, ["Name", "Street"]);
    expect(result.city.rowIndex).toBe(-1);
    expect(result.city.columnNumber).toBe(0);
  });

  it("uses first occurrence when duplicate column names exist", () => {
    const result = transformColumnMappings({ city: "City" }, ["City", "Other", "City"]);
    expect(result.city.rowIndex).toBe(0);
  });

  it("handles all fields unmapped", () => {
    const result = transformColumnMappings({ location_name: NO_INPUT, city: NO_INPUT, region: NO_INPUT }, ["Name", "City"]);
    expect(result.location_name).toBe(NO_INPUT);
    expect(result.city).toBe(NO_INPUT);
    expect(result.region).toBe(NO_INPUT);
  });
});

describe("mapRowToObject edge cases", () => {
  it("returns undefined for fields when row is shorter than expected index", () => {
    const mappings = buildMappings(FULL_HEADERS);
    const shortRow = ["Name", "Street", "City"];
    const result = mapRowToObject(shortRow, mappings);
    expect(result.location_name).toBe("Name");
    expect(result.region).toBeUndefined();
    expect(result.latitude).toBeUndefined();
  });
});

describe("hasValidLatLongValues edge cases", () => {
  it("returns false for empty string latitude", () => {
    expect(hasValidLatLongValues({ latitude: "" }, ["latitude"])).toBe(false);
  });

  it("returns false for whitespace-only values", () => {
    expect(hasValidLatLongValues({ latitude: "   " }, ["latitude"])).toBe(false);
  });

  it("handles scientific notation as valid", () => {
    expect(hasValidLatLongValues({ latitude: "3.7e1", longitude: "-1.22e2" }, ["latitude", "longitude"])).toBe(true);
  });

  it("checks only fields present in keysWithValues", () => {
    const obj = { latitude: "37.7", longitude: "bad" };
    expect(hasValidLatLongValues(obj, ["latitude"])).toBe(true);
  });
});

describe("isValidRow edge cases", () => {
  let mappings;
  beforeAll(() => {
    mappings = buildMappings(FULL_HEADERS);
  });

  it("invalid: only latitude provided (no longitude)", () => {
    const row = ["", "", "", "", "", "37.7", "", "", "", "", "", "", ""];
    const result = isValidRow(row, mappings);
    expect(result.isValid).toBe(false);
  });

  it("invalid: only longitude provided (no latitude)", () => {
    const row = ["", "", "", "", "", "", "-122.4", "", "", "", "", "", ""];
    const result = isValidRow(row, mappings);
    expect(result.isValid).toBe(false);
  });

  it("valid: lat+long plus location name (lat+long sufficient)", () => {
    const row = ["Shop", "", "", "", "", "37.7", "-122.4", "", "", "", "", "", ""];
    const result = isValidRow(row, mappings);
    expect(result.isValid).toBe(true);
  });

  it("invalid: bad lat/long + street+city+region but country unmapped (no silent US default)", () => {
    // v1.1.1 removes the "iso_country_code defaults to US" behavior, so any
    // address-based minimum-input set that requires country now fails
    // without an explicit country mapping. Previously this row passed.
    const noCountryMappings = buildMappings(FULL_HEADERS, { iso_country_code: NO_INPUT });
    const row = ["", "123 Main", "NYC", "NY", "", "bad", "bad", "", "", "", "", "", ""];
    const result = isValidRow(row, noCountryMappings);
    expect(result.isValid).toBe(false);
    expect(result.message).toContain("minimum input");
  });

  it("invalid: iso_country_code only value when mapped", () => {
    const row = ["", "", "", "", "", "", "", "UK", "", "", "", "", ""];
    const result = isValidRow(row, mappings);
    expect(result.isValid).toBe(false);
    expect(result.message).toContain("no values");
  });
});

describe("validateAllRows edge cases", () => {
  let mappings;
  beforeAll(() => {
    mappings = buildMappings(FULL_HEADERS);
  });

  it("handles empty input array", () => {
    const result = validateAllRows([], mappings, true);
    expect(result.sortedValidIndexes).toEqual([]);
    expect(result.sortedInvalidIndexes).toEqual([]);
    expect(Object.keys(result.validRows)).toHaveLength(0);
    expect(Object.keys(result.errorRows)).toHaveLength(0);
  });

  it("single valid row", () => {
    const rows = [["", "", "", "", "", "37.7", "-122.4", "", "", "", "", "", ""]];
    const result = validateAllRows(rows, mappings, true);
    expect(result.sortedValidIndexes).toEqual([0]);
  });

  it("single non-empty invalid row with insertError collects error", () => {
    const rows = [["Shop", "", "", "", "", "", "", "", "", "", "", "", ""]];
    const result = validateAllRows(rows, mappings, true);
    expect(result.sortedInvalidIndexes).toEqual([0]);
    expect(result.errorRows[0]).toContain("minimum input");
  });

  it("preserves original row indexes (not re-indexed)", () => {
    const rows = [
      ["", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "37.7", "-122.4", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "40.7", "-74.0", "", "", "", "", "", ""],
    ];
    const result = validateAllRows(rows, mappings, false);
    expect(result.sortedValidIndexes).toEqual([1, 3]);
  });
});

describe("prepareOutputFields edge cases", () => {
  it("returns empty object for empty field names", () => {
    const fields = prepareOutputFields([], ["Name"]);
    expect(Object.keys(fields)).toHaveLength(0);
  });

  it("formats single-word field name", () => {
    const fields = prepareOutputFields(["placekey"], []);
    expect(fields.placekey.displayName).toBe("Placekey");
  });

  it("formats placekey_error correctly", () => {
    const fields = prepareOutputFields(["placekey_error"], []);
    expect(fields.placekey_error.displayName).toBe("Placekey Error");
  });

  it("handles geocode sub-fields", () => {
    const fields = prepareOutputFields(["geocode_latitude", "geocode_longitude", "geocode_precision"], []);
    expect(fields.geocode_latitude.displayName).toBe("Geocode Latitude");
    expect(fields.geocode_longitude.displayName).toBe("Geocode Longitude");
    expect(fields.geocode_precision.displayName).toBe("Geocode Precision");
    expect(fields.geocode_latitude.columnIndex).toBe(0);
    expect(fields.geocode_longitude.columnIndex).toBe(1);
    expect(fields.geocode_precision.columnIndex).toBe(2);
  });

  it("reuses multiple existing columns without gaps", () => {
    const fields = prepareOutputFields(["placekey", "gers"], ["Name", "Gers", "Street", "Placekey"]);
    expect(fields.placekey.columnIndex).toBe(3);
    expect(fields.gers.columnIndex).toBe(1);
  });

  it("ignores trailing empty headers when appending new fields", () => {
    const fields = prepareOutputFields(["placekey"], ["Name", "Street", "", "", ""]);
    expect(fields.placekey.columnIndex).toBe(2);
  });

  it("trims many trailing empty headers", () => {
    const fields = prepareOutputFields(["placekey", "gers"], ["A", "B", "", "", "", "", ""]);
    expect(fields.placekey.columnIndex).toBe(2);
    expect(fields.gers.columnIndex).toBe(3);
  });

  it("still reuses a matching header that sits before trailing empties", () => {
    const fields = prepareOutputFields(["placekey", "gers"], ["A", "Placekey", "", "", ""]);
    expect(fields.placekey.columnIndex).toBe(1);
    expect(fields.gers.columnIndex).toBe(2);
  });
});
