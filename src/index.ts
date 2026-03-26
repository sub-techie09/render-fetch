#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { FetchOptionsSchema, FetchRawOptionsSchema, ScreenshotOptionsSchema } from './types.js';
import { route, routeRaw } from './router.js';
import { screenshotBrowser, ensureChromium, closeBrowser } from './extractors/browser.js';
import { validateUrl } from './utils/validate.js';

const server = new McpServer({
  name: 'render-fetch',
  version: '0.1.0',
});

// Tool: fetch — auto-detects static vs JS, returns clean markdown
server.tool(
  'fetch',
  'Fetch a webpage and return its content as clean markdown. Auto-detects whether the page requires JavaScript rendering. Use mode="browser" to force Playwright, mode="static" for direct HTTP.',
  FetchOptionsSchema.shape,
  async (params) => {
    const options = FetchOptionsSchema.parse(params);
    const result = await route(options);
    return {
      content: [{ type: 'text', text: result.content }],
    };
  }
);

// Tool: fetch_raw — returns raw HTML
server.tool(
  'fetch_raw',
  'Fetch a webpage and return its raw HTML. Auto-detects whether JavaScript rendering is needed. Useful when you need the HTML structure rather than extracted text.',
  FetchRawOptionsSchema.shape,
  async (params) => {
    const options = FetchRawOptionsSchema.parse(params);
    const html = await routeRaw(options);
    return {
      content: [{ type: 'text', text: html }],
    };
  }
);

// Tool: screenshot — returns base64 PNG
server.tool(
  'screenshot',
  'Take a screenshot of a webpage. Returns a base64-encoded PNG. Useful for visual verification of page content. Limited to 2MB output.',
  ScreenshotOptionsSchema.shape,
  async (params) => {
    const options = ScreenshotOptionsSchema.parse(params);
    validateUrl(options.url);
    const base64 = await screenshotBrowser(options.url, options.fullPage, options.timeout);
    return {
      content: [{ type: 'image', data: base64, mimeType: 'image/png' }],
    };
  }
);

// Graceful shutdown
async function shutdown() {
  await closeBrowser();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
async function main() {
  await ensureChromium();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('[render-fetch] Fatal error:', err);
  process.exit(1);
});
