import { API_KEY_STORAGE_KEY, LEARNED_ALIASES_KEY, NO_INPUT_STRING, USER_PREFS_KEY } from "./logic/constants.js";
import { normalizeHeader } from "./logic/automap.js";

async function getItem(key) {
  if (typeof OfficeRuntime === "undefined" || !OfficeRuntime.storage) return null;
  try {
    return await OfficeRuntime.storage.getItem(key);
  } catch (_e) {
    return null;
  }
}

async function setItem(key, value) {
  if (typeof OfficeRuntime === "undefined" || !OfficeRuntime.storage) {
    throw new Error("OfficeRuntime.storage is not available on this Excel platform.");
  }
  await OfficeRuntime.storage.setItem(key, value);
}

export async function getApiKey() {
  const v = await getItem(API_KEY_STORAGE_KEY);
  return v || "";
}

export async function setApiKey(key) {
  if (typeof key !== "string" || key.trim().length === 0) {
    throw new Error("Please enter a valid API key.");
  }
  await setItem(API_KEY_STORAGE_KEY, key.trim());
}

export async function getLearnedAliases() {
  const data = await getItem(LEARNED_ALIASES_KEY);
  if (!data) return {};
  try {
    return JSON.parse(data) || {};
  } catch (_e) {
    return {};
  }
}

export async function saveLearnedAliases(columnMappings) {
  const aliases = await getLearnedAliases();
  for (const [fieldId, columnName] of Object.entries(columnMappings)) {
    if (columnName === NO_INPUT_STRING || !columnName) continue;
    const key = normalizeHeader(columnName);
    aliases[key] = fieldId;
  }
  await setItem(LEARNED_ALIASES_KEY, JSON.stringify(aliases));
}

export async function getUserPrefs() {
  const data = await getItem(USER_PREFS_KEY);
  if (!data) return {};
  try {
    return JSON.parse(data) || {};
  } catch (_e) {
    return {};
  }
}

export async function saveUserPrefs(prefs) {
  if (!prefs || typeof prefs !== "object") return;
  const merged = { ...(await getUserPrefs()), ...prefs };
  await setItem(USER_PREFS_KEY, JSON.stringify(merged));
}
