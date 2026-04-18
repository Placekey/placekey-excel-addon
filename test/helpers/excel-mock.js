// Minimal in-memory double of the Excel / Office.js surface that
// src/sheet-adapter.js uses. Only the properties/methods that adapter
// actually touches are modelled. Everything goes through context.sync()
// semantics: properties requested via .load() are not readable until
// context.sync() has resolved, matching the real runtime's proxy behaviour.

class Setting {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.isNullObject = false;
    this._pending = new Set();
  }
  load(props) {
    const list = Array.isArray(props) ? props : [props];
    for (const p of list) this._pending.add(p);
    return this;
  }
}

class NullSetting {
  constructor() {
    this.isNullObject = true;
    this._pending = new Set();
  }
  load() {
    return this;
  }
}

class Settings {
  constructor() {
    this._items = new Map();
  }
  add(key, value) {
    this._items.set(key, new Setting(key, value));
  }
  getItemOrNullObject(key) {
    const existing = this._items.get(key);
    return existing || new NullSetting();
  }
}

class Range {
  constructor(sheet, rowIndex, columnIndex, rowCount, columnCount) {
    this._sheet = sheet;
    this.rowIndex = rowIndex;
    this.columnIndex = columnIndex;
    this.rowCount = rowCount;
    this.columnCount = columnCount;
    this.isNullObject = false;
    this._pending = new Set();
    this.format = {
      autofitColumns: () => {
        sheet._autofitCalls.push({ rowIndex, columnIndex, rowCount, columnCount });
      },
    };
    // Values setter writes synchronously into the sheet matrix on assignment;
    // real Excel.js defers until sync() but for our tests we only ever read
    // after sync(), so the distinction doesn't matter.
    Object.defineProperty(this, "values", {
      get: () => this._readSlice("values"),
      set: (v) => {
        this._writeSlice("values", v);
      },
    });
    Object.defineProperty(this, "text", {
      get: () => this._readSlice("text"),
      set: (v) => {
        this._writeSlice("text", v);
      },
    });
  }
  load(props) {
    const list = Array.isArray(props) ? props : [props];
    for (const p of list) this._pending.add(p);
    return this;
  }
  _readSlice(kind) {
    const out = [];
    for (let r = 0; r < this.rowCount; r++) {
      const row = [];
      for (let c = 0; c < this.columnCount; c++) {
        const cell = this._sheet._cellAt(this.rowIndex + r, this.columnIndex + c);
        row.push(cell == null ? "" : kind === "text" ? String(cell) : cell);
      }
      out.push(row);
    }
    return out;
  }
  _writeSlice(_kind, values) {
    for (let r = 0; r < values.length; r++) {
      for (let c = 0; c < values[r].length; c++) {
        this._sheet._setCell(this.rowIndex + r, this.columnIndex + c, values[r][c]);
      }
    }
    this._sheet._recomputeUsedRange();
  }
}

class NullRange {
  constructor() {
    this.isNullObject = true;
    this._pending = new Set();
  }
  load() {
    return this;
  }
}

class Tables {
  constructor(sheet) {
    this._sheet = sheet;
    this._items = [];
  }
  add(headerRange, _hasHeaders) {
    const table = {
      rows: {
        add: (_where, rows) => {
          const startRow = headerRange.rowIndex + headerRange.rowCount;
          for (let r = 0; r < rows.length; r++) {
            for (let c = 0; c < rows[r].length; c++) {
              this._sheet._setCell(startRow + r, headerRange.columnIndex + c, rows[r][c]);
            }
          }
          this._sheet._recomputeUsedRange();
        },
      },
    };
    this._items.push(table);
    return table;
  }
}

