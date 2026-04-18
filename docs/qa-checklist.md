# Placekey Excel Add-in — Pre-release QA Checklist (v1.0.0)

Run this end-to-end on both Excel on the Web and Excel for Mac before shipping.
Do not use real PII. Use the built-in sample data or synthetic fixtures only.

## Setup

### Excel on the Web

- [ ] Open any workbook at <https://office.com>.
- [ ] Home tab → Add-ins → More Settings → My Add-ins → Upload My Add-in.
- [ ] Choose `manifest.xml` from the repo root (built or dev copy).
- [ ] Confirm "Placekey" group appears on the Home ribbon.
- [ ] Click the Placekey ribbon button → taskpane loads without console errors.

### Excel for Mac

- [ ] Quit Excel fully.
- [ ] Copy `manifest.xml` to `~/Library/Containers/com.microsoft.Excel/Data/Documents/wef/` (create `wef/` if missing).
- [ ] Launch Excel, open any workbook.
- [ ] Insert tab → My Add-ins → Developer Add-ins → select "Placekey".
- [ ] Confirm "Placekey" group appears on the Home ribbon.
- [ ] Click the Placekey ribbon button → taskpane loads without console errors.

### Test API key

- [ ] Obtain a personal API key from <https://dashboard.placekey.io/>.
- [ ] Confirm NO real PII will be sent (use sample data or synthetic rows only).
- [ ] Have the key ready to paste into the API key dialog.

## Golden path (must pass)

1. Open a fresh blank workbook → click Placekey ribbon button → taskpane opens with "This sheet looks empty."
2. Click "Change API key" → paste test key → Save → dialog closes, no error toast.
3. Click "Fill with sample data" → 5-row table inserted in row 1, header row frozen, columns autofit.
4. Taskpane re-renders with column dropdowns populated → verify "Street Address" auto-mapped to address, "City" to city, "State" to state, "Zip code" to zip, "Latitude" to latitude, "Longitude" to longitude.
5. Status chip reads "Ready to generate" in green.
6. Click Generate → toast cycles "Loading rows…" → "Fetching Placekeys for N/N valid rows…" → "Done! Generated N Placekeys." in green.
7. Verify `placekey` column appended to the right of the sample table, populated for all valid rows.
8. Tick the Geocode return field → click Generate again → overwrite confirm dialog appears listing `placekey` (and geocode columns if present) → click OK.
9. Verify `geocode_latitude`, `geocode_longitude`, `geocode_precision` columns appended and populated.
10. Click Generate a third time → overwrite confirm dialog lists all previously written columns → click Cancel → toast reads "Cancelled." → no cells changed.

## Edge cases

### Input validation

- [ ] Clear the address mapping (set to "- no input -") → status chip flips to warning → Generate button disabled (aria-disabled="true").
- [ ] Click the disabled Generate → error toast explains what is missing.
- [ ] Map the same sheet column to two fields → status chip flips to conflict → Generate disabled.

### Malformed rows

- [ ] Insert a row with zip `"abc"` and blank lat/lng → tick "Insert error column" → Generate → row's `placekey` blank, `error` column populated with validation message.
- [ ] Insert a row with lat `"999"` and blank address → Generate → row skipped, error column populated, valid rows still resolve.

### Scale and rate limiting

- [ ] Populate a sheet with >100 valid rows (synthetic addresses). Generate → toast updates through multiple batches → taskpane remains responsive (can scroll, click Refresh after completion).
- [ ] Open DevTools Network tab → confirm successive `/placekeys` calls are spaced ≥ 1.1 s apart.
- [ ] Taskpane does not freeze; Excel remains interactive during the run.

### Sheet race conditions

- [ ] Start Generate on a large batch → immediately rename the active sheet in Excel → generate completes, results written to the renamed sheet.
- [ ] Start Generate → click another sheet tab mid-run → results still land on the original target sheet, NOT the newly-active one.
- [ ] Start Generate → delete the target sheet mid-run → taskpane shows a clean error toast ("Target sheet … is no longer available.") → no Office.js uncaught exception in console.

