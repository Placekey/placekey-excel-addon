import { API_BATCH_SIZE, ERROR_KEY, GEOCODE_FIELDS, NO_INPUT_STRING } from "./logic/constants.js";
import { computeAutomap } from "./logic/automap.js";
import { buildColumnOptions, buildSheetOptions } from "./logic/html-helpers.js";
import { hasDuplicateMappings, isValidRow } from "./logic/validation.js";
import { EMPTY_ROW_ERROR_MESSAGE } from "./logic/constants.js";
import { prepareOutputFields, transformColumnMappings } from "./logic/transform.js";
import { callPlacekeyApi } from "./logic/api-client.js";
import { collectOverwriteHeaders, computeStatus, duplicateColumns, resolveFieldValue } from "./logic/ui-state.js";
import {
  activateSheet,
  autofitResultColumns,
  getWorkbookState,
  insertSampleData,
  readDataHeaders,
  saveSheetMapping,
  streamDataRows,
  writeHeaders,
  writeResults,
} from "./sheet-adapter.js";
import { getApiKey, getLearnedAliases, getUserPrefs, saveLearnedAliases, saveUserPrefs } from "./prefs-storage.js";
import { showConfirm } from "./logic/modal.js";

const state = {
  headers: [],
  activeSheet: "",
  activeSheetId: "",
  learnedAliases: {},
  mapData: {},
  isGenerating: false,
};

function $(id) {
  return document.getElementById(id);
}

function setToast(message, kind) {
  const toast = $("generateToast");
  toast.textContent = message || "";
  toast.className = "toast" + (kind ? " toast--" + kind : "");
}

function currentMappings() {
  const m = {};
  for (const sel of document.getElementsByClassName("selectCols")) {
    m[sel.id] = sel.value;
  }
  return m;
}

function updateFieldStates() {
  const mappings = currentMappings();
  const dups = duplicateColumns(mappings);
  for (const sel of document.getElementsByClassName("selectCols")) {
    const wrap = sel.closest(".field");
    if (!wrap) continue;
    const mapped = sel.value && sel.value !== NO_INPUT_STRING;
    let stateName = "unmapped";
    if (mapped && dups.has(sel.value)) {
      stateName = "conflict";
    } else if (mapped) {
      stateName = "mapped";
    }
    wrap.dataset.state = stateName;
  }
}

function updateStatusChip() {
  const mappings = currentMappings();
  const status = computeStatus(mappings);
  const chip = $("mappingStatus");
  const text = $("mappingStatusText");
  chip.className = "status-chip status-chip--" + status.kind;
  text.textContent = status.text;

  const btn = $("generate");
  const canGenerate = status.kind === "ready";
  btn.setAttribute("aria-disabled", String(!canGenerate));
  btn.title = canGenerate ? "Generate Placekeys" : status.text;
}

function updateBadgeCounts() {
  const returns = Array.from(document.getElementsByClassName("returnFields")).filter((i) => i.checked).length;
  const retBadge = $("returnCount");
  retBadge.textContent = returns;
  retBadge.classList.toggle("disclosure__badge--active", returns > 0);
}

let savePrefsTimer = null;
function savePrefsDebounced() {
  if (state.isGenerating) return;
  if (savePrefsTimer) clearTimeout(savePrefsTimer);
  savePrefsTimer = setTimeout(async () => {
    if (state.isGenerating) return;
    const requestFields = Array.from(document.getElementsByClassName("returnFields"))
      .filter((i) => i.checked)
      .map((i) => i.name);
    const insertError = $("insertError").checked;
    try {
      await saveUserPrefs({ requestFields, insertError });
    } catch (e) {
      console.log("savePrefs", e);
    }
  }, 400);
}

