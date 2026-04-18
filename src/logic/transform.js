import { NO_INPUT_STRING } from "./constants.js";

export function transformColumnMappings(columnMappings, colsHeader) {
  const transformed = {};
  for (const [fieldKey, value] of Object.entries(columnMappings)) {
    if (value === NO_INPUT_STRING) {
      transformed[fieldKey] = NO_INPUT_STRING;
    } else {
      transformed[fieldKey] = {
        columnName: value,
        columnNumber: colsHeader.indexOf(value) + 1,
        rowIndex: colsHeader.indexOf(value),
      };
    }
  }
  return transformed;
}

export function prepareOutputFields(fieldNames, colsHeader) {
  const lowerCaseCols = colsHeader.map((name) => name.toLowerCase());
  const fields = {};
  let appendedCount = 0;

  let effectiveLength = colsHeader.length;
  while (effectiveLength > 0 && colsHeader[effectiveLength - 1] === "") {
    effectiveLength--;
  }

  for (const fieldName of fieldNames) {
    if (fieldName === "geocode") continue;
    const displayName = fieldName
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    const existingIndex = lowerCaseCols.indexOf(displayName.toLowerCase());

    fields[fieldName] = {
      apiKey: fieldName,
      displayName,
      columnIndex: existingIndex >= 0 ? existingIndex : effectiveLength + appendedCount++,
    };
  }

  return fields;
}
