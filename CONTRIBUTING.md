# Contributing to render-fetch

## Dev setup

Requirements: Node 20+

```bash
git clone https://github.com/sub-techie09/render-fetch.git
cd render-fetch
npm install --ignore-scripts   # skips the build step during install
npm run build
npm test
```

## Running integration tests

Integration tests make real network requests and are not run in CI by default.

```bash
INTEGRATION_TESTS=true npm test
```

## Pull requests

- One feature or fix per PR
- Unit tests required for new logic
- Update README if tool behavior or params change
- Checklist in the PR template must pass

## Reporting bugs

Use the **Bug Report** issue template. The most useful thing you can include is the exact URL that fails, the mode used (`auto` / `static` / `browser`), and the actual vs expected output.

## Feature requests

Use the **Feature Request** issue template.

## Good first issues

Issues labeled [`good first issue`](https://github.com/sub-techie09/render-fetch/labels/good%20first%20issue) are intentionally scoped to be approachable without deep codebase knowledge. Great place to start.