function setGenerateLock(locked) {
  state.isGenerating = locked;
  for (const cb of document.getElementsByClassName("returnFields")) cb.disabled = locked;
  for (const sel of document.getElementsByClassName("selectCols")) sel.disabled = locked;
  const insertErr = $("insertError");
  if (insertErr) insertErr.disabled = locked;
  const sheetSelect = $("sheets");
  if (sheetSelect) sheetSelect.disabled = locked;
  const refreshBtn = $("refreshBtn");
  if (refreshBtn) refreshBtn.disabled = locked;
  const generateBtn = $("generate");
  if (generateBtn) generateBtn.disabled = locked;
  if (locked && savePrefsTimer) {
    clearTimeout(savePrefsTimer);
    savePrefsTimer = null;
  }
}

function applyUserPrefs(userPrefs) {
  if (!userPrefs) return;
  if (Array.isArray(userPrefs.requestFields)) {
    for (const cb of document.getElementsByClassName("returnFields")) {
      cb.checked = userPrefs.requestFields.includes(cb.name);
    }
  }
  if (typeof userPrefs.insertError === "boolean") {
    $("insertError").checked = userPrefs.insertError;
  }
}

function refreshUI() {
  updateFieldStates();
  updateStatusChip();
  updateBadgeCounts();
}

function populateColumnDropdowns(headers) {
  const html = buildColumnOptions(headers);
  const automap = computeAutomap(headers, state.learnedAliases);
  for (const sel of document.getElementsByClassName("selectCols")) {
    sel.innerHTML = html;
    sel.value = resolveFieldValue(sel.id, headers, state.mapData, automap);
  }
}

function showEmpty(empty, info) {
  const emptyEl = $("emptySheet");
  emptyEl.classList.toggle("hidden", !empty);
  $("mapTitle").classList.toggle("hidden", empty);
  if (empty) {
    const p = emptyEl.querySelector("p");
    const sampleBtn = $("sampleBtn");
    const missing = !!(info && info.headersMissing);
    while (p.firstChild) p.removeChild(p.firstChild);
    const strong = document.createElement("strong");
    if (missing) {
      strong.textContent = "Headers must be in row 1.";
      p.appendChild(strong);
      p.appendChild(document.createElement("br"));
      p.appendChild(document.createTextNode("This sheet has data but row 1 is empty. Move your header row to row 1, then click refresh above."));
      sampleBtn.textContent = "Refresh sheet";
    } else {
      strong.textContent = "This sheet looks empty.";
      p.appendChild(strong);
      p.appendChild(document.createElement("br"));
      p.appendChild(document.createTextNode("Start with a few sample addresses to see how it works."));
      sampleBtn.textContent = "Fill with sample data";
    }
    sampleBtn.dataset.action = missing ? "refresh" : "sample";
  }
}

async function refreshSheetInfo() {
  if (state.isGenerating) return;
  let activeName, sheetNames, info;
  try {
    ({ activeName, sheetNames, info } = await getWorkbookState());
  } catch (e) {
    setToast(e.message || "Could not read the workbook.", "error");
    return;
  }
  state.activeSheet = activeName;
  state.activeSheetId = info.sheetId || "";
  state.mapData = info.mapData || {};
  $("sheets").innerHTML = buildSheetOptions(sheetNames, activeName);
  $("sheetPicker").classList.remove("hidden");

  if (!info.cols) {
    state.headers = [];
    showEmpty(true, info);
    return;
  }
  state.headers = info.cols[0];
  showEmpty(false);
  populateColumnDropdowns(state.headers);
  refreshUI();
}

async function handleSheetChange() {
  if (state.isGenerating) return;
  const selected = $("sheets").value;
  let info;
  try {
    info = await activateSheet(selected);
  } catch (e) {
    setToast(e.message || "That sheet could not be opened.", "error");
    await refreshSheetInfo();
    return;
  }
  state.activeSheet = selected;
  state.activeSheetId = info.sheetId || "";
  state.mapData = info.mapData || {};
  if (!info.cols) {
    state.headers = [];
    showEmpty(true, info);
    return;
  }
  state.headers = info.cols[0];
  showEmpty(false);
  populateColumnDropdowns(state.headers);
  refreshUI();
}

