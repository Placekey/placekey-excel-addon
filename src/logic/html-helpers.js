import { NO_INPUT_STRING } from "./constants.js";

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML.replace(/"/g, "&quot;");
}

export function buildSheetOptions(sheetNames, activeSheet) {
  return sheetNames
    .map((name) => {
      const escaped = escapeHtml(name);
      const selected = name === activeSheet ? " selected" : "";
      return `<option value="${escaped}"${selected}>${escaped}</option>`;
    })
    .join("");
}

export function buildColumnOptions(cols) {
  let html = `<option value="${NO_INPUT_STRING}">\u2014 none \u2014</option>`;
  for (const col of cols) {
    if (col !== "") {
      const escaped = escapeHtml(col);
      html += `<option value="${escaped}">${escaped}</option>`;
    }
  }
  return html;
}
