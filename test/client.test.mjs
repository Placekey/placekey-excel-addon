// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { computeAutomap } from "../src/logic/automap.js";
import { editDistance } from "../src/logic/edit-distance.js";
import { minimumInputProvided, hasDuplicateMappings, isValidRow } from "../src/logic/validation.js";
import { transformColumnMappings } from "../src/logic/transform.js";
import { escapeHtml, buildSheetOptions, buildColumnOptions } from "../src/logic/html-helpers.js";

describe("minimumInputProvided", () => {
  it("returns true for lat+long", () => {
    expect(minimumInputProvided({ latitude: "Lat", longitude: "Lng", city: "--", region: "--", street_address: "--", postal_code: "--", iso_country_code: "--" })).toBe(true);
  });

  it("returns true for street+city+region+postal+country", () => {
    expect(
      minimumInputProvided({
        latitude: "--",
        longitude: "--",
        street_address: "Street",
        city: "City",
        region: "State",
        postal_code: "Zip",
        iso_country_code: "Country",
      }),
    ).toBe(true);
  });

  it("returns true for street+region+postal+country (no city)", () => {
    expect(
      minimumInputProvided({
        latitude: "--",
        longitude: "--",
        street_address: "Street",
        city: "--",
        region: "State",
        postal_code: "Zip",
        iso_country_code: "Country",
      }),
    ).toBe(true);
  });

  it("returns true for street+city+region+country (no postal)", () => {
    expect(
      minimumInputProvided({
        latitude: "--",
        longitude: "--",
        street_address: "Street",
        city: "City",
        region: "State",
        postal_code: "--",
        iso_country_code: "Country",
      }),
    ).toBe(true);
  });

  it("returns false when nothing mapped", () => {
    expect(
      minimumInputProvided({
        latitude: "--",
        longitude: "--",
        street_address: "--",
        city: "--",
        region: "--",
        postal_code: "--",
        iso_country_code: "--",
      }),
    ).toBe(false);
  });

  it("returns false for only latitude (no longitude)", () => {
    expect(minimumInputProvided({ latitude: "Lat", longitude: "--", street_address: "--", city: "--", region: "--", postal_code: "--", iso_country_code: "--" })).toBe(false);
  });

  it("returns false for street+city only (insufficient)", () => {
    expect(
      minimumInputProvided({
        latitude: "--",
        longitude: "--",
        street_address: "Street",
        city: "City",
        region: "--",
        postal_code: "--",
        iso_country_code: "--",
      }),
    ).toBe(false);
  });
});

describe("hasDuplicateMappings", () => {
  it("returns false when no duplicates", () => {
    expect(hasDuplicateMappings({ a: "Col1", b: "Col2", c: "--" })).toBe(false);
  });

  it("returns true when two fields map to same column", () => {
    expect(hasDuplicateMappings({ a: "Col1", b: "Col1", c: "--" })).toBe(true);
  });

  it("returns false when all unmapped", () => {
    expect(hasDuplicateMappings({ a: "--", b: "--", c: "--" })).toBe(false);
  });

  it("returns false for single mapped field", () => {
    expect(hasDuplicateMappings({ a: "Col1", b: "--" })).toBe(false);
  });

  it("detects duplicates among many fields", () => {
    expect(hasDuplicateMappings({ a: "A", b: "B", c: "C", d: "B", e: "--" })).toBe(true);
  });
});

