import { READ_CHUNK_ROWS, SHEET_MAPPING_KEY_PREFIX } from "./logic/constants.js";
import { planContiguousRanges } from "./logic/write-planner.js";

async function resolveSheet(context, target) {
  if (!target) return context.workbook.worksheets.getActiveWorksheet();

  const name = typeof target === "string" ? target : target.name;
  const id = typeof target === "string" ? null : target.id;

  const byName = context.workbook.worksheets.getItemOrNullObject(name);
  byName.load(["isNullObject", "id"]);
  await context.sync();

  if (!byName.isNullObject && (!id || byName.id === id)) return byName;

  if (id) {
    const all = context.workbook.worksheets;
    all.load("items/id");
    await context.sync();
    const match = all.items.find((s) => s.id === id);
    if (match) return match;
  }

  throw new Error(`Target sheet "${name}" is no longer available.`);
}

export async function getWorkbookState() {
  return Excel.run(async (context) => {
    const worksheets = context.workbook.worksheets;
    worksheets.load("items/name");
    const active = context.workbook.worksheets.getActiveWorksheet();
    active.load(["name", "id"]);
    await context.sync();

    const sheetNames = worksheets.items.map((s) => s.name);
    const activeName = active.name;

    const info = await readActiveSheetInfoInContext(context, active);
    return { activeName, sheetNames, info };
  });
}

async function readActiveSheetInfoInContext(context, sheet) {
  const used = sheet.getUsedRangeOrNullObject();
  used.load(["rowIndex", "columnIndex", "rowCount", "columnCount"]);
  const mapSetting = context.workbook.settings.getItemOrNullObject(SHEET_MAPPING_KEY_PREFIX + sheet.id);
  mapSetting.load("value");
  await context.sync();

  const sheetId = sheet.id;
  const mapData = parseSettingValue(mapSetting);

  if (used.isNullObject || !used.rowCount || !used.columnCount) {
    return { cols: false, rowCount: 0, columnCount: 0, sheetId, mapData, headersMissing: false };
  }

  const endRow = used.rowIndex + used.rowCount - 1;
  const endCol = used.columnIndex + used.columnCount - 1;
  const rowCount = endRow + 1;
  const columnCount = endCol + 1;

  const headerRange = sheet.getRangeByIndexes(0, 0, 1, columnCount);
  headerRange.load("text");
  await context.sync();
  const headerRow = (headerRange.text[0] || []).map((v) => (v == null ? "" : String(v)));

  if (headerRow.some((h) => h !== "")) {
    return { cols: [headerRow], rowCount, columnCount, sheetId, mapData, headersMissing: false };
  }

  const probeRows = Math.min(READ_CHUNK_ROWS, rowCount - 1);
  if (probeRows <= 0) {
    return { cols: false, rowCount, columnCount, sheetId, mapData, headersMissing: false };
  }
  const probeRange = sheet.getRangeByIndexes(1, 0, probeRows, columnCount);
  probeRange.load("text");
  await context.sync();
  const headersMissing = (probeRange.text || []).some((row) => row.some((cell) => cell != null && String(cell) !== ""));
  return { cols: false, rowCount, columnCount, sheetId, mapData, headersMissing };
}

function parseSettingValue(setting) {
  if (setting.isNullObject) return {};
  try {
    const raw = setting.value;
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch (_e) {
    return {};
  }
}

export async function activateSheet(sheetName) {
  return Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getItem(sheetName);
    sheet.activate();
    sheet.load(["name", "id"]);
    await context.sync();
    return readActiveSheetInfoInContext(context, sheet);
  });
}

export async function readDataRows(target) {
  return Excel.run(async (context) => {
    const sheet = await resolveSheet(context, target);
    const used = sheet.getUsedRangeOrNullObject();
    used.load(["rowIndex", "columnIndex", "rowCount", "columnCount"]);
    await context.sync();

    if (used.isNullObject || !used.rowCount || !used.columnCount) {
      return { headers: [], rows: [] };
    }

    const totalRows = used.rowIndex + used.rowCount;
    const columnCount = used.columnIndex + used.columnCount;

    let headers = [];
    const rows = [];
    for (let startRow = 0; startRow < totalRows; startRow += READ_CHUNK_ROWS) {
      const chunkRows = Math.min(READ_CHUNK_ROWS, totalRows - startRow);
      const range = sheet.getRangeByIndexes(startRow, 0, chunkRows, columnCount);
      range.load("text");
      await context.sync();
      const text = (range.text || []).map((row) => row.map((v) => (v == null ? "" : String(v))));
      if (startRow === 0) {
        headers = text[0] || [];
        for (let i = 1; i < text.length; i++) rows.push(text[i]);
      } else {
        for (const r of text) rows.push(r);
      }
    }
    return { headers, rows };
  });
}

export async function writeHeaders(fields, target) {
  return Excel.run(async (context) => {
    const sheet = await resolveSheet(context, target);
    for (const fieldObj of Object.values(fields)) {
      sheet.getRangeByIndexes(0, fieldObj.columnIndex, 1, 1).values = [[fieldObj.displayName]];
    }
    await context.sync();
  });
}

export async function writeResults(fields, results, target) {
  return Excel.run(async (context) => {
    const sheet = await resolveSheet(context, target);
    for (const [fieldName, fieldObj] of Object.entries(fields)) {
      const resultMap = results[fieldName];
      if (!resultMap || Object.keys(resultMap).length === 0) continue;
      const ranges = planContiguousRanges(resultMap);
      for (const { startRowIndex, values } of ranges) {
        sheet.getRangeByIndexes(startRowIndex + 1, fieldObj.columnIndex, values.length, 1).values = values;
      }
    }
    for (const fieldObj of Object.values(fields)) {
      sheet.getRangeByIndexes(0, fieldObj.columnIndex, 1, 1).format.autofitColumns();
    }
    await context.sync();
  });
}

export async function saveSheetMapping(mappings, target) {
  return Excel.run(async (context) => {
    const sheet = await resolveSheet(context, target);
    sheet.load("id");
    await context.sync();
    context.workbook.settings.add(SHEET_MAPPING_KEY_PREFIX + sheet.id, JSON.stringify(mappings));
    await context.sync();
  });
}

export async function insertSampleData(target) {
  return Excel.run(async (context) => {
    const sheet = await resolveSheet(context, target);
    const used = sheet.getUsedRangeOrNullObject();
    used.load("address");
    await context.sync();
    if (!used.isNullObject) {
      throw new Error("This sheet already contains data. Clear it first, then try again.");
    }

    const headers = [["Name", "Street Address", "City", "State", "Zip code", "Latitude", "Longitude", "Country"]];
    const rows = [
      ["Twin Peaks Petroleum", "598 Portola Dr", "San Francisco", "CA", "94131", "37.7371", "-122.44283", "US"],
      ["", "", "", "", "", "37.7371", "-122.44283", "US"],
      ["Beretta", "1199 Valencia St", "San Francisco", "CA", "94110", "", "", "US"],
      ["Tasty Hand Pulled Noodle", "1 Doyers St", "New York", "ny", "10013", "", "", "US"],
      ["", "1 Doyers St", "New York", "NY", "10013", "", "", "US"],
    ];

    const headerRange = sheet.getRangeByIndexes(0, 0, 1, headers[0].length);
    headerRange.values = headers;
    const table = sheet.tables.add(headerRange, true);
    table.rows.add(null, rows);
    sheet.getUsedRange().format.autofitColumns();
    sheet.freezePanes.freezeRows(1);
    await context.sync();
  });
}
