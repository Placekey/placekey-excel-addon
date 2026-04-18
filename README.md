# Placekey Excel Add-in

[![CI](https://github.com/Placekey/placekey-excel-addon/actions/workflows/ci.yml/badge.svg)](https://github.com/Placekey/placekey-excel-addon/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Placekey/placekey-excel-addon/actions/workflows/codeql.yml/badge.svg)](https://github.com/Placekey/placekey-excel-addon/actions/workflows/codeql.yml)
[![Publish](https://github.com/Placekey/placekey-excel-addon/actions/workflows/publish.yml/badge.svg)](https://github.com/Placekey/placekey-excel-addon/actions/workflows/publish.yml)

Install page: <https://placekey.github.io/placekey-excel-addon/>

An Office Add-in (taskpane) that generates Placekey identifiers for rows of addresses in an Excel workbook. Ported from the [Placekey Google Sheets Add-on](https://github.com/Placekey/placekey-googlesheets-addon).

Runs in **Excel for Web** and **Excel for Mac** (16.44+, September 2020 or newer). Everything runs client-side — there is no server, no proxy.

## Installation

See [`docs/install.html`](./docs/install.html) for the user-facing installer, or:

### Excel for Web

1. Download `manifest.xml` from the [latest release](https://github.com/Placekey/placekey-excel-addon/releases) (or the hosted copy on GitHub Pages).
2. Open any Excel workbook at https://office.com.
3. In the ribbon: **Insert → Add-ins → Upload My Add-in**.
4. Click **Browse**, select the downloaded `manifest.xml`, then **Upload**.
5. The **Placekey** button appears on the **Home** ribbon. Click it, enter your API key, map columns, click **Generate**.

### Excel for Mac

```bash
mkdir -p ~/Library/Containers/com.microsoft.Excel/Data/Documents/wef
mv ~/Downloads/manifest.xml ~/Library/Containers/com.microsoft.Excel/Data/Documents/wef/
```

Restart Excel. Then: **Insert → Add-ins → My Add-ins → Placekey**.

## Usage

1. Put your data in a sheet with headers in row 1 (`Name`, `Street Address`, `City`, `State`, `Zip`, `Country`, ...). Or click **Fill with sample data** in the taskpane.
2. Open the **Placekey** taskpane from the ribbon.
3. The column dropdowns auto-map common header names (`Lat`/`Lng`, `Zip`, `Province`, `Postcode`, etc., plus common typos via fuzzy match).
4. Pick which optional fields you want returned (Placekey is always returned).
5. Click **Generate**. Results are written into columns to the right of your data (or reused if headers like `Placekey` already exist).

## Features

- **Auto-mapping** of column headers with ~130 built-in aliases plus delimiter variants (`Store ID`, `store_id`, `store-id`, `StoreID` all match)
- **Fuzzy matching** catches typos (`Adress` → address, `Lattitude` → latitude)
- **International vocabulary** — US / Canada / UK (State/Province/County, ZIP/Postcode/Eircode)
- **Learned aliases** — custom mappings are saved per-user and auto-applied on subsequent sheets
- **Batch processing** — API is called 100 rows at a time with rate limiting and retry on 5xx
- **Optional error column** — write per-row validation errors for rows the API can't process
- **Per-user persistence** — API key and return-field preferences saved via `OfficeRuntime.storage`

## Development

Requires Node.js 20+.

```bash
npm install                # install deps
npm test                   # run Vitest suite (189 tests)
npm run lint               # ESLint
npm run format:check       # Prettier
npm run build              # Vite production build
npm run validate-manifest  # validate manifest.xml
```

### Local dev server

```bash
npm run dev
```

Serves the taskpane from `https://localhost:3000`. The included `manifest.xml` points at localhost for sideloading during development. Use your platform's sideload method (Excel for Mac: drop `manifest.xml` into the `wef` folder; Excel for Web: Insert → Add-ins → Upload My Add-in).

For production, `scripts/manifest-prod.js` rewrites the dev URLs to the GitHub Pages deploy URL (set `PLACEKEY_ADDIN_URL` env var to override).

### Project layout

```
src/
  taskpane.html/.js/.css  # main sidebar UI
  apikey.html/.js         # API-key dialog (opened via Office.context.ui.displayDialogAsync)
  commands.html/.js       # function-file stub for the ribbon command
  sheet-adapter.js        # Office.js wrapper for reading/writing the active sheet
  prefs-storage.js        # OfficeRuntime.storage wrapper
  logic/                  # pure logic (reused from Sheets version)
    constants.js
    automap.js            # AUTO_MAP_ALIASES + computeAutomap + fuzzy match
    edit-distance.js      # Levenshtein
    validation.js         # isValidRow, validateAllRows, minimumInputProvided, ...
    transform.js          # transformColumnMappings, prepareOutputFields
    api-client.js         # callPlacekeyApi with retry
    ui-state.js           # computeStatus, duplicateColumns
    html-helpers.js       # escapeHtml, buildSheetOptions, buildColumnOptions
    write-planner.js      # planContiguousRanges (batch-write algorithm)
test/                     # Vitest suites (ESM imports from src/logic/)
manifest.xml              # Office add-in manifest
public/assets/            # ribbon icons (served by Vite at /assets/ in dev and prod)
scripts/
  make-icons.mjs          # icon replacement notes
  manifest-prod.js        # rewrites manifest URLs for production
.github/workflows/        # CI + GitHub Pages publish
docs/install.html         # user-facing install guide
```

## License

[Apache-2.0](./LICENSE)
