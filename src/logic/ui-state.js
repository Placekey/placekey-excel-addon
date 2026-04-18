import { MINIMUM_INPUTS, NO_INPUT_STRING } from "./constants.js";

export function analyzeSheetText(text) {
  if (!Array.isArray(text) || text.length === 0) {
    return { cols: false, rowCount: 0, columnCount: 0, headersMissing: false };
  }
  const normalized = text.map((row) => (Array.isArray(row) ? row.map((v) => (v == null ? "" : String(v))) : []));
  const headers = normalized[0] || [];
  const rowCount = normalized.length;
  const columnCount = headers.length;

  if (headers.every((h) => h === "")) {
    const dataLooksPresent = normalized.slice(1).some((row) => row.some((cell) => cell !== ""));
    return { cols: false, rowCount, columnCount, headersMissing: dataLooksPresent };
  }

  return { cols: [headers], rowCount, columnCount, headersMissing: false };
}

export function resolveFieldValue(fieldId, headers, mapData, automap) {
  const saved = mapData && mapData[fieldId];
  if (saved && saved !== NO_INPUT_STRING && headers.includes(saved)) {
    return saved;
  }
  const auto = automap && automap[fieldId];
  if (auto && headers.includes(auto)) {
    return auto;
  }
  return NO_INPUT_STRING;
}

export function collectOverwriteHeaders(fields, headers) {
  const result = [];
  for (const fieldObj of Object.values(fields)) {
    if (fieldObj.columnIndex >= headers.length) continue;
    const existing = headers[fieldObj.columnIndex];
    if (existing === "" || existing == null) continue;
    result.push(existing);
  }
  return result;
}

export function duplicateColumns(mappings) {
  const counts = {};
  for (const val of Object.values(mappings)) {
    if (!val || val === NO_INPUT_STRING) continue;
    counts[val] = (counts[val] || 0) + 1;
  }
  return new Set(Object.keys(counts).filter((col) => counts[col] > 1));
}

const FIELD_LABELS = {
  latitude: "Lat",
  longitude: "Lng",
  street_address: "street",
  city: "city",
  region: "region",
  postal_code: "postal",
  iso_country_code: "country",
};

export function computeStatus(mappings) {
  const mapped = Object.keys(mappings).filter((k) => mappings[k] !== NO_INPUT_STRING);

  if (duplicateColumns(mappings).size > 0) {
    return { kind: "conflict", text: "Duplicate column mapping" };
  }

  for (const set of MINIMUM_INPUTS) {
    if (set.every((k) => mapped.includes(k))) {
      return { kind: "ready", text: "\u2713 Ready" };
    }
  }

  let smallestGap = Infinity;
  let gapLabel = "";
  for (const set of MINIMUM_INPUTS) {
    const missing = set.filter((k) => !mapped.includes(k));
    if (missing.length < smallestGap) {
      smallestGap = missing.length;
      gapLabel = missing.map((k) => FIELD_LABELS[k] || k).join(", ");
    }
  }
  if (smallestGap === Infinity) return { kind: "none", text: "Map columns to begin" };
  if (mapped.length === 0) return { kind: "none", text: "Map columns to begin" };
  if (smallestGap === 1) return { kind: "partial", text: `Need ${gapLabel}` };
  return { kind: "partial", text: `${smallestGap} more fields needed` };
}
