import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createExcelMock, installExcelGlobal } from "./helpers/excel-mock.js";
import { activateSheet, getWorkbookState, insertSampleData, readDataRows, saveSheetMapping, writeHeaders, writeResults } from "../src/sheet-adapter.js";
import { SHEET_MAPPING_KEY_PREFIX } from "../src/logic/constants.js";

let cleanup = null;

function buildSpec() {
  return {
    sheets: [
      {
        id: "sheet-1-id",
        name: "Sheet1",
        data: [
          ["Name", "Street", "City"],
          ["Twin Peaks", "598 Portola Dr", "San Francisco"],
          ["Beretta", "1199 Valencia St", "San Francisco"],
        ],
      },
      {
        id: "sheet-2-id",
        name: "Sheet2",
        data: [],
      },
    ],
    activeId: "sheet-1-id",
  };
}

function install(spec) {
  const mock = createExcelMock(spec);
  cleanup = installExcelGlobal(mock);
  return mock;
}

afterEach(() => {
  if (cleanup) cleanup();
  cleanup = null;
});

describe("getWorkbookState", () => {
  it("returns active sheet name, sheet list, and parsed info", async () => {
    install(buildSpec());
    const state = await getWorkbookState();
    expect(state.activeName).toBe("Sheet1");
    expect(state.sheetNames).toEqual(["Sheet1", "Sheet2"]);
    expect(state.info.sheetId).toBe("sheet-1-id");
    expect(state.info.cols).toEqual([["Name", "Street", "City"]]);
    expect(state.info.mapData).toEqual({});
  });

  it("returns cols:false for an empty active sheet", async () => {
    install({
      sheets: [{ id: "s1", name: "Empty", data: [] }],
      activeId: "s1",
    });
    const state = await getWorkbookState();
    expect(state.info.cols).toBe(false);
  });

  it("hydrates mapData from workbook settings keyed by sheet id", async () => {
    install({
      ...buildSpec(),
      settings: {
        [SHEET_MAPPING_KEY_PREFIX + "sheet-1-id"]: JSON.stringify({ location_name: "Name" }),
      },
    });
    const state = await getWorkbookState();
    expect(state.info.mapData).toEqual({ location_name: "Name" });
  });
});

describe("readDataRows", () => {
  it("reads headers and data rows in (headers, rows) shape", async () => {
    install(buildSpec());
    const { headers, rows } = await readDataRows({ name: "Sheet1", id: "sheet-1-id" });
    expect(headers).toEqual(["Name", "Street", "City"]);
    expect(rows).toEqual([
      ["Twin Peaks", "598 Portola Dr", "San Francisco"],
      ["Beretta", "1199 Valencia St", "San Francisco"],
    ]);
  });

  it("returns empty arrays for an empty sheet", async () => {
    install({
      sheets: [{ id: "s1", name: "Empty", data: [] }],
      activeId: "s1",
    });
    const { headers, rows } = await readDataRows({ name: "Empty", id: "s1" });
    expect(headers).toEqual([]);
    expect(rows).toEqual([]);
  });
});

describe("resolveSheet (via readDataRows)", () => {
  it("happy path: resolves by name when name still matches", async () => {
    install(buildSpec());
    const { headers } = await readDataRows({ name: "Sheet1", id: "sheet-1-id" });
    expect(headers).toEqual(["Name", "Street", "City"]);
  });

  it("falls back to id when the sheet was renamed mid-flight", async () => {
    const mock = install(buildSpec());
    mock.renameSheet("sheet-1-id", "Renamed");
    // Caller still has the old name captured.
    const { headers, rows } = await readDataRows({ name: "Sheet1", id: "sheet-1-id" });
    expect(headers).toEqual(["Name", "Street", "City"]);
    expect(rows).toHaveLength(2);
  });

  it("throws when both name and id are gone (sheet deleted)", async () => {
    const mock = install(buildSpec());
    mock.deleteSheet("sheet-1-id");
    await expect(readDataRows({ name: "Sheet1", id: "sheet-1-id" })).rejects.toThrow(/no longer available/);
  });

  it("treats string target as name-only (no id fallback)", async () => {
    install(buildSpec());
    const { headers } = await readDataRows("Sheet1");
    expect(headers).toEqual(["Name", "Street", "City"]);
  });
});

describe("writeHeaders", () => {
  it("writes each field displayName at its columnIndex on row 0", async () => {
    const mock = install(buildSpec());
    const fields = {
      placekey: { displayName: "Placekey", columnIndex: 3 },
      confidence_score: { displayName: "Confidence", columnIndex: 4 },
    };
    await writeHeaders(fields, { name: "Sheet1", id: "sheet-1-id" });
    const sheet = mock.getSheetById("sheet-1-id");
    expect(sheet._cellAt(0, 3)).toBe("Placekey");
    expect(sheet._cellAt(0, 4)).toBe("Confidence");
    // Existing headers untouched.
    expect(sheet._cellAt(0, 0)).toBe("Name");
  });
});

