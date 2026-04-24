import { API_URL, MAX_RETRIES, RETRY_AFTER_DEFAULT_MS } from "./constants.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(res) {
  const raw = res.headers && typeof res.headers.get === "function" ? res.headers.get("Retry-After") : null;
  if (!raw) return RETRY_AFTER_DEFAULT_MS;
  const asSeconds = Number(raw);
  if (Number.isFinite(asSeconds)) return Math.max(0, asSeconds * 1000);
  const asDate = Date.parse(raw);
  if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now());
  return RETRY_AFTER_DEFAULT_MS;
}

export async function callPlacekeyApi(batch, options, requestFields, apiKey, { fetchImpl = fetch, url = API_URL, sleepImpl = sleep } = {}) {
  const payload = {
    queries: batch,
    options: {
      strict_address_match: options.addressMatch,
      strict_name_match: options.nameMatch,
      fields: requestFields,
    },
  };

  const init = {
    method: "POST",
    headers: {
      apikey: apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetchImpl(url, init);
    const code = res.status;

    if (code === 200) {
      try {
        return await res.json();
      } catch (cause) {
        throw new Error("The API returned an invalid response. Please try again.", { cause });
      }
    }

    if (code === 400) {
      throw new Error("The API returned an error because at least one row in this batch is malformed.");
    }

    if ((code === 429 || code >= 500) && attempt < MAX_RETRIES) {
      const delay = code === 429 ? retryAfterMs(res) : 1000 * attempt;
      await sleepImpl(delay);
      continue;
    }

    if (code === 429) {
      throw new Error(`Rate limited by the API after ${MAX_RETRIES} retries. Wait a moment and try again, or upgrade at https://www.placekey.io/pricing.`);
    }

    throw new Error(`The API failed with status code ${code}.`);
  }

  throw new Error(`The API failed after ${MAX_RETRIES} retries.`);
}
