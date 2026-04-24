import { EMPTY_ROW_ERROR_MESSAGE, MAIN_FIELDS, METADATA_FIELDS, MINIMUM_INPUTS, NO_INPUT_STRING } from "./constants.js";

export function mapRowToObject(row, columnMappings) {
  const result = {};
  for (const field of MAIN_FIELDS) {
    if (columnMappings[field] === NO_INPUT_STRING) {
      result[field] = "";
    } else {
      result[field] = row[columnMappings[field].rowIndex];
    }
  }
  result.place_metadata = {};
  for (const field of METADATA_FIELDS) {
    const mapping = columnMappings[field];
    result.place_metadata[field] = !mapping || mapping === NO_INPUT_STRING ? "" : row[mapping.rowIndex];
  }
  return result;
}

export function hasValidLatLongValues(rowObject, keysWithValues) {
  for (const key of ["latitude", "longitude"]) {
    if (keysWithValues.includes(key) && Number.isNaN(Number.parseFloat(rowObject[key]))) {
      return false;
    }
  }
  return true;
}

export function isValidRow(row, columnMappings) {
  const rowObj = mapRowToObject(row, columnMappings);
  let keysWithValues = Object.keys(rowObj).filter((key) => key !== "place_metadata" && rowObj[key].length > 0);

  if (keysWithValues.length === 0 || (keysWithValues.length === 1 && keysWithValues[0] === "iso_country_code")) {
    return { isValid: false, message: EMPTY_ROW_ERROR_MESSAGE, row: rowObj };
  }

  if (keysWithValues.includes("latitude") && keysWithValues.includes("longitude") && !hasValidLatLongValues(rowObj, keysWithValues)) {
    if (keysWithValues.length === 2) {
      return {
        isValid: false,
        message: "The value provided for latitude or longitude was invalid.",
        row: rowObj,
      };
    }
    delete rowObj.latitude;
    delete rowObj.longitude;
    keysWithValues = keysWithValues.filter((k) => k !== "latitude" && k !== "longitude");
  }

  for (const requiredSet of MINIMUM_INPUTS) {
    if (requiredSet.every((key) => keysWithValues.includes(key))) {
      return { isValid: true, message: "The row is valid", row: rowObj };
    }
  }

  return {
    isValid: false,
    message: "Row did not meet minimum input requirements. Details: https://docs.placekey.io/documentation/placekey-api/input-parameters/minimum-inputs",
    row: rowObj,
  };
}

export function validateAllRows(allRowsValues, columnMappings, insertError) {
  const validRows = {};
  const errorRows = {};

  for (let i = 0; i < allRowsValues.length; i++) {
    const { isValid, message, row } = isValidRow(allRowsValues[i], columnMappings);
    if (!isValid) {
      if (insertError && message !== EMPTY_ROW_ERROR_MESSAGE) {
        errorRows[i] = message;
      }
      continue;
    }
    validRows[i] = row;
  }

  return {
    validRows,
    errorRows,
    sortedValidIndexes: Object.keys(validRows)
      .map(Number)
      .sort((a, b) => a - b),
    sortedInvalidIndexes: Object.keys(errorRows)
      .map(Number)
      .sort((a, b) => a - b),
  };
}

export function minimumInputProvided(columnMappings) {
  const mapped = Object.keys(columnMappings).filter((key) => columnMappings[key] !== NO_INPUT_STRING);
  return MINIMUM_INPUTS.some((inputs) => inputs.every((key) => mapped.includes(key)));
}

export function hasDuplicateMappings(columnMappings) {
  const mapped = Object.values(columnMappings).filter((v) => v !== NO_INPUT_STRING);
  return new Set(mapped).size !== mapped.length;
}
