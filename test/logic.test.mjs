import { describe, it, expect, beforeAll } from "vitest";
import { transformColumnMappings, prepareOutputFields, processBatchResponse } from "../src/logic/transform.js";
import { mapRowToObject, hasValidLatLongValues, isValidRow, validateAllRows } from "../src/logic/validation.js";
import { ERROR_KEY } from "../src/logic/constants.js";

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

describe("transformColumnMappings", () => {
  it("transforms mapped fields to objects with column positions", () => {
    const result = transformColumnMappings({ location_name: "Name", city: "City" }, ["Name", "Street", "City"]);

    expect(result.location_name).toEqual({
      columnName: "Name",
      columnNumber: 1,
      rowIndex: 0,
    });
    expect(result.city).toEqual({
      columnName: "City",
      columnNumber: 3,
      rowIndex: 2,
    });
  });

  it("preserves NO_INPUT_STRING for unmapped fields", () => {
    const result = transformColumnMappings({ location_name: NO_INPUT, city: "City" }, ["City"]);

    expect(result.location_name).toBe(NO_INPUT);
    expect(result.city.rowIndex).toBe(0);
  });
});

describe("mapRowToObject", () => {
  it("maps a complete row with real location data", () => {
    const mappings = buildMappings(FULL_HEADERS);
    const row = ["Twin Peaks Petroleum", "598 Portola Dr", "San Francisco", "CA", "94131", "37.7371", "-122.44283", "US", "", "", "", "", ""];
    const result = mapRowToObject(row, mappings);

    expect(result.location_name).toBe("Twin Peaks Petroleum");
    expect(result.street_address).toBe("598 Portola Dr");
    expect(result.city).toBe("San Francisco");
    expect(result.region).toBe("CA");
    expect(result.postal_code).toBe("94131");
    expect(result.latitude).toBe("37.7371");
    expect(result.longitude).toBe("-122.44283");
    expect(result.iso_country_code).toBe("US");
  });

  it("returns empty strings for unmapped fields", () => {
    const mappings = buildMappings(FULL_HEADERS, {
      location_name: NO_INPUT,
      latitude: NO_INPUT,
      longitude: NO_INPUT,
    });
    const row = ["Twin Peaks Petroleum", "598 Portola Dr", "San Francisco", "CA", "94131", "37.7371", "-122.44283", "US", "", "", "", "", ""];
    const result = mapRowToObject(row, mappings);

    expect(result.location_name).toBe("");
    expect(result.latitude).toBe("");
    expect(result.longitude).toBe("");
    expect(result.street_address).toBe("598 Portola Dr");
  });

  it("leaves iso_country_code empty when unmapped (no silent default)", () => {
    // v1.1.1: previously defaulted to "US", which silently produced wrong
    // Placekeys for international data. Now the user must map a Country
    // column — failing rows land in the error column with a clear message.
    const mappings = buildMappings(FULL_HEADERS, { iso_country_code: NO_INPUT });
    const row = ["", "598 Portola Dr", "San Francisco", "CA", "94131", "", "", "", "", "", "", "", ""];
    const result = mapRowToObject(row, mappings);

    expect(result.iso_country_code).toBe("");
  });

  it("maps metadata fields correctly", () => {
    const mappings = buildMappings(FULL_HEADERS, {
      phone_number: "Phone",
      naics_code: "NAICS",
      website: "Website",
      store_id: "StoreID",
      mcc_code: "MCC",
    });
    const row = ["Shop", "123 Main St", "NYC", "NY", "10001", "", "", "US", "5551234567", "712120", "example.com", "S001", "9399"];
    const result = mapRowToObject(row, mappings);

    expect(result.place_metadata.phone_number).toBe("5551234567");
    expect(result.place_metadata.naics_code).toBe("712120");
    expect(result.place_metadata.website).toBe("example.com");
    expect(result.place_metadata.store_id).toBe("S001");
    expect(result.place_metadata.mcc_code).toBe("9399");
  });
});

describe("hasValidLatLongValues", () => {
  it("returns true for valid numeric lat/long", () => {
    const obj = { latitude: "37.7371", longitude: "-122.44283" };
    expect(hasValidLatLongValues(obj, ["latitude", "longitude"])).toBe(true);
  });

  it("returns false for non-numeric latitude", () => {
    const obj = { latitude: "not-a-number", longitude: "-122.44283" };
    expect(hasValidLatLongValues(obj, ["latitude", "longitude"])).toBe(false);
  });

  it("returns false for non-numeric longitude", () => {
    const obj = { latitude: "37.7371", longitude: "abc" };
    expect(hasValidLatLongValues(obj, ["latitude", "longitude"])).toBe(false);
  });

  it("returns true when lat/long not in keysWithValues", () => {
    const obj = { latitude: "bad", longitude: "bad" };
    expect(hasValidLatLongValues(obj, ["city", "region"])).toBe(true);
  });

  it("handles zero as valid", () => {
    const obj = { latitude: "0", longitude: "0" };
    expect(hasValidLatLongValues(obj, ["latitude", "longitude"])).toBe(true);
  });

  it("handles negative values", () => {
    const obj = { latitude: "-33.8688", longitude: "151.2093" };
    expect(hasValidLatLongValues(obj, ["latitude", "longitude"])).toBe(true);
  });
});