async function handleInsertSample() {
  if (state.isGenerating) return;
  const btn = $("sampleBtn");
  if (btn && btn.dataset.action === "refresh") {
    await refreshSheetInfo();
    return;
  }
  try {
    await insertSampleData({ name: state.activeSheet, id: state.activeSheetId });
  } catch (e) {
    setToast(e.message || "Could not insert sample data.", "error");
    return;
  }
  await refreshSheetInfo();
}

function attachFieldListeners() {
  for (const sel of document.getElementsByClassName("selectCols")) {
    sel.addEventListener("change", refreshUI);
  }
  for (const cb of document.getElementsByClassName("returnFields")) {
    cb.addEventListener("change", () => {
      updateBadgeCounts();
      savePrefsDebounced();
    });
  }
  const insertErr = $("insertError");
  if (insertErr) insertErr.addEventListener("change", savePrefsDebounced);

  $("sheets").addEventListener("change", handleSheetChange);
  $("refreshBtn").addEventListener("click", refreshSheetInfo);
  $("sampleBtn").addEventListener("click", handleInsertSample);
  $("generate").addEventListener("click", handleGenerate);
  $("changeKey").addEventListener("click", showApiKeyDialog);
}

function showApiKeyDialog() {
  return new Promise((resolve) => {
    const url = new URL("./apikey.html", window.location.href).toString();
    Office.context.ui.displayDialogAsync(url, { height: 40, width: 40, displayInIframe: true }, (result) => {
      if (result.status !== Office.AsyncResultStatus.Succeeded) {
        resolve(false);
        return;
      }
      const dialog = result.value;
      dialog.addEventHandler(Office.EventType.DialogMessageReceived, (arg) => {
        try {
          const payload = JSON.parse(arg.message);
          dialog.close();
          resolve(!!payload.ok);
        } catch (_e) {
          dialog.close();
          resolve(false);
        }
      });
      dialog.addEventHandler(Office.EventType.DialogEventReceived, () => {
        try {
          dialog.close();
        } catch (_e) {
          // dialog may already be closed
        }
        resolve(false);
      });
    });
  });
}

async function ensureApiKey() {
  let key = await getApiKey();
  if (key) return key;
  const ok = await showApiKeyDialog();
  if (!ok) return "";
  return await getApiKey();
}

