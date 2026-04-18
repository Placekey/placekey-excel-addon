import { API_URL, MAX_RETRIES } from "./constants.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      } catch (_e) {
        throw new Error("The API returned an invalid response. Please try again.");
      }
    }

    if (code === 429) {
      throw new Error("Rate limit exceeded. Visit https://www.placekey.io/pricing to upgrade.");
    }

    if (code === 400) {
      throw new Error("The API returned an error because at least one row in this batch is malformed.");
    }

    if (code >= 500 && attempt < MAX_RETRIES) {
      await sleepImpl(1000 * attempt);
      continue;
    }

    throw new Error(`The API failed with status code ${code}.`);
  }

  throw new Error(`The API failed after ${MAX_RETRIES} retries.`);
}