describe("isValidRow", () => {
  let mappings;
  beforeAll(() => {
    mappings = buildMappings(FULL_HEADERS);
  });

  it("valid: lat/long only", () => {
    const row = ["", "", "", "", "", "37.7371", "-122.44283", "", "", "", "", "", ""];
    const result = isValidRow(row, mappings);
    expect(result.isValid).toBe(true);
  });

  it("valid: full address (street, city, region, postal, country)", () => {
    const row = ["Beretta", "1199 Valencia St", "San Francisco", "CA", "94110", "", "", "US", "", "", "", "", ""];
    const result = isValidRow(row, mappings);
    expect(result.isValid).toBe(true);
  });

  it("valid: street, region, postal, country (no city)", () => {
    const row = ["", "1 Doyers St", "", "NY", "10013", "", "", "US", "", "", "", "", ""];
    const result = isValidRow(row, mappings);
    expect(result.isValid).toBe(true);
  });

  it("valid: street, city, region, country (no postal)", () => {
    const row = ["", "1 Doyers St", "New York", "NY", "", "", "", "US", "", "", "", "", ""];
    const result = isValidRow(row, mappings);
    expect(result.isValid).toBe(true);
  });

  it("valid: all fields populated", () => {
    const row = ["Twin Peaks Petroleum", "598 Portola Dr", "San Francisco", "CA", "94131", "37.7371", "-122.44283", "US", "", "", "", "", ""];
    const result = isValidRow(row, mappings);
    expect(result.isValid).toBe(true);
  });

  it("invalid: completely empty row", () => {
    const row = ["", "", "", "", "", "", "", "", "", "", "", "", ""];
    const result = isValidRow(row, mappings);
    expect(result.isValid).toBe(false);
    expect(result.message).toContain("no values");
  });

  it("invalid: country unmapped + empty row (no silent US default)", () => {
    const mappingsNoCountry = buildMappings(FULL_HEADERS, { iso_country_code: NO_INPUT });
    const row = ["", "", "", "", "", "", "", "", "", "", "", "", ""];
    const result = isValidRow(row, mappingsNoCountry);
    expect(result.isValid).toBe(false);
    expect(result.row.iso_country_code).toBe("");
  });

  it("invalid: non-US address with country unmapped (previously silently sent as US)", () => {
    // A Calgary row with lat/long would still pass via the lat/long input set.
    // But when lat/long is absent, the address-based sets require iso_country_code,
    // so without a mapped country the row now fails validation explicitly rather
    // than being silently dispatched to the API as "Calgary, Alberta, US".
    const mappingsNoCountry = buildMappings(FULL_HEADERS, { iso_country_code: NO_INPUT });
    const row = ["", "73 Sora Gardens SE", "Calgary", "Alberta", "T3S0V3", "", "", "", "", "", "", "", ""];
    const result = isValidRow(row, mappingsNoCountry);
    expect(result.isValid).toBe(false);
    expect(result.message).toContain("minimum input");
  });

  it("invalid: only location name (insufficient fields)", () => {
    const row = ["Twin Peaks Petroleum", "", "", "", "", "", "", "", "", "", "", "", ""];
    const result = isValidRow(row, mappings);
    expect(result.isValid).toBe(false);
    expect(result.message).toContain("minimum input");
  });

  it("invalid: non-numeric lat/long with no other address fields", () => {
    const row = ["", "", "", "", "", "bad-lat", "bad-lng", "", "", "", "", "", ""];
    const result = isValidRow(row, mappings);
    expect(result.isValid).toBe(false);
    expect(result.message).toContain("latitude or longitude");
  });

  it("valid: non-numeric lat/long dropped when other address fields sufficient", () => {
    const row = ["Beretta", "1199 Valencia St", "San Francisco", "CA", "94110", "bad", "bad", "US", "", "", "", "", ""];
    const result = isValidRow(row, mappings);
    expect(result.isValid).toBe(true);
    expect(result.row.latitude).toBeUndefined();
    expect(result.row.longitude).toBeUndefined();
  });

  it("invalid: street only (no city, region, postal, or lat/long)", () => {
    const row = ["", "598 Portola Dr", "", "", "", "", "", "", "", "", "", "", ""];
    const result = isValidRow(row, mappings);
    expect(result.isValid).toBe(false);
  });
});

