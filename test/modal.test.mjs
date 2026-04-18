// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { showConfirm, isModalOpen, __resetModalState } from "../src/logic/modal.js";

function mountScaffold() {
  document.body.innerHTML = `
    <button id="trigger">trigger</button>
    <div id="modalOverlay" class="modal-overlay hidden" aria-hidden="true">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" aria-describedby="modalMessage">
        <h3 id="modalTitle" class="modal__title"></h3>
        <div id="modalMessage" class="modal__message"></div>
        <div class="modal__actions">
          <button id="modalCancel" type="button" class="btn btn-secondary">Cancel</button>
          <button id="modalConfirm" type="button" class="btn btn-primary">OK</button>
        </div>
      </div>
    </div>
  `;
}

function keydown(key, opts = {}) {
  document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...opts }));
}

describe("showConfirm", () => {
  beforeEach(() => {
    __resetModalState();
    mountScaffold();
  });

  afterEach(() => {
    __resetModalState();
  });

  it("resolves true when confirm button is clicked", async () => {
    const p = showConfirm({ title: "T", message: "M" });
    document.getElementById("modalConfirm").click();
    expect(await p).toBe(true);
  });

  it("resolves false when cancel button is clicked", async () => {
    const p = showConfirm({ title: "T", message: "M" });
    document.getElementById("modalCancel").click();
    expect(await p).toBe(false);
  });

  it("resolves false when Escape is pressed", async () => {
    const p = showConfirm({ title: "T", message: "M" });
    keydown("Escape");
    expect(await p).toBe(false);
  });

  it("resolves true when Enter is pressed", async () => {
    const p = showConfirm({ title: "T", message: "M" });
    keydown("Enter");
    expect(await p).toBe(true);
  });

  it("closes when clicking the overlay backdrop", async () => {
    const p = showConfirm({ title: "T", message: "M" });
    const overlay = document.getElementById("modalOverlay");
    overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(await p).toBe(false);
  });

  it("keeps modal open when clicking inside the dialog card", async () => {
    const p = showConfirm({ title: "T", message: "M" });
    document.querySelector(".modal").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(isModalOpen()).toBe(true);
    document.getElementById("modalConfirm").click();
    await p;
  });

  it("sets dialog title and message", async () => {
    const p = showConfirm({ title: "Delete?", message: "Line one\nLine two" });
    expect(document.getElementById("modalTitle").textContent).toBe("Delete?");
    const lines = document.querySelectorAll("#modalMessage .modal__line");
    expect(lines).toHaveLength(2);
    expect(lines[0].textContent).toBe("Line one");
    expect(lines[1].textContent).toBe("Line two");
    document.getElementById("modalConfirm").click();
    await p;
  });

  it("uses custom labels", async () => {
    const p = showConfirm({ title: "T", message: "M", confirmLabel: "Overwrite", cancelLabel: "Keep" });
    expect(document.getElementById("modalConfirm").textContent).toBe("Overwrite");
    expect(document.getElementById("modalCancel").textContent).toBe("Keep");
    document.getElementById("modalCancel").click();
    await p;
  });

  it("applies destructive styling and defaults focus to cancel", async () => {
    const p = showConfirm({ title: "T", message: "M", destructive: true });
    const confirmBtn = document.getElementById("modalConfirm");
    const cancelBtn = document.getElementById("modalCancel");
    expect(confirmBtn.classList.contains("btn-danger")).toBe(true);
    expect(document.activeElement).toBe(cancelBtn);
    cancelBtn.click();
    await p;
  });

  it("non-destructive default focuses the confirm button", async () => {
    const p = showConfirm({ title: "T", message: "M" });
    expect(document.activeElement).toBe(document.getElementById("modalConfirm"));
    document.getElementById("modalConfirm").click();
    await p;
  });

  it("sets role=dialog and aria-modal when open", async () => {
    const p = showConfirm({ title: "T", message: "M" });
    const dialog = document.querySelector("[role='dialog']");
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("modalTitle");
    expect(document.getElementById("modalOverlay").getAttribute("aria-hidden")).toBe("false");
    document.getElementById("modalCancel").click();
    await p;
  });

  it("restores aria-hidden when closed", async () => {
    const p = showConfirm({ title: "T", message: "M" });
    document.getElementById("modalCancel").click();
    await p;
    expect(document.getElementById("modalOverlay").getAttribute("aria-hidden")).toBe("true");
    expect(document.getElementById("modalOverlay").classList.contains("hidden")).toBe(true);
  });

  it("restores focus to previously focused element on close", async () => {
    const trigger = document.getElementById("trigger");
    trigger.focus();
    const p = showConfirm({ title: "T", message: "M" });
    expect(document.activeElement).not.toBe(trigger);
    document.getElementById("modalCancel").click();
    await p;
    expect(document.activeElement).toBe(trigger);
  });

  it("rejects when a second showConfirm is issued while open", async () => {
    const p1 = showConfirm({ title: "A", message: "A" });
    await expect(showConfirm({ title: "B", message: "B" })).rejects.toThrow(/already open/);
    document.getElementById("modalCancel").click();
    await p1;
  });

  it("isModalOpen reflects current state", async () => {
    expect(isModalOpen()).toBe(false);
    const p = showConfirm({ title: "T", message: "M" });
    expect(isModalOpen()).toBe(true);
    document.getElementById("modalCancel").click();
    await p;
    expect(isModalOpen()).toBe(false);
  });

  it("traps Tab forward from last focusable back to first", async () => {
    const p = showConfirm({ title: "T", message: "M" });
    const confirmBtn = document.getElementById("modalConfirm");
    const cancelBtn = document.getElementById("modalCancel");
    confirmBtn.focus();
    keydown("Tab");
    expect(document.activeElement).toBe(cancelBtn);
    document.getElementById("modalCancel").click();
    await p;
  });

  it("traps Shift+Tab backward from first focusable to last", async () => {
    const p = showConfirm({ title: "T", message: "M" });
    const confirmBtn = document.getElementById("modalConfirm");
    const cancelBtn = document.getElementById("modalCancel");
    cancelBtn.focus();
    keydown("Tab", { shiftKey: true });
    expect(document.activeElement).toBe(confirmBtn);
    document.getElementById("modalConfirm").click();
    await p;
  });

  it("rejects when scaffold is missing", async () => {
    document.body.innerHTML = "";
    await expect(showConfirm({ title: "T", message: "M" })).rejects.toThrow(/scaffold missing/);
  });
});
