# Contributing

Thanks for your interest in the Placekey Excel Add-in.

## Development setup

```bash
npm install
npm test              # Vitest, 189 tests
npm run lint          # ESLint
npm run format:check  # Prettier
npm run build         # Vite
npm run validate-manifest
npm run dev           # local dev server at https://localhost:3000
```

Node 20 or 22. Pull requests run CI against both.

## Pull requests

1. Fork + branch from `main`.
2. Keep PRs focused — one behavior change per PR.
3. Preserve test coverage. All logic changes land with tests.
4. Run `npm run format && npm run lint && npm test` locally before pushing.
5. CI must be green before merge.

## Branch protection

`main` should be protected with:

- Require PR before merge
- Require status checks: `test (20)`, `test (22)`, `Analyze (javascript-typescript)` (CodeQL)
- Require branches up to date before merge
- Restrict direct push to admins only
- Require linear history

These are enforced via repository Settings → Branches, not in this repo.

## Releases

Releases are driven by `v*` tags on `main`:

```bash
npm version 1.2.3        # bumps package.json and creates a git tag
git push --follow-tags
```

On tag push, the **Release** workflow runs `npm test`, `npm run build`, rewrites `manifest.xml` to point at the production Pages URL with the new version, and creates a GitHub Release with `manifest.xml` attached. The **Publish** workflow deploys the same build to GitHub Pages.

The `<Version>` element in `manifest.xml` is synced from `package.json#version` at build time (see `scripts/manifest-prod.js`) — do not edit manifest version by hand. Office requires a 4-part numeric version and rejects versions below `1.0`, so `package.json#version` must be `>= 1.0.0`.

## Dependencies

- npm deps and GitHub Actions are managed by Dependabot (see `.github/dependabot.yml`).
- All GitHub Actions are pinned to a full commit SHA with a `# vX.Y.Z` trailing comment. Dependabot parses the comment to propose updates that rewrite both the SHA and the comment. If you add a new action, follow the same pattern:

  ```yaml
  uses: owner/repo@<40-char-sha> # vX.Y.Z
  ```

## Reporting bugs

Open an issue with:

- What you tried (OS + Excel version, sample headers, action taken).
- What you expected.
- What actually happened (screenshot + console output if possible — open browser DevTools on Excel for Web, or the Office.js debugger on Mac).
