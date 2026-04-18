import { getApiKey, setApiKey } from "./prefs-storage.js";

Office.onReady(async () => {
  const input = document.getElementById("key");
  const errorEl = document.getElementById("error");
  const btn = document.getElementById("finishSetup");

  try {
    const existing = await getApiKey();
    if (existing) input.value = existing;
  } catch (_e) {
    // ignore
  }

  async function submit() {
    errorEl.style.display = "none";
    const key = input.value;
    if (!key || !key.trim()) {
      errorEl.textContent = "Please enter a valid API key.";
      errorEl.style.display = "block";
      return;
    }
    try {
      await setApiKey(key);
      Office.context.ui.messageParent(JSON.stringify({ ok: true }));
    } catch (e) {
      errorEl.textContent = e.message || "Something went wrong saving the key.";
      errorEl.style.display = "block";
    }
  }

  btn.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });
});