describe("writeResults", () => {
  it("writes contiguous rows in a single range per field (uses planContiguousRanges)", async () => {
    const mock = install(buildSpec());
    const fields = { placekey: { displayName: "Placekey", columnIndex: 3 } };
    const results = {
      placekey: { 0: "pk_a", 1: "pk_b" },
    };
    await writeResults(fields, results, { name: "Sheet1", id: "sheet-1-id" });
    const sheet = mock.getSheetById("sheet-1-id");
    // Results write at row (startRowIndex + 1), so rowIndex 0 -> row 1, rowIndex 1 -> row 2
    expect(sheet._cellAt(1, 3)).toBe("pk_a");
    expect(sheet._cellAt(2, 3)).toBe("pk_b");
    // Autofit should have been requested exactly once per field.
    expect(sheet._autofitCalls).toHaveLength(1);
    expect(sheet._autofitCalls[0].columnIndex).toBe(3);
  });

  it("splits non-contiguous row indexes into separate batched writes", async () => {
    const mock = install(buildSpec());
    const fields = { placekey: { displayName: "Placekey", columnIndex: 3 } };
    // rowIndex 0, then gap, then rowIndex 5 -> two contiguous ranges.
    const results = {
      placekey: { 0: "pk_first", 5: "pk_sixth" },
    };
    await writeResults(fields, results, { name: "Sheet1", id: "sheet-1-id" });
    const sheet = mock.getSheetById("sheet-1-id");
    expect(sheet._cellAt(1, 3)).toBe("pk_first");
    expect(sheet._cellAt(6, 3)).toBe("pk_sixth");
    // Rows in the gap stay empty.
    expect(sheet._cellAt(2, 3)).toBe("");
    expect(sheet._cellAt(3, 3)).toBe("");
  });

  it("skips fields with no results", async () => {
    const mock = install(buildSpec());
    const fields = {
      placekey: { displayName: "Placekey", columnIndex: 3 },
      confidence_score: { displayName: "Confidence", columnIndex: 4 },
    };
    const results = { placekey: { 0: "pk" }, confidence_score: {} };
    await writeResults(fields, results, { name: "Sheet1", id: "sheet-1-id" });
    const sheet = mock.getSheetById("sheet-1-id");
    expect(sheet._cellAt(1, 3)).toBe("pk");
    expect(sheet._cellAt(1, 4)).toBe("");
  });
});

describe("saveSheetMapping", () => {
  it("persists mappings keyed by sheet.id (not name)", async () => {
    const mock = install(buildSpec());
    await saveSheetMapping({ location_name: "Name" }, { name: "Sheet1", id: "sheet-1-id" });
    const setting = mock.workbook.settings.getItemOrNullObject(SHEET_MAPPING_KEY_PREFIX + "sheet-1-id");
    expect(setting.isNullObject).toBe(false);
    expect(JSON.parse(setting.value)).toEqual({ location_name: "Name" });
  });

  it("still keys by id even after a sheet is renamed", async () => {
    const mock = install(buildSpec());
    mock.renameSheet("sheet-1-id", "RenamedLater");
    await saveSheetMapping({ city: "City" }, { name: "Sheet1", id: "sheet-1-id" });
    const setting = mock.workbook.settings.getItemOrNullObject(SHEET_MAPPING_KEY_PREFIX + "sheet-1-id");
    expect(setting.isNullObject).toBe(false);
    expect(JSON.parse(setting.value)).toEqual({ city: "City" });
  });
});

describe("activateSheet", () => {
  it("activates the requested sheet and returns its info", async () => {
    const mock = install(buildSpec());
    const info = await activateSheet("Sheet2");
    expect(info.sheetId).toBe("sheet-2-id");
    const sheet2 = mock.getSheetById("sheet-2-id");
    expect(sheet2._activated).toBe(true);
  });
});

describe("insertSampleData", () => {
  it("populates an empty sheet with sample headers + rows", async () => {
    const mock = install({
      sheets: [{ id: "s1", name: "Empty", data: [] }],
      activeId: "s1",
    });
    await insertSampleData({ name: "Empty", id: "s1" });
    const sheet = mock.getSheetById("s1");
    expect(sheet._cellAt(0, 0)).toBe("Name");
    expect(sheet._cellAt(0, 7)).toBe("Country");
    expect(sheet._cellAt(1, 0)).toBe("Twin Peaks Petroleum");
    expect(sheet._frozenRows).toBe(1);
  });

  it("throws when the sheet already has data", async () => {
    install(buildSpec());
    await expect(insertSampleData({ name: "Sheet1", id: "sheet-1-id" })).rejects.toThrow(/already contains data/);
  });
});

describe("settings round-trip via adapter + getWorkbookState", () => {
  let mock;
  beforeEach(() => {
    mock = install(buildSpec());
  });
  it("what saveSheetMapping writes, getWorkbookState reads back", async () => {
    await saveSheetMapping({ city: "City", region: "State" }, { name: "Sheet1", id: "sheet-1-id" });
    const state = await getWorkbookState();
    expect(state.info.mapData).toEqual({ city: "City", region: "State" });
    expect(mock).toBeDefined();
  });
});
