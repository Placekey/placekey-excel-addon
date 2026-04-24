# Changelog

## [Unreleased]

## 1.0.1 — 2026-04-24

### Added

- Taskpane dark mode: respects `prefers-color-scheme: dark` via a dark palette token set (#5).
- Build-version display in taskpane footer. Vite injects `__APP_VERSION__`, `__APP_COMMIT__`, and `__APP_BUILD_DATE__` as define globals rendered at the bottom of the sidebar (#10).
- `.lycheeignore` entry set for known pre-release link-check failures (#3).
- Explicit `@eslint/js` dev-dependency to satisfy ESLint 10's flat-config consumer requirement (#2).

### Fixed

- `resolveFieldValue` now respects an explicit `"— none —"` saved selection. Previously a field the user intentionally unmapped would get re-populated by auto-map on the next sheet load; now a saved `NO_INPUT_STRING` is honored and only a missing saved entry falls through to auto-map.

### Changed

- Dev-dependency major bumps: ESLint 9 → 10, Vitest 3 → 4, Vite 7 → 8, `@vitest/coverage-v8` 3 → 4, `office-addin-manifest` 1 → 2 (#2).
- `api-client` rethrow now forwards the original error via `{ cause }` per Node 20 / ES2022 idiom (#2).
- CI: Link Check runs on every PR, push to `main`, and manual dispatch (previously cron-only) (#4).
- Sideload documentation updated for Excel for Mac 16.108 and modern Excel for Web: Home-tab ribbon path, macOS quarantine xattr stripping guidance, and the Cmd+Q requirement (the Excel background process caches `wef` state). README test-count claim updated 189 → 226 and the CodeQL badge was swapped for the Link Check badge (#8).
- Footer brand SVG switched to `currentColor` so the wordmark adapts to dark mode (#6, later superseded by #9).
- Footer brand wordmark restored to the full Placekey mark from the Sheets add-on source (#9).

### Removed

- `.github/workflows/codeql.yml` — CodeQL is not available on this org and the workflow was failing on every run (#4).

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