async function handleGenerate() {
  // Re-entrancy guard. The generate button is not disabled until
  // setGenerateLock(true) runs further down, and there is an await window
  // (ensureApiKey -> displayDialogAsync) between the aria-disabled check and
  // that call. Without this guard, a double-click (or repeated click while
  // the API-key dialog is open) would race a duplicate run against the same
  // sheet. isGenerating is claimed synchronously once we commit to this run.
  if (state.isGenerating) return;

  const btn = $("generate");
  if (btn.getAttribute("aria-disabled") === "true") {
    setToast(computeStatus(currentMappings()).text, "error");
    return;
  }

  const mappings = currentMappings();
  if (hasDuplicateMappings(mappings)) {
    setToast("The same column is mapped to more than one field.", "error");
    return;
  }

  // Capture targetSheet BEFORE the API-key dialog so that if the active sheet
  // changes while the dialog is open, we still run against the sheet the user
  // was looking at when they clicked Generate. mappings is already captured
  // above (and validated via hasDuplicateMappings), so the pair is consistent.
  const targetSheet = { name: state.activeSheet, id: state.activeSheetId };

  // Claim the lock synchronously before any await, so a re-entrant call
  // bails early at the guard above. setGenerateLock(true) further down
  // wires up the DOM disabling and prefs-timer teardown; the finally at the
  // bottom always restores the lock, including on the no-api-key early-return.
  state.isGenerating = true;

  try {
    const apiKey = await ensureApiKey();
    if (!apiKey) {
      setToast("An API key is required.", "error");
      return;
    }

    setGenerateLock(true);
    setToast("Loading rows...");
    const requestFields = Array.from(document.getElementsByClassName("returnFields"))
      .filter((i) => i.checked)
      .map((i) => i.name);

    const insertError = $("insertError").checked;

    const headers = await readDataHeaders(targetSheet);
    const transformed = transformColumnMappings(mappings, headers);

    for (const [fieldId, mapping] of Object.entries(transformed)) {
      if (mapping === NO_INPUT_STRING) continue;
      if (mapping.rowIndex < 0) {
        throw new Error(`Mapped column "${mapping.columnName}" for ${fieldId} is no longer in the sheet headers. Refresh and re-map.`);
      }
    }

    const expandedFields = [...requestFields];
    if (expandedFields.includes("geocode")) expandedFields.push(...GEOCODE_FIELDS);
    const allFieldNames = insertError ? ["placekey", ...expandedFields, ERROR_KEY] : ["placekey", ...expandedFields];

    const fields = prepareOutputFields(allFieldNames, headers);

    const overwrites = collectOverwriteHeaders(fields, headers);
    if (overwrites.length > 0) {
      const list = overwrites.join(", ");
      const msg = `This will overwrite existing column${overwrites.length > 1 ? "s" : ""}: ${list}\n\nContinue?`;
      let ok = false;
      try {
        ok = await showConfirm({
          title: "Overwrite existing columns?",
          message: msg,
          confirmLabel: "Overwrite",
          cancelLabel: "Cancel",
          destructive: true,
        });
      } catch (_e) {
        setToast("A dialog is already open.", "error");
        return;
      }
      if (!ok) {
        setToast("Cancelled.");
        return;
      }
    }

    await saveLearnedAliases(mappings);
    await saveUserPrefs({ requestFields, insertError });
    await saveSheetMapping(mappings, targetSheet);
    state.mapData = { ...mappings };
    state.learnedAliases = await getLearnedAliases();

    let totalPlaceKeys = 0;
    let fieldsFinalized = false;
    let validCount = 0;
    const errorRows = {};
    const apiOptions = { addressMatch: false, nameMatch: false };

    let batchIndexes = [];
    let batchRows = [];

    async function flushBatch() {
      if (batchIndexes.length === 0) return;
      const indexes = batchIndexes;
      const rowsForApi = batchRows;
      batchIndexes = [];
      batchRows = [];

      const json = await callPlacekeyApi(rowsForApi, apiOptions, requestFields, apiKey);
      if (!json || !json.length) return;

      if (!fieldsFinalized) {
        const returnedFields = Object.keys(json[0]).filter((f) => f !== "query_id");
        for (const fieldKey of Object.keys(fields)) {
          if (fieldKey === ERROR_KEY || GEOCODE_FIELDS.includes(fieldKey)) continue;
          if (!returnedFields.includes(fieldKey)) {
            delete fields[fieldKey];
          }
        }
        await writeHeaders(fields, targetSheet);
        fieldsFinalized = true;
      }

      const batchResults = {};
      for (const name of Object.keys(fields)) batchResults[name] = {};

      for (let j = 0; j < indexes.length; j++) {
        if (!json[j]) continue;
        const rowIndex = indexes[j];
        for (const [field, value] of Object.entries(json[j])) {
          if (field === "query_id") continue;
          if (field === "geocode" && value && value.location) {
            if (batchResults.geocode_latitude) batchResults.geocode_latitude[rowIndex] = value.location.lat ?? "";
            if (batchResults.geocode_longitude) batchResults.geocode_longitude[rowIndex] = value.location.lng ?? "";
            if (batchResults.geocode_precision) batchResults.geocode_precision[rowIndex] = value.location_type ?? "";
          } else if (batchResults[field] !== undefined) {
            batchResults[field][rowIndex] = value;
          }
        }
      }

      await writeResults(fields, batchResults, targetSheet, { autofit: false });
      totalPlaceKeys += indexes.length;
    }

    // Stream rows and pipeline: read one chunk ahead while the previous chunk's
    // batches are being sent to the API and written back to the sheet. The
    // generator iterator gives us explicit control over when to fetch the next
    // chunk — we kick off next() before awaiting API work so the Office.js read
    // round-trip overlaps with the HTTPS call to Placekey.
    const iterator = streamDataRows(targetSheet)[Symbol.asyncIterator]();
    let nextChunkPromise = iterator.next();
    let sawAnyRows = false;

    while (true) {
      const chunk = await nextChunkPromise;
      if (chunk.done) break;
      nextChunkPromise = iterator.next();

      const { startRowIndex, totalRows, rows: chunkRows } = chunk.value;
      sawAnyRows = true;
      const dataEnd = totalRows - 1;

      for (let j = 0; j < chunkRows.length; j++) {
        const absoluteRow = startRowIndex + j;
        if (absoluteRow === 0) continue;
        const dataIdx = absoluteRow - 1;

        const { isValid, message, row } = isValidRow(chunkRows[j], transformed);
        if (!isValid) {
          if (insertError && message !== EMPTY_ROW_ERROR_MESSAGE) {
            errorRows[dataIdx] = message;
          }
          continue;
        }

        batchIndexes.push(dataIdx);
        batchRows.push(row);
        validCount++;

        if (batchIndexes.length >= API_BATCH_SIZE) {
          setToast(`Fetching Placekeys (${validCount} valid rows through row ${absoluteRow}/${dataEnd})...`);
          await flushBatch();
        }
      }
    }

    if (batchIndexes.length > 0) {
      setToast(`Fetching Placekeys (${validCount} valid rows)...`);
      await flushBatch();
    }

    const hasErrorsToWrite = insertError && fields[ERROR_KEY] && Object.keys(errorRows).length > 0;
    if (hasErrorsToWrite) {
      if (!fieldsFinalized) {
        await writeHeaders({ [ERROR_KEY]: fields[ERROR_KEY] }, targetSheet);
      }
      await writeResults({ [ERROR_KEY]: fields[ERROR_KEY] }, { [ERROR_KEY]: errorRows }, targetSheet, { autofit: false });
    }

    if (fieldsFinalized || hasErrorsToWrite) {
      await autofitResultColumns(fields, targetSheet);
    }

    if (!sawAnyRows) {
      setToast("This sheet looks empty.", "error");
    } else {
      setToast(`Done! Generated ${totalPlaceKeys} Placekeys.`, "success");
    }
  } catch (err) {
    setToast(err && err.message ? err.message : "Something went wrong.", "error");
  } finally {
    setGenerateLock(false);
  }
}

function renderBuildInfo() {
  const el = document.getElementById("buildInfo");
  if (!el) return;
  el.textContent = `v${__APP_VERSION__} (${__APP_COMMIT__})`;
  el.title = `Built ${__APP_BUILD_DATE__} from commit ${__APP_COMMIT__}`;
}

Office.onReady(async (info) => {
  renderBuildInfo();
  if (info.host !== Office.HostType.Excel) {
    document.body.innerHTML = "<p style='padding:12px'>This add-in only runs in Excel.</p>";
    return;
  }

  try {
    state.learnedAliases = await getLearnedAliases();
    const userPrefs = await getUserPrefs();

    await refreshSheetInfo();
    applyUserPrefs(userPrefs);
    refreshUI();
    attachFieldListeners();

    try {
      await Excel.run(async (context) => {
        context.workbook.worksheets.onActivated.add(async () => {
          try {
            await refreshSheetInfo();
          } catch (e) {
            console.log("onActivated refresh failed", e);
          }
        });
        await context.sync();
      });
    } catch (e) {
      console.log("sheet activation hook", e);
    }
  } catch (err) {
    console.error("init failed", err);
    setToast(err.message || "Failed to initialize.", "error");
  } finally {
    $("stillWorking").classList.add("hidden");
  }
});
