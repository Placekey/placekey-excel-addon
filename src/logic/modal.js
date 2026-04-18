const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

let isOpen = false;

export function isModalOpen() {
  return isOpen;
}

// Internal hook so tests can reset the re-entrancy guard between cases
// without reloading the module. Not part of the public UI surface.
export function __resetModalState() {
  isOpen = false;
}

export function showConfirm({ title = "Confirm", message = "", confirmLabel = "OK", cancelLabel = "Cancel", destructive = false, doc = null } = {}) {
  const d = doc || (typeof document !== "undefined" ? document : null);
  if (!d) return Promise.reject(new Error("No document available for modal"));
  if (isOpen) return Promise.reject(new Error("A confirmation dialog is already open."));

  const overlay = d.getElementById("modalOverlay");
  const titleEl = d.getElementById("modalTitle");
  const messageEl = d.getElementById("modalMessage");
  const confirmBtn = d.getElementById("modalConfirm");
  const cancelBtn = d.getElementById("modalCancel");
  if (!overlay || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
    return Promise.reject(new Error("Modal scaffold missing from DOM"));
  }

  isOpen = true;
  const previouslyFocused = d.activeElement;

  titleEl.textContent = title;
  // message may contain newlines; preserve them by splitting into paragraphs.
  while (messageEl.firstChild) messageEl.removeChild(messageEl.firstChild);
  for (const line of String(message).split("\n")) {
    const p = d.createElement("p");
    p.textContent = line;
    p.className = "modal__line";
    messageEl.appendChild(p);
  }
  confirmBtn.textContent = confirmLabel;
  cancelBtn.textContent = cancelLabel;
  confirmBtn.classList.toggle("btn-danger", !!destructive);

  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");

  return new Promise((resolve) => {
    function cleanup(result) {
      overlay.classList.add("hidden");
      overlay.setAttribute("aria-hidden", "true");
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlayClick);
      d.removeEventListener("keydown", onKeydown, true);
      isOpen = false;
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        try {
          previouslyFocused.focus();
        } catch (_e) {
          // some elements cannot regain focus (e.g. detached); ignore
        }
      }
      resolve(result);
    }
    function onConfirm() {
      cleanup(true);
    }
    function onCancel() {
      cleanup(false);
    }
    function onOverlayClick(e) {
      if (e.target === overlay) cleanup(false);
    }
    function focusableWithin() {
      return Array.from(overlay.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => !el.hasAttribute("disabled"));
    }
    function onKeydown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        cleanup(false);
        return;
      }
      if (e.key === "Enter") {
        const tag = (d.activeElement && d.activeElement.tagName) || "";
        // Don't hijack Enter inside form controls that legitimately use it.
        if (tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        cleanup(true);
        return;
      }
      if (e.key === "Tab") {
        const nodes = focusableWithin();
        if (nodes.length === 0) {
          e.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = d.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        } else if (!overlay.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlayClick);
    d.addEventListener("keydown", onKeydown, true);

    const initial = destructive ? cancelBtn : confirmBtn;
    if (typeof initial.focus === "function") initial.focus();
  });
}
