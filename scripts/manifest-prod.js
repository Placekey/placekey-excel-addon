#!/usr/bin/env node
// Produces dist/manifest.xml from manifest.xml with:
//   1. localhost dev URLs rewritten to the production Pages URL.
//   2. <Version> synced to package.json version (normalized to 4-part
//      numeric as Office requires).
//
// Refuses pre-release / build-metadata semver (e.g. 1.0.0-rc1, 1.0.0+meta):
// Office manifests are 4-part numeric only, so stripping the suffix would
// silently produce the same bytes as eventual GA (1.0.0.0) and a sideloaded
// RC would collide with the later production manifest. CI workflow tag-globs
// already gate this for publishes; this guard covers the local-run path.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

export function toOfficeVersion(semver) {
  if (typeof semver !== "string" || semver.length === 0) {
    throw new Error(`package.json#version must be a non-empty string. Got: ${JSON.stringify(semver)}.`);
  }
  if (semver.includes("-") || semver.includes("+")) {
    throw new Error(
      `Refusing to build a production manifest from a pre-release / build-metadata version: "${semver}". ` +
        `Office manifests use 4-part numeric versions (X.Y.Z.W), so stripping the suffix would produce the ` +
        `same bytes as the eventual GA release (X.Y.Z.0). Bump package.json#version to a plain "X.Y.Z" before ` +
        `running rewrite-manifest.`,
    );
  }
  const parts = semver.split(".").map((n) => String(parseInt(n, 10) || 0));
  while (parts.length < 4) parts.push("0");
  const normalized = parts.slice(0, 4).join(".");
  const major = parseInt(parts[0], 10);
  if (!major || major < 1) {
    throw new Error(`Office rejects manifest versions below 1.0.0.0. package.json#version is "${semver}" (normalized "${normalized}"). Bump to >= 1.0.0 before building.`);
  }
  return normalized;
}

// When invoked as a script (node scripts/manifest-prod.js), run the rewrite.
// When imported for testing, the side-effect block below is skipped.
if (import.meta.url === `file://${process.argv[1]}`) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(__dirname, "..");

  const PROD_URL = process.env.PLACEKEY_ADDIN_URL || "https://placekey.github.io/placekey-excel-addon";
  const DEV_URL = "https://localhost:3000";

  const pkg = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
  const version4 = toOfficeVersion(pkg.version);

  const src = readFileSync(resolve(repoRoot, "manifest.xml"), "utf8");
  let out = src.split(DEV_URL).join(PROD_URL);
  out = out.replace(/<Version>[^<]+<\/Version>/, `<Version>${version4}</Version>`);

  const distDir = resolve(repoRoot, "dist");
  if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
  writeFileSync(resolve(distDir, "manifest.xml"), out);

  console.log(`Wrote ${resolve(distDir, "manifest.xml")} with base URL ${PROD_URL} and <Version>${version4}</Version>`);
}
