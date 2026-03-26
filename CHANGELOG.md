# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-26

### Added
- `fetch` MCP tool — fetches any URL and returns clean LLM-optimized markdown, auto-detecting whether JS rendering is needed
- `fetch_raw` MCP tool — returns raw HTML with the same auto-detection
- `screenshot` MCP tool — returns a base64 PNG viewport screenshot (max 2MB)
- Auto-detection heuristic: scores page body and headers for SPA signals (React, Next.js, Angular, Vue, Nuxt); routes to Playwright if score ≥ 3
- Playwright Chromium auto-install on first browser-mode request (~150MB, one-time)
- SSRF protection: blocks private IP ranges, IPv4-mapped IPv6, metadata endpoints, and non-HTTP(S) protocols
- Safe redirect following: validates each redirect target before following (max 5 hops)
- Content size cap: aborts responses over 10MB; truncates markdown output at configurable `maxLength`
- Hard timeouts on all operations (HTTP 10s, Playwright goto 30s, browser launch 15s)
