# render-fetch

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/render-fetch.svg)](https://www.npmjs.com/package/render-fetch)
[![CI](https://github.com/sub-techie09/render-fetch/actions/workflows/test.yml/badge.svg)](https://github.com/sub-techie09/render-fetch/actions/workflows/test.yml)

Drop-in upgrade to Claude Code's WebFetch — handles JS-rendered pages automatically.

Claude's built-in `WebFetch` doesn't execute JavaScript. Modern SPAs return empty skeletons. `render-fetch` auto-detects whether a page needs a real browser and routes accordingly — no config needed.

## Installation

Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "render-fetch": {
      "command": "npx",
      "args": ["-y", "render-fetch"]
    }
  }
}
```

First run installs Chromium (~150MB, one-time). Subsequent runs are instant.

## How it works

```
URL in
  │
  ├─ GET page (fast, reuses response)
  │
  ├─ Score for JS-rendering signals
  │     <div id="root/app/__next">  +3
  │     thin body (<500 chars)      +2
  │     data-reactroot / ng-version +2
  │     window.__REDUX_STATE__      +2
  │     bundled JS patterns         +1
  │     .md / docs domain           -3
  │
  ├─ Score < 3 → Static path
  │     HTTP → cheerio → Readability → markdown
  │
  └─ Score ≥ 3 → Browser path
        Playwright headless → networkidle → Readability → markdown
```

## Tools

| Tool | What it does | Key params | Returns |
|---|---|---|---|
| `fetch` | Fetch page as markdown (auto-detects mode) | `url`, `mode` (auto/static/browser), `maxLength` (default 50k), `timeout` (default 30s) | Clean markdown |
| `fetch_raw` | Fetch page as raw HTML | `url`, `mode`, `timeout` | Raw HTML string |
| `screenshot` | Take a viewport screenshot | `url`, `fullPage` (default false), `timeout` | Base64 PNG (max 2MB) |

**Why not always use the browser?** Static path averages ~200ms. Browser path averages 2–3s plus Chromium launch overhead on first request.

## Known limitations

- **DNS rebinding**: hostname validation happens before the request; a malicious server could theoretically redirect to a private IP after validation. Mitigation planned for v1.1.
- **Local use only**: not designed for multi-tenant server deployments. For that, put a rate-limiting reverse proxy in front.
- **Chromium install**: ~150MB one-time download on first browser-mode request.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © 2026 sub-techie09
