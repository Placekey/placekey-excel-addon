export const NO_INPUT_STRING = "--";
export const ERROR_KEY = "placekey_error";
export const EMPTY_ROW_ERROR_MESSAGE = "There were no values in the row.";

export const GEOCODE_FIELDS = ["geocode_latitude", "geocode_longitude", "geocode_precision"];

export const MAIN_FIELDS = ["location_name", "street_address", "city", "region", "postal_code", "latitude", "longitude", "iso_country_code"];

export const METADATA_FIELDS = ["store_id", "phone_number", "website", "naics_code", "mcc_code"];

export const MINIMUM_INPUTS = [
  ["latitude", "longitude"],
  ["street_address", "city", "region", "postal_code", "iso_country_code"],
  ["street_address", "region", "postal_code", "iso_country_code"],
  ["street_address", "city", "region", "iso_country_code"],
];

export const API_BATCH_SIZE = 100;
export const READ_CHUNK_ROWS = 100;
export const API_URL = "https://api.placekey.io/v1/placekeys";
export const MAX_RETRIES = 3;
export const RETRY_AFTER_DEFAULT_MS = 2000;

export const LEARNED_ALIASES_KEY = "placekey.learnedAliases";
export const USER_PREFS_KEY = "placekey.userPrefs";
export const API_KEY_STORAGE_KEY = "placekey.apiKey";
export const SHEET_MAPPING_KEY_PREFIX = "placekey.mappings.";