describe("validateAllRows", () => {
  let mappings;
  beforeAll(() => {
    mappings = buildMappings(FULL_HEADERS);
  });

  const sampleRows = [
    ["Twin Peaks Petroleum", "598 Portola Dr", "San Francisco", "CA", "94131", "37.7371", "-122.44283", "US", "", "", "", "", ""],
    ["", "", "", "", "", "37.7371", "-122.44283", "", "", "", "", "", ""],
    ["Beretta", "1199 Valencia St", "San Francisco", "CA", "94110", "", "", "US", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "only street", "", "", "", "", "", "", "", "", "", "", ""],
  ];

  it("separates valid and invalid rows", () => {
    const result = validateAllRows(sampleRows, mappings, true);

    expect(result.sortedValidIndexes).toEqual([0, 1, 2]);
    expect(Object.keys(result.validRows)).toHaveLength(3);
  });

  it("collects error rows when insertError is true", () => {
    const result = validateAllRows(sampleRows, mappings, true);

    expect(result.sortedInvalidIndexes).toEqual([4]);
    expect(result.errorRows[4]).toContain("minimum input");
  });

  it("does not collect error rows when insertError is false", () => {
    const result = validateAllRows(sampleRows, mappings, false);

    expect(result.sortedInvalidIndexes).toEqual([]);
    expect(Object.keys(result.errorRows)).toHaveLength(0);
  });

  it("does not collect empty row errors even with insertError", () => {
    const result = validateAllRows(sampleRows, mappings, true);

    expect(result.errorRows[3]).toBeUndefined();
  });

  it("returns sorted indexes", () => {
    const result = validateAllRows(sampleRows, mappings, false);

    expect(result.sortedValidIndexes).toEqual([0, 1, 2]);
    for (let i = 1; i < result.sortedValidIndexes.length; i++) {
      expect(result.sortedValidIndexes[i]).toBeGreaterThan(result.sortedValidIndexes[i - 1]);
    }
  });

  it("handles all-valid input", () => {
    const allValid = [sampleRows[0], sampleRows[1], sampleRows[2]];
    const result = validateAllRows(allValid, mappings, true);

    expect(result.sortedValidIndexes).toEqual([0, 1, 2]);
    expect(result.sortedInvalidIndexes).toEqual([]);
  });

  it("handles all-invalid input", () => {
    const allInvalid = [sampleRows[3], sampleRows[4]];
    const result = validateAllRows(allInvalid, mappings, true);

    expect(result.sortedValidIndexes).toEqual([]);
    expect(Object.keys(result.validRows)).toHaveLength(0);
  });
});

describe("prepareOutputFields", () => {
  it("appends new fields after existing columns", () => {
    const fields = prepareOutputFields(["placekey", "confidence_score"], ["Name", "Street"]);

    expect(fields.placekey.columnIndex).toBe(2);
    expect(fields.confidence_score.columnIndex).toBe(3);
  });

  it("reuses existing column position (case-insensitive)", () => {
    const fields = prepareOutputFields(["placekey"], ["Name", "Street", "Placekey"]);

    expect(fields.placekey.columnIndex).toBe(2);
  });

  it("is case-insensitive when matching existing columns", () => {
    const fields = prepareOutputFields(["placekey"], ["Name", "PLACEKEY"]);

    expect(fields.placekey.columnIndex).toBe(1);
  });

  it("skips geocode field name", () => {
    const fields = prepareOutputFields(["placekey", "geocode", "confidence_score"], ["Name"]);

    expect(fields.geocode).toBeUndefined();
    expect(fields.placekey).toBeDefined();
    expect(fields.confidence_score).toBeDefined();
  });

  it("formats display names from snake_case to Title Case", () => {
    const fields = prepareOutputFields(["confidence_score", "address_placekey"], []);

    expect(fields.confidence_score.displayName).toBe("Confidence Score");
    expect(fields.address_placekey.displayName).toBe("Address Placekey");
  });

  it("does not create gaps when reusing existing columns", () => {
    const fields = prepareOutputFields(["placekey", "confidence_score", "gers"], ["Name", "Placekey"]);

    expect(fields.placekey.columnIndex).toBe(1);
    expect(fields.confidence_score.columnIndex).toBe(2);
    expect(fields.gers.columnIndex).toBe(3);
  });
});