describe("escapeHtml", () => {
  it("returns normal strings unchanged", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World");
  });

  it("escapes < and > (prevents tag injection)", () => {
    const result = escapeHtml("<script>alert('xss')</script>");
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("escapes &", () => {
    expect(escapeHtml("A & B")).toContain("&amp;");
  });

  it('escapes double quotes to prevent breakout from value="..." attributes', () => {
    const result = escapeHtml('value="injected"');
    expect(result).not.toContain('"');
    expect(result).toContain("&quot;");
  });

  it("escapes a payload that would break out of an option value attribute", () => {
    const hostile = '" onmouseover="alert(1)';
    const html = `<option value="${escapeHtml(hostile)}">x</option>`;
    expect(html).not.toMatch(/value="".*onmouseover/);
    expect(html).toContain("&quot;");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("handles string with only special characters", () => {
    const result = escapeHtml('<>&"');
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
  });
});

describe("buildSheetOptions", () => {
  it("marks active sheet as selected", () => {
    const html = buildSheetOptions(["Sheet1", "Sheet2"], "Sheet1");
    expect(html).toContain('value="Sheet1" selected');
    expect(html).not.toContain('value="Sheet2" selected');
  });

  it("produces option tags for all sheets", () => {
    const html = buildSheetOptions(["A", "B", "C"], "B");
    expect(html).toContain("A</option>");
    expect(html).toContain("B</option>");
    expect(html).toContain("C</option>");
  });

  it("escapes HTML in sheet names", () => {
    const html = buildSheetOptions(["<img src=x onerror=alert(1)>"], "other");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("returns empty string for empty array", () => {
    expect(buildSheetOptions([], "Sheet1")).toBe("");
  });
});

describe("buildColumnOptions", () => {
  it("starts with default 'none' option", () => {
    const html = buildColumnOptions(["Col1"]);
    expect(html.startsWith('<option value="--">')).toBe(true);
    expect(html).toContain('value="--"');
  });

  it("includes non-empty column names", () => {
    const html = buildColumnOptions(["Name", "Street", "City"]);
    expect(html).toContain("Name</option>");
    expect(html).toContain("Street</option>");
    expect(html).toContain("City</option>");
  });

  it("skips empty strings", () => {
    const html = buildColumnOptions(["Name", "", "City"]);
    const optionCount = (html.match(/<option/g) || []).length;
    expect(optionCount).toBe(3);
  });

  it("escapes HTML in column names", () => {
    const html = buildColumnOptions(["<script>evil</script>"]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("returns only default option for empty array", () => {
    const html = buildColumnOptions([]);
    expect(html).toMatch(/^<option value="--">.*<\/option>$/);
    expect((html.match(/<option/g) || []).length).toBe(1);
  });
});

describe("computeAutomap", () => {
  it("maps the exact sample data headers correctly", () => {
    const headers = ["Name", "Street Address", "City", "State", "Zip code", "Latitude", "Longitude", "Country"];
    const result = computeAutomap(headers);
    expect(result.location_name).toBe("Name");
    expect(result.street_address).toBe("Street Address");
    expect(result.city).toBe("City");
    expect(result.region).toBe("State");
    expect(result.postal_code).toBe("Zip code");
    expect(result.latitude).toBe("Latitude");
    expect(result.longitude).toBe("Longitude");
    expect(result.iso_country_code).toBe("Country");
  });

  it("is case-insensitive", () => {
    const result = computeAutomap(["NAME", "street address", "City"]);
    expect(result.location_name).toBe("NAME");
    expect(result.street_address).toBe("street address");
    expect(result.city).toBe("City");
  });

  it("trims whitespace", () => {
    const result = computeAutomap(["  Name  ", "  City  "]);
    expect(result.location_name).toBe("  Name  ");
    expect(result.city).toBe("  City  ");
  });

  it("recognizes common abbreviations", () => {
    const result = computeAutomap(["Lat", "Lng", "Zip"]);
    expect(result.latitude).toBe("Lat");
    expect(result.longitude).toBe("Lng");
    expect(result.postal_code).toBe("Zip");
  });

  it("maps metadata headers", () => {
    const result = computeAutomap(["Phone", "NAICS", "Website", "Store ID", "MCC"]);
    expect(result.phone_number).toBe("Phone");
    expect(result.naics_code).toBe("NAICS");
    expect(result.website).toBe("Website");
    expect(result.store_id).toBe("Store ID");
    expect(result.mcc_code).toBe("MCC");
  });

  it("skips empty header strings", () => {
    const result = computeAutomap(["Name", "", "City"]);
    expect(result.location_name).toBe("Name");
    expect(result.city).toBe("City");
  });

  it("returns empty object when no headers match", () => {
    const result = computeAutomap(["Foo", "Bar", "Baz"]);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("first match wins when multiple headers map to the same field", () => {
    const result = computeAutomap(["Name", "Business Name"]);
    expect(result.location_name).toBe("Name");
  });

  it("handles empty array", () => {
    const result = computeAutomap([]);
    expect(result).toEqual({});
  });

  it("learned aliases map custom headers to fields", () => {
    const learned = { locationn: "location_name", bizstreet: "street_address" };
    const result = computeAutomap(["Location_N", "Biz_Street", "City"], learned);
    expect(result.location_name).toBe("Location_N");
    expect(result.street_address).toBe("Biz_Street");
    expect(result.city).toBe("City");
  });

  it("learned aliases take priority over built-in aliases", () => {
    const learned = { name: "store_id" };
    const result = computeAutomap(["Name"], learned);
    expect(result.store_id).toBe("Name");
    expect(result.location_name).toBeUndefined();
  });

  it("built-in aliases still work when learned aliases is empty", () => {
    const result = computeAutomap(["Name", "City"], {});
    expect(result.location_name).toBe("Name");
    expect(result.city).toBe("City");
  });

  it("learned aliases match across delimiter variants", () => {
    const learned = { locationn: "location_name" };
    expect(computeAutomap(["Location_N"], learned).location_name).toBe("Location_N");
    expect(computeAutomap(["Location N"], learned).location_name).toBe("Location N");
    expect(computeAutomap(["location-n"], learned).location_name).toBe("location-n");
    expect(computeAutomap(["LOCATIONN"], learned).location_name).toBe("LOCATIONN");
  });

  it("built-in aliases match across delimiter variants", () => {
    expect(computeAutomap(["Store ID"]).store_id).toBe("Store ID");
    expect(computeAutomap(["store_id"]).store_id).toBe("store_id");
    expect(computeAutomap(["store-id"]).store_id).toBe("store-id");
    expect(computeAutomap(["StoreID"]).store_id).toBe("StoreID");
  });

  it("recognizes expanded vocabulary for location_name", () => {
    expect(computeAutomap(["Business Name"]).location_name).toBe("Business Name");
    expect(computeAutomap(["Company"]).location_name).toBe("Company");
    expect(computeAutomap(["DBA"]).location_name).toBe("DBA");
    expect(computeAutomap(["Venue"]).location_name).toBe("Venue");
    expect(computeAutomap(["Place Name"]).location_name).toBe("Place Name");
  });

  it("recognizes expanded vocabulary for addresses and regions", () => {
    expect(computeAutomap(["Address Line 1"]).street_address).toBe("Address Line 1");
    expect(computeAutomap(["Street 1"]).street_address).toBe("Street 1");
    expect(computeAutomap(["Line 1"]).street_address).toBe("Line 1");
    expect(computeAutomap(["Locality"]).city).toBe("Locality");
    expect(computeAutomap(["Province"]).region).toBe("Province");
    expect(computeAutomap(["State Code"]).region).toBe("State Code");
  });

  it("recognizes expanded vocabulary for coordinates", () => {
    expect(computeAutomap(["Y"]).latitude).toBe("Y");
    expect(computeAutomap(["X"]).longitude).toBe("X");
    expect(computeAutomap(["Lat_DD"]).latitude).toBe("Lat_DD");
    expect(computeAutomap(["YCoord"]).latitude).toBe("YCoord");
  });

  it("recognizes expanded vocabulary for country codes", () => {
    expect(computeAutomap(["Country Code"]).iso_country_code).toBe("Country Code");
    expect(computeAutomap(["ISO2"]).iso_country_code).toBe("ISO2");
    expect(computeAutomap(["CC"]).iso_country_code).toBe("CC");
    expect(computeAutomap(["Nation"]).iso_country_code).toBe("Nation");
  });

  it("recognizes expanded vocabulary for metadata fields", () => {
    expect(computeAutomap(["Mobile"]).phone_number).toBe("Mobile");
    expect(computeAutomap(["Contact Number"]).phone_number).toBe("Contact Number");
    expect(computeAutomap(["Store Number"]).store_id).toBe("Store Number");
    expect(computeAutomap(["Site ID"]).store_id).toBe("Site ID");
    expect(computeAutomap(["Branch ID"]).store_id).toBe("Branch ID");
    expect(computeAutomap(["Domain"]).website).toBe("Domain");
    expect(computeAutomap(["Merchant Category"]).mcc_code).toBe("Merchant Category");
  });

  it("maps a typical US headers row", () => {
    const headers = ["Business Name", "Street Address", "City", "State", "ZIP Code", "Country"];
    const result = computeAutomap(headers);
    expect(result.location_name).toBe("Business Name");
    expect(result.street_address).toBe("Street Address");
    expect(result.city).toBe("City");
    expect(result.region).toBe("State");
    expect(result.postal_code).toBe("ZIP Code");
    expect(result.iso_country_code).toBe("Country");
  });

  it("maps a typical Canadian headers row", () => {
    const headers = ["Company", "Street", "City", "Province", "Postal Code", "Country Code"];
    const result = computeAutomap(headers);
    expect(result.location_name).toBe("Company");
    expect(result.street_address).toBe("Street");
    expect(result.city).toBe("City");
    expect(result.region).toBe("Province");
    expect(result.postal_code).toBe("Postal Code");
    expect(result.iso_country_code).toBe("Country Code");
  });

  it("maps a typical UK headers row", () => {
    const headers = ["Business", "Address Line 1", "Town", "County", "Postcode", "Country"];
    const result = computeAutomap(headers);
    expect(result.location_name).toBe("Business");
    expect(result.street_address).toBe("Address Line 1");
    expect(result.city).toBe("Town");
    expect(result.region).toBe("County");
    expect(result.postal_code).toBe("Postcode");
    expect(result.iso_country_code).toBe("Country");
  });

  it("recognizes Canadian-specific region terms", () => {
    expect(computeAutomap(["Prov"]).region).toBe("Prov");
    expect(computeAutomap(["Province Code"]).region).toBe("Province Code");
    expect(computeAutomap(["Territory"]).region).toBe("Territory");
    expect(computeAutomap(["Province/Territory"]).region).toBe("Province/Territory");
  });

  it("recognizes UK-specific terms", () => {
    expect(computeAutomap(["County"]).region).toBe("County");
    expect(computeAutomap(["Postcode"]).postal_code).toBe("Postcode");
    expect(computeAutomap(["Eircode"]).postal_code).toBe("Eircode");
    expect(computeAutomap(["Village"]).city).toBe("Village");
    expect(computeAutomap(["Road"]).street_address).toBe("Road");
  });

  it("recognizes expanded ISO country variants", () => {
    expect(computeAutomap(["ISO"]).iso_country_code).toBe("ISO");
    expect(computeAutomap(["ISO-3166"]).iso_country_code).toBe("ISO-3166");
    expect(computeAutomap(["ISO Alpha 2"]).iso_country_code).toBe("ISO Alpha 2");
    expect(computeAutomap(["Country ISO"]).iso_country_code).toBe("Country ISO");
  });

  it("prefers first matching header when State and County both present (US case)", () => {
    const result = computeAutomap(["State", "County"]);
    expect(result.region).toBe("State");
  });

  it("fuzzy-matches common typos", () => {
    expect(computeAutomap(["Adress"]).street_address).toBe("Adress");
    expect(computeAutomap(["Streat"]).street_address).toBe("Streat");
    expect(computeAutomap(["Latitde"]).latitude).toBe("Latitde");
    expect(computeAutomap(["Lattitude"]).latitude).toBe("Lattitude");
    expect(computeAutomap(["Longtude"]).longitude).toBe("Longtude");
    expect(computeAutomap(["Phonne"]).phone_number).toBe("Phonne");
    expect(computeAutomap(["Websit"]).website).toBe("Websit");
  });

  it("fuzzy threshold scales with length", () => {
    expect(computeAutomap(["Nam"]).location_name).toBeUndefined();
    expect(computeAutomap(["Citi"]).city).toBeUndefined();
    expect(computeAutomap(["phonee"]).phone_number).toBe("phonee");
    expect(computeAutomap(["latittude"]).latitude).toBe("latittude");
  });

  it("exact matches always win over fuzzy", () => {
    const result = computeAutomap(["State"]);
    expect(result.region).toBe("State");
  });

  it("fuzzy does not match totally unrelated headers", () => {
    const result = computeAutomap(["Foobar", "QuantumFlux", "Revenue", "Margin"]);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("editDistance is a classical Levenshtein implementation", () => {
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("", "abc")).toBe(3);
    expect(editDistance("abc", "")).toBe(3);
    expect(editDistance("same", "same")).toBe(0);
    expect(editDistance("abc", "abd")).toBe(1);
    expect(editDistance("address", "adress")).toBe(1);
  });
});

describe("client-server validation consistency", () => {
  const HEADERS = ["Name", "Street", "City", "State", "Zip", "Lat", "Lng", "Country"];
  const allUnmapped = {
    location_name: "--",
    street_address: "--",
    city: "--",
    region: "--",
    postal_code: "--",
    latitude: "--",
    longitude: "--",
    iso_country_code: "--",
    store_id: "--",
    phone_number: "--",
    website: "--",
    naics_code: "--",
    mcc_code: "--",
  };

  const minimumSets = [
    { name: "lat+long", fields: { latitude: "Lat", longitude: "Lng" }, row: ["", "", "", "", "", "37.7", "-122.4", ""] },
    {
      name: "street+city+region+postal+country",
      fields: { street_address: "Street", city: "City", region: "State", postal_code: "Zip", iso_country_code: "Country" },
      row: ["", "123 Main", "NYC", "NY", "10001", "", "", "US"],
    },
    {
      name: "street+region+postal+country",
      fields: { street_address: "Street", region: "State", postal_code: "Zip", iso_country_code: "Country" },
      row: ["", "123 Main", "", "NY", "10001", "", "", "US"],
    },
    {
      name: "street+city+region+country",
      fields: { street_address: "Street", city: "City", region: "State", iso_country_code: "Country" },
      row: ["", "123 Main", "NYC", "NY", "", "", "", "US"],
    },
  ];

  for (const { name, fields, row } of minimumSets) {
    it(`client and server both accept: ${name}`, () => {
      const clientMappings = { ...allUnmapped, ...fields };
      expect(minimumInputProvided(clientMappings)).toBe(true);

      const serverMappings = transformColumnMappings(clientMappings, HEADERS);
      expect(isValidRow(row, serverMappings).isValid).toBe(true);
    });
  }

  it("client and server both reject: name only", () => {
    const clientMappings = { ...allUnmapped, location_name: "Name" };
    expect(minimumInputProvided(clientMappings)).toBe(false);

    const serverMappings = transformColumnMappings(clientMappings, HEADERS);
    expect(isValidRow(["Shop", "", "", "", "", "", "", ""], serverMappings).isValid).toBe(false);
  });
});