class Worksheet {
  constructor({ id, name, data = [] }) {
    this.id = id;
    this.name = name;
    // data is a 2D array of cells (undefined/"" = empty)
    this._data = data.map((row) => row.slice());
    this._pending = new Set();
    this._activated = false;
    this._autofitCalls = [];
    this.tables = new Tables(this);
    this.freezePanes = {
      freezeRows: (n) => {
        this._frozenRows = n;
      },
    };
    this._recomputeUsedRange();
  }
  load(props) {
    const list = Array.isArray(props) ? props : [props];
    for (const p of list) this._pending.add(p);
    return this;
  }
  activate() {
    this._activated = true;
  }
  _cellAt(r, c) {
    const row = this._data[r];
    if (!row) return "";
    return row[c] == null ? "" : row[c];
  }
  _setCell(r, c, value) {
    while (this._data.length <= r) this._data.push([]);
    const row = this._data[r];
    while (row.length <= c) row.push("");
    row[c] = value;
  }
  _recomputeUsedRange() {
    let minRow = Infinity;
    let minCol = Infinity;
    let maxRow = -1;
    let maxCol = -1;
    for (let r = 0; r < this._data.length; r++) {
      const row = this._data[r] || [];
      for (let c = 0; c < row.length; c++) {
        const v = row[c];
        if (v == null || v === "") continue;
        if (r < minRow) minRow = r;
        if (c < minCol) minCol = c;
        if (r > maxRow) maxRow = r;
        if (c > maxCol) maxCol = c;
      }
    }
    if (maxRow < 0) {
      this._usedRange = null;
      return;
    }
    this._usedRange = {
      rowIndex: minRow,
      columnIndex: minCol,
      rowCount: maxRow - minRow + 1,
      columnCount: maxCol - minCol + 1,
    };
  }
  getUsedRangeOrNullObject() {
    if (!this._usedRange) return new NullRange();
    const u = this._usedRange;
    return new Range(this, u.rowIndex, u.columnIndex, u.rowCount, u.columnCount);
  }
  getUsedRange() {
    if (!this._usedRange) {
      // Real Excel throws; return a one-cell range so autofit doesn't crash.
      return new Range(this, 0, 0, 1, 1);
    }
    const u = this._usedRange;
    return new Range(this, u.rowIndex, u.columnIndex, u.rowCount, u.columnCount);
  }
  getRangeByIndexes(rowIndex, columnIndex, rowCount, columnCount) {
    return new Range(this, rowIndex, columnIndex, rowCount, columnCount);
  }
}

class Worksheets {
  constructor(sheets, activeId) {
    this._sheets = sheets;
    this._activeId = activeId;
    this._pending = new Set();
  }
  load(props) {
    const list = Array.isArray(props) ? props : [props];
    for (const p of list) this._pending.add(p);
    return this;
  }
  getActiveWorksheet() {
    return this._sheets.find((s) => s.id === this._activeId);
  }
  getItem(name) {
    const found = this._sheets.find((s) => s.name === name);
    if (!found) throw new Error(`ItemNotFound: ${name}`);
    return found;
  }
  getItemOrNullObject(name) {
    const found = this._sheets.find((s) => s.name === name);
    if (found) return found;
    const nullSheet = {
      isNullObject: true,
      id: "",
      name: "",
      _pending: new Set(),
      load(props) {
        const list = Array.isArray(props) ? props : [props];
        for (const p of list) this._pending.add(p);
        return this;
      },
    };
    return nullSheet;
  }
  get items() {
    return this._sheets;
  }
}

class Workbook {
  constructor({ sheets, activeId }) {
    this.worksheets = new Worksheets(sheets, activeId);
    this.settings = new Settings();
  }
}

class Context {
  constructor(workbook) {
    this.workbook = workbook;
    this._syncCount = 0;
  }
  async sync() {
    // In the real runtime, sync resolves all pending .load()s. Our mock
    // already has the data available synchronously; sync() just clears
    // the pending markers and counts as a round-trip for assertions.
    this._syncCount += 1;
  }
}

// Shape a test fixture into the mock.
//
// spec: {
//   sheets: [{ id, name, data: [[...], [...]] }],
//   activeId: string,
//   settings: { key: value }
// }
export function createExcelMock(spec = {}) {
  const sheets = (spec.sheets || []).map((s) => new Worksheet(s));
  const activeId = spec.activeId || (sheets[0] && sheets[0].id) || "";
  const workbook = new Workbook({ sheets, activeId });
  for (const [key, value] of Object.entries(spec.settings || {})) {
    workbook.settings.add(key, value);
  }

  const contextRef = { current: null };

  const Excel = {
    async run(fn) {
      const context = new Context(workbook);
      contextRef.current = context;
      return await fn(context);
    },
  };

  return {
    Excel,
    workbook,
    sheets,
    getContext: () => contextRef.current,
    // Test helpers
    renameSheet(id, newName) {
      const sheet = sheets.find((s) => s.id === id);
      if (sheet) sheet.name = newName;
    },
    deleteSheet(id) {
      const idx = sheets.findIndex((s) => s.id === id);
      if (idx >= 0) sheets.splice(idx, 1);
    },
    getSheetById(id) {
      return sheets.find((s) => s.id === id);
    },
  };
}

// Install the mock as the module-level Excel global that sheet-adapter.js uses.
// Returns a cleanup function that restores the previous state.
export function installExcelGlobal(mock) {
  const g = globalThis;
  const previous = { Excel: g.Excel, hadExcel: "Excel" in g };
  g.Excel = mock.Excel;
  return () => {
    if (previous.hadExcel) g.Excel = previous.Excel;
    else delete g.Excel;
  };
}