describe("processBatchResponse", () => {
  const fields = {
    placekey: { columnIndex: 5 },
    confidence_score: { columnIndex: 6 },
    geocode_latitude: { columnIndex: 7 },
    geocode_longitude: { columnIndex: 8 },
    geocode_precision: { columnIndex: 9 },
    [ERROR_KEY]: { columnIndex: 10 },
  };
  const indexes = [0, 1, 2];

  it("maps response fields to batchResults keyed by row index", () => {
    const json = [
      { query_id: "0", placekey: "22z@5qt-39h-5vf", confidence_score: "HIGH" },
      { query_id: "1", placekey: "238@5qv-x2t-789", confidence_score: "HIGH" },
      { query_id: "2", placekey: "22s@8fc-fc6-fvf", confidence_score: "MEDIUM" },
    ];
    const result = processBatchResponse(json, indexes, fields, false);
    expect(result.placekey).toEqual({ 0: "22z@5qt-39h-5vf", 1: "238@5qv-x2t-789", 2: "22s@8fc-fc6-fvf" });
    expect(result.confidence_score).toEqual({ 0: "HIGH", 1: "HIGH", 2: "MEDIUM" });
    expect(Object.keys(result[ERROR_KEY])).toHaveLength(0);
  });

  it("unpacks the nested geocode object into three separate fields", () => {
    const json = [{ query_id: "0", placekey: "p", geocode: { location: { lat: 37.7, lng: -122.4 }, location_type: "ROOFTOP" } }];
    const result = processBatchResponse(json, [0], fields, false);
    expect(result.geocode_latitude[0]).toBe(37.7);
    expect(result.geocode_longitude[0]).toBe(-122.4);
    expect(result.geocode_precision[0]).toBe("ROOFTOP");
  });

  it("writes an error-column entry when the API reply is missing for a row", () => {
    const json = [{ query_id: "0", placekey: "ok1" }, undefined, { query_id: "2", placekey: "ok2" }];
    const result = processBatchResponse(json, indexes, fields, true);
    expect(result.placekey).toEqual({ 0: "ok1", 2: "ok2" });
    expect(result[ERROR_KEY][1]).toContain("No response");
    expect(result[ERROR_KEY][0]).toBeUndefined();
    expect(result[ERROR_KEY][2]).toBeUndefined();
  });

  it("surfaces an explicit per-row error string from the API", () => {
    const json = [
      { query_id: "0", placekey: "ok" },
      { query_id: "1", placekey: null, error: "Address could not be validated" },
    ];
    const result = processBatchResponse(json, [0, 1], fields, true);
    expect(result.placekey[0]).toBe("ok");
    expect(result[ERROR_KEY][1]).toBe("Address could not be validated");
  });

  it("writes a 'no Placekey determined' note when placekey is null/missing and no explicit error", () => {
    // This is the Calgary case: valid lat/long sent as address, API returns
    // no Placekey and no explicit error — we must still flag it.
    const json = [
      { query_id: "0", placekey: "ok", confidence_score: "HIGH" },
      { query_id: "1", placekey: null, confidence_score: null },
      { query_id: "2", placekey: "", confidence_score: "" },
    ];
    const result = processBatchResponse(json, indexes, fields, true);
    expect(result.placekey[0]).toBe("ok");
    expect(result[ERROR_KEY][1]).toContain("No Placekey could be determined");
    expect(result[ERROR_KEY][2]).toContain("No Placekey could be determined");
    expect(result[ERROR_KEY][0]).toBeUndefined();
  });

  it("prefers the explicit API error over the generic 'no Placekey' fallback", () => {
    const json = [{ query_id: "0", placekey: null, error: "Quota exceeded" }];
    const result = processBatchResponse(json, [0], fields, true);
    expect(result[ERROR_KEY][0]).toBe("Quota exceeded");
  });

  it("does not write error-column entries when insertError is false", () => {
    const json = [undefined, { query_id: "1", placekey: null, error: "bad" }];
    const fieldsNoError = { placekey: { columnIndex: 5 } };
    const result = processBatchResponse(json, [0, 1], fieldsNoError, false);
    expect(result[ERROR_KEY]).toBeUndefined();
    expect(result.placekey[0]).toBeUndefined();
    expect(result.placekey[1]).toBe("");
  });

  it("stringifies a non-string error object so the cell gets something useful", () => {
    const json = [{ query_id: "0", placekey: null, error: { code: 42, message: "bad" } }];
    const result = processBatchResponse(json, [0], fields, true);
    expect(result[ERROR_KEY][0]).toContain("code");
    expect(result[ERROR_KEY][0]).toContain("bad");
  });

  it("ignores the query_id field (never written to output)", () => {
    const json = [{ query_id: "not-a-column", placekey: "ok" }];
    const result = processBatchResponse(json, [0], fields, false);
    expect(result.query_id).toBeUndefined();
  });
});
