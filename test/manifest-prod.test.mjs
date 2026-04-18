import { describe, it, expect } from "vitest";
import { toOfficeVersion } from "../scripts/manifest-prod.js";

describe("toOfficeVersion", () => {
  it("normalizes a plain semver to a 4-part numeric Office version", () => {
    expect(toOfficeVersion("1.2.3")).toBe("1.2.3.0");
  });

  it("passes through a version that already has four numeric parts", () => {
    expect(toOfficeVersion("1.2.3.4")).toBe("1.2.3.4");
  });

  it("pads shorter versions with zeros to four parts", () => {
    expect(toOfficeVersion("1.0")).toBe("1.0.0.0");
    expect(toOfficeVersion("2")).toBe("2.0.0.0");
  });

  it("rejects pre-release suffix versions so GA does not collide with RC", () => {
    expect(() => toOfficeVersion("1.0.0-rc1")).toThrow(/pre-release/);
    expect(() => toOfficeVersion("1.2.3-beta.2")).toThrow(/pre-release/);
    expect(() => toOfficeVersion("2.0.0-alpha")).toThrow(/pre-release/);
  });

  it("rejects build-metadata suffix versions for the same collision reason", () => {
    expect(() => toOfficeVersion("1.0.0+meta")).toThrow(/pre-release/);
    expect(() => toOfficeVersion("1.2.3+build.1")).toThrow(/pre-release/);
  });

  it("rejects versions below 1.0.0.0 (Office minimum)", () => {
    expect(() => toOfficeVersion("0.9.0")).toThrow(/below 1.0.0.0/);
    expect(() => toOfficeVersion("0.0.1")).toThrow(/below 1.0.0.0/);
  });

  it("rejects empty / missing version strings", () => {
    expect(() => toOfficeVersion("")).toThrow(/non-empty string/);
    expect(() => toOfficeVersion(null)).toThrow(/non-empty string/);
    expect(() => toOfficeVersion(undefined)).toThrow(/non-empty string/);
  });

  it("truncates versions with more than four parts (defensive)", () => {
    expect(toOfficeVersion("1.2.3.4.5")).toBe("1.2.3.4");
  });
});