### API errors

- [ ] Paste a deliberately invalid API key via "Change API key" → Generate → error toast surfaces the 401/403 message clearly.
- [ ] Blank the API key and Generate → API key dialog opens → close without saving → toast reads "An API key is required." → state lock released (Generate clickable again).
- [ ] Simulate 429 (burst-fire against rate limit, or use throttled key) → retry-with-backoff kicks in → eventually succeeds or fails cleanly with surfaced message.
- [ ] DevTools → Network → Offline → Generate → fetch fails with clean error toast, no hang, UI lock released.

### UI safety

- [ ] Double-click Generate rapidly → only one run executes → second click is swallowed by `state.isGenerating` guard.
- [ ] While Generate is running, confirm sheet dropdown, Refresh button, all checkboxes, and column selects are disabled.
- [ ] Create a header named `<img src=x onerror="alert(1)">` → reopen taskpane → dropdown option renders as literal text, no alert fires, no HTML injection.
- [ ] Create a header containing `"double quotes"` → dropdown value survives round-trip (select it, Generate, reopen → still selected).

### Persistence

- [ ] Map columns and Generate (succeeds) → close the workbook → reopen → aliases still auto-map the same headers on a fresh sheet.
- [ ] Set the API key → close Excel entirely → reopen → API key still stored (no dialog on Generate).
- [ ] Map columns on Sheet1, switch to Sheet2 (different headers) and map, switch back to Sheet1 → Sheet1's mapping restored.
- [ ] Rename Sheet1 → reopen taskpane → mapping survives rename (keyed by worksheet id).

### Return-field behavior

- [ ] Toggle all return fields off → Generate → only `placekey` column written.
- [ ] Toggle Geocode only → Generate → `placekey`, `geocode_latitude`, `geocode_longitude`, `geocode_precision` written.
- [ ] Toggle every return field on → Generate → all request fields appear as columns populated where the API returns values.
- [ ] Uncheck a return field, reopen taskpane → checkbox state restored from user prefs.

## Platform-specific spots to double-check

### Excel on the Web

- [ ] `window.confirm` overwrite dialog renders (not silently auto-dismissed).
- [ ] Ribbon button visible on Home tab under "Placekey" group.
- [ ] Taskpane opens in right-hand rail, no horizontal scrollbar at default width.
- [ ] Sample data inserts as a styled ListObject (Excel Table) with filter dropdowns on header row.

### Excel for Mac

- [ ] `window.confirm` overwrite dialog renders natively (not clipped by taskpane edge).
- [ ] Frozen header row survives after insert → scroll down, row 1 stays pinned.
- [ ] Ribbon button visible on Home tab under "Placekey" group.
- [ ] Taskpane resize works; controls do not overflow.
- [ ] API key dialog (`displayDialogAsync`) opens as a separate window, not inline.

### Both platforms

- [ ] Generate button title updates to reflect readiness state on hover.
- [ ] Toast colors: neutral during progress, green on success, red on error.
- [ ] Cmd/Ctrl-Z after Generate: does NOT un-do the write (Office.js writes are out-of-band); behavior documented.
- [ ] Closing the taskpane mid-generate: no orphan state; reopening shows clean UI.

## Sign-off

| Platform      | Tested | Tester | Date | Build/Version |
| ------------- | ------ | ------ | ---- | ------------- |
| Excel Web     | ☐      |        |      | v1.0.0        |
| Excel for Mac | ☐      |        |      | v1.0.0        |

- [ ] All Golden path items pass on both platforms.
- [ ] All Edge case items exercised; any failures filed as issues with reproduction steps.
- [ ] Platform-specific checks confirmed on both platforms.
- [ ] Release approved to tag `v1.0.0` and push.

Notes / deviations observed during QA:

```
(space for tester notes)
```
