import type { FetchResult, FetchOptions, FetchRawOptions } from './types.js';
import { validateUrl } from './utils/validate.js';
import { detectRenderingMode } from './utils/detect.js';
import { extractStatic } from './extractors/static.js';
import { extractBrowser } from './extractors/browser.js';

const MAX_RESPONSE_SIZE = 10 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const USER_AGENT = 'render-fetch/0.1 (https://github.com/sub-techie09/render-fetch)';

/** Fetch with manual redirect following so each redirect target is SSRF-validated. */
async function safeFetch(urlString: string, timeout: number): Promise<Response> {
  let currentUrl = urlString;
  let hops = 0;

  while (hops <= MAX_REDIRECTS) {
    const response = await fetch(currentUrl, {
      signal: AbortSignal.timeout(timeout),
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect response missing Location header');
      // Resolve relative redirects and validate before following
      const resolved = new URL(location, currentUrl).toString();
      validateUrl(resolved); // throws if private/blocked
      currentUrl = resolved;
      hops++;
      continue;
    }

    return response;
  }

  throw new Error(`Too many redirects (max ${MAX_REDIRECTS})`);
}

interface RouterResult extends FetchResult {
  detectedMode?: 'static' | 'browser';
}

export async function route(options: FetchOptions): Promise<RouterResult> {
  const url = validateUrl(options.url);
  const urlString = url.toString();

  let resolvedMode = options.mode;
  let body: string | undefined;
  const responseHeaders: Record<string, string> = {};

  // Auto-detection: fetch once, reuse for both detection and extraction
  if (options.mode === 'auto') {
    const response = await safeFetch(urlString, options.timeout);

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
      throw new Error(`Response too large: ${contentLength} bytes`);
    }

    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      // Non-HTML: skip detection, return raw
      body = await response.text();
      resolvedMode = 'static';
    } else {
      body = await response.text();
      if (body.length > MAX_RESPONSE_SIZE) body = body.slice(0, MAX_RESPONSE_SIZE);

      const detected = detectRenderingMode({
        body,
        headers: responseHeaders,
        url: urlString,
      });
      resolvedMode = detected;
    }
  }

  if (resolvedMode === 'browser') {
    const result = await extractBrowser({
      url: urlString,
      maxLength: options.maxLength,
      timeout: options.timeout,
    });
    return { ...result, detectedMode: resolvedMode };
  }

  const result = await extractStatic({
    url: urlString,
    body,
    maxLength: options.maxLength,
    timeout: options.timeout,
  });
  return { ...result, detectedMode: resolvedMode as 'static' | 'browser' | undefined };
}

export async function routeRaw(options: FetchRawOptions): Promise<string> {
  const url = validateUrl(options.url);
  const urlString = url.toString();

  let resolvedMode = options.mode;

  if (options.mode === 'auto') {
    const response = await safeFetch(urlString, options.timeout);
    const body = await response.text();
    const headers: Record<string, string> = {};
    response.headers.forEach((v, k) => { headers[k] = v; });
    const detected = detectRenderingMode({ body, headers, url: urlString });
    resolvedMode = detected;

    if (resolvedMode === 'browser') {
      const { chromium } = await import('playwright');
      const b = await chromium.launch({ headless: true });
      try {
        const context = await b.newContext({ userAgent: USER_AGENT });
        try {
          const page = await context.newPage();
          await page.goto(urlString, { waitUntil: 'networkidle', timeout: options.timeout });
          return await page.evaluate(() => document.documentElement.outerHTML);
        } finally {
          await context.close();
        }
      } finally {
        await b.close();
      }
    }

    return body;
  }

  const response = await safeFetch(urlString, options.timeout);
  return response.text();
}
