import { describe, it, expect } from "vitest";
import { callPlacekeyApi } from "../src/logic/api-client.js";

function jsonResponse(status, body, headers) {
  return {
    status,
    json: async () => body,
    headers: headers ? { get: (name) => headers[name.toLowerCase()] ?? headers[name] ?? null } : undefined,
  };
}

describe("callPlacekeyApi", () => {
  it("returns parsed JSON on 200", async () => {
    const fetchImpl = async () => jsonResponse(200, [{ query_id: "0", placekey: "abc" }]);
    const result = await callPlacekeyApi([{}], { addressMatch: false, nameMatch: false }, ["placekey"], "key", { fetchImpl });
    expect(result[0].placekey).toBe("abc");
  });

  it("sends the correct payload shape", async () => {
    let capturedBody = null;
    let capturedHeaders = null;
    const fetchImpl = async (_url, init) => {
      capturedBody = JSON.parse(init.body);
      capturedHeaders = init.headers;
      return jsonResponse(200, []);
    };
    await callPlacekeyApi([{ latitude: "37" }], { addressMatch: true, nameMatch: false }, ["placekey", "confidence_score"], "mykey", { fetchImpl });
    expect(capturedBody.queries).toEqual([{ latitude: "37" }]);
    expect(capturedBody.options.strict_address_match).toBe(true);
    expect(capturedBody.options.strict_name_match).toBe(false);
    expect(capturedBody.options.fields).toEqual(["placekey", "confidence_score"]);
    expect(capturedHeaders.apikey).toBe("mykey");
  });

  it("retries on 429 and eventually succeeds", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      if (calls < 2) return jsonResponse(429, {});
      return jsonResponse(200, [{ placekey: "ok" }]);
    };
    const sleepImpl = async () => {};
    const result = await callPlacekeyApi([], { addressMatch: false, nameMatch: false }, [], "key", { fetchImpl, sleepImpl });
    expect(calls).toBe(2);
    expect(result[0].placekey).toBe("ok");
  });

  it("honors Retry-After header (seconds) on 429", async () => {
    const delays = [];
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      if (calls === 1) return jsonResponse(429, {}, { "Retry-After": "3" });
      return jsonResponse(200, [{ placekey: "ok" }]);
    };
    const sleepImpl = async (ms) => {
      delays.push(ms);
    };
    const result = await callPlacekeyApi([], { addressMatch: false, nameMatch: false }, [], "key", { fetchImpl, sleepImpl });
    expect(result[0].placekey).toBe("ok");
    expect(delays).toEqual([3000]);
  });

  it("honors Retry-After header (HTTP date) on 429", async () => {
    const target = Date.now() + 4500;
    const retryAfter = new Date(target).toUTCString();
    const delays = [];
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      if (calls === 1) return jsonResponse(429, {}, { "Retry-After": retryAfter });
      return jsonResponse(200, [{ placekey: "ok" }]);
    };
    const sleepImpl = async (ms) => {
      delays.push(ms);
    };
    await callPlacekeyApi([], { addressMatch: false, nameMatch: false }, [], "key", { fetchImpl, sleepImpl });
    expect(delays).toHaveLength(1);
    expect(delays[0]).toBeGreaterThan(3000);
    expect(delays[0]).toBeLessThanOrEqual(4500);
  });

  it("falls back to default delay on 429 when Retry-After is absent", async () => {
    const delays = [];
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      if (calls === 1) return jsonResponse(429, {});
      return jsonResponse(200, [{ placekey: "ok" }]);
    };
    const sleepImpl = async (ms) => {
      delays.push(ms);
    };
    await callPlacekeyApi([], { addressMatch: false, nameMatch: false }, [], "key", { fetchImpl, sleepImpl });
    expect(delays).toEqual([2000]);
  });

  it("throws after exhausting retries on repeated 429", async () => {
    const fetchImpl = async () => jsonResponse(429, {});
    const sleepImpl = async () => {};
    await expect(callPlacekeyApi([], { addressMatch: false, nameMatch: false }, [], "key", { fetchImpl, sleepImpl })).rejects.toThrow(/Rate limited by the API/);
  });

  it("throws malformed-batch error on 400", async () => {
    const fetchImpl = async () => jsonResponse(400, {});
    await expect(callPlacekeyApi([], { addressMatch: false, nameMatch: false }, [], "key", { fetchImpl })).rejects.toThrow(/malformed/);
  });

  it("retries on 5xx and eventually succeeds", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      if (calls < 3) return jsonResponse(500, {});
      return jsonResponse(200, [{ placekey: "ok" }]);
    };
    const sleepImpl = async () => {};
    const result = await callPlacekeyApi([], { addressMatch: false, nameMatch: false }, [], "key", { fetchImpl, sleepImpl });
    expect(calls).toBe(3);
    expect(result[0].placekey).toBe("ok");
  });

  it("throws after exhausting retries on repeated 5xx", async () => {
    const fetchImpl = async () => jsonResponse(500, {});
    const sleepImpl = async () => {};
    await expect(callPlacekeyApi([], { addressMatch: false, nameMatch: false }, [], "key", { fetchImpl, sleepImpl })).rejects.toThrow(/status code 500/);
  });

  it("throws 'invalid response' when the 200 body is not valid JSON", async () => {
    const fetchImpl = async () => ({
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON at position 0");
      },
    });
    await expect(callPlacekeyApi([], { addressMatch: false, nameMatch: false }, [], "key", { fetchImpl })).rejects.toThrow(/invalid response/);
  });

  it("throws generic status-code error on unhandled non-200 codes (e.g. 418)", async () => {
    const fetchImpl = async () => jsonResponse(418, {});
    await expect(callPlacekeyApi([], { addressMatch: false, nameMatch: false }, [], "key", { fetchImpl })).rejects.toThrow(/status code 418/);
  });

  it("uses default sleep between retries when sleepImpl is not supplied (smoke test)", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      if (calls === 1) return jsonResponse(500, {});
      return jsonResponse(200, [{ placekey: "ok" }]);
    };
    // Keep sleep short by only hitting one 5xx; the first retry sleeps 1000ms but we await it.
    const before = Date.now();
    const result = await callPlacekeyApi([], { addressMatch: false, nameMatch: false }, [], "key", { fetchImpl });
    const elapsed = Date.now() - before;
    expect(result[0].placekey).toBe("ok");
    expect(calls).toBe(2);
    expect(elapsed).toBeGreaterThanOrEqual(900);
  }, 10000);
});
