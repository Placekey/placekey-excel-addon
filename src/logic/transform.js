import { ERROR_KEY, NO_INPUT_STRING } from "./constants.js";

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

export function processBatchResponse(json, indexes, fields, insertError) {
  const batchResults = {};
  for (const name of Object.keys(fields)) batchResults[name] = {};
  const canWriteError = insertError && Object.prototype.hasOwnProperty.call(fields, ERROR_KEY);

  for (let j = 0; j < indexes.length; j++) {
    const rowIndex = indexes[j];
    const result = json[j];

    if (!result) {
      if (canWriteError) batchResults[ERROR_KEY][rowIndex] = "No response from the Placekey API for this row.";
      continue;
    }

    if (result.error && canWriteError) {
      batchResults[ERROR_KEY][rowIndex] = typeof result.error === "string" ? result.error : JSON.stringify(result.error);
    }

    for (const [field, value] of Object.entries(result)) {
      if (field === "query_id" || field === "error") continue;
      if (field === "geocode" && value && value.location) {
        if (batchResults.geocode_latitude) batchResults.geocode_latitude[rowIndex] = value.location.lat ?? "";
        if (batchResults.geocode_longitude) batchResults.geocode_longitude[rowIndex] = value.location.lng ?? "";
        if (batchResults.geocode_precision) batchResults.geocode_precision[rowIndex] = value.location_type ?? "";
      } else if (batchResults[field] !== undefined) {
        batchResults[field][rowIndex] = value ?? "";
      }
    }

    const placekeyValue = result.placekey;
    const placekeyMissing = placekeyValue == null || placekeyValue === "";
    if (placekeyMissing && canWriteError && !batchResults[ERROR_KEY][rowIndex]) {
      batchResults[ERROR_KEY][rowIndex] =
        "No Placekey could be determined for this row. Check that the address fields are correct and, for non-US data, that a country column is mapped.";
    }
  }

  return batchResults;
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
