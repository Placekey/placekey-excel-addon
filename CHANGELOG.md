# Changelog

## 1.0.0 — Initial Excel port

Port of the Placekey Google Sheets Add-on to an Excel Office Add-in (taskpane). Feature parity with the Sheets v0.0.9 release except:

- Distribution is via manifest sideload (GitHub Pages) rather than a copyable template workbook.

### Per-sheet mapping persistence

Per-sheet column mappings are stored in `workbook.settings` keyed by `worksheet.id`. The ID is stable across sheet renames, so saved mappings survive renames — equivalent to the Sheets add-on's `DocumentProperties`-keyed-by-sheetId behavior.

### Notable

- All ~130 auto-map aliases ported verbatim
- Fuzzy Levenshtein match (threshold scales with header length) ported verbatim
- 4 minimum-input rule sets ported verbatim
- API call shape and batch/rate-limit/retry behavior ported verbatim
- 189 Vitest tests pass (port of the Sheets suite — `logic`, `client`, `edge-cases`, `integration`, `write-batching`, plus new `api-client`, `ui-state`, and `manifest-prod`)
