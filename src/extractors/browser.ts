import { execSync } from 'child_process';
import type { Browser, BrowserContext, Page } from 'playwright';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import type { FetchResult } from '../types.js';
import { cleanMarkdown } from '../utils/markdown.js';
import { USER_AGENT } from '../constants.js';

const MAX_SCREENSHOT_SIZE = 2 * 1024 * 1024; // 2MB

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

// Singleton browser instance
let browser: Browser | null = null;
let browserPromise: Promise<Browser> | null = null;
let runtimeUserAgent: string | null = null;

export async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import('playwright');
      browser = await chromium.launch({
        headless: true,
        timeout: 15000,
        args: ['--disable-blink-features=AutomationControlled'],
      });
      const version = browser.version(); // e.g. "123.0.6312.58"
      const major = version.split('.')[0];
      runtimeUserAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
      return browser;
    })().finally(() => { browserPromise = null; });
  }
  return browserPromise;
}

/** Creates a browser context with stealth patches applied. */
async function createStealthContext(b: Browser): Promise<BrowserContext> {
  return b.newContext({
    userAgent: runtimeUserAgent ?? USER_AGENT,
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
}

/** Patches the webdriver flag before any page JS runs. Must be called before goto(). */
async function applyStealthPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    const w = window as Window & { chrome?: unknown };
    if (!w.chrome) {
      w.chrome = { runtime: {} };
    }
  });
}

export async function ensureChromium(): Promise<void> {
  try {
    const { chromium } = await import('playwright');
    chromium.executablePath();
  } catch {
    console.error('[render-fetch] Installing Chromium (one-time download ~150MB)...');
    execSync('npx playwright install chromium', { stdio: 'inherit' });
    console.error('[render-fetch] Chromium installed successfully.');
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export interface BrowserExtractOptions {
  url: string;
  maxLength: number;
  timeout: number;
}

export async function extractBrowser(options: BrowserExtractOptions): Promise<FetchResult> {
  const { url, maxLength, timeout } = options;

  const b = await getBrowser();
  const context = await createStealthContext(b);

  try {
    const page = await context.newPage();
    await applyStealthPage(page);

    // Block resources that don't contribute to text content
    // Note: stylesheets are allowed — some SPAs gate rendering behind CSS class checks
    await page.route('**/*', (route) => {
      if (['image', 'media', 'font'].includes(route.request().resourceType())) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // Navigate then wait for meaningful content rather than a fixed timeout
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });

    // Race networkidle: fires if the page settles within 3s, falls through silently if not
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});

    // Compound content readiness: wait for a semantic container with enough text blocks
    await page.waitForFunction(
      () => {
        const candidates = document.querySelectorAll('article, [role="main"], main, #content, #main');
        for (const el of candidates) {
          const text = ((el as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim();
          if (text.length < 400) continue;
          const blocks = [...document.querySelectorAll('p, li, h1, h2, h3')]
            .filter(n => ((n as HTMLElement).innerText || '').trim().length > 40).length;
          if (blocks >= 2) return true;
        }
        return false;
      },
      { polling: 250, timeout: 10000 }
    ).catch(() => {/* fall through — extract whatever is there */});

    const html = await page.evaluate(() => document.documentElement.innerHTML);
    const pageTitle = await page.title();

    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    const title = article?.title ?? pageTitle;
    const markdownContent = article?.content
      ? turndown.turndown(article.content)
      : turndown.turndown(html);

    const { content, truncated } = cleanMarkdown(markdownContent, {
      maxLength,
      url,
      title,
      method: 'browser',
    });

    return {
      url,
      title,
      content,
      extractedAt: new Date().toISOString(),
      method: 'browser',
      truncated,
    };
  } finally {
    await context.close();
  }
}

export async function rawBrowser(url: string, timeout: number): Promise<string> {
  const b = await getBrowser();
  const context = await createStealthContext(b);
  try {
    const page = await context.newPage();
    await applyStealthPage(page);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    // rawBrowser is a diagnostic tool — fixed wait is intentional, not a bug.
    // Callers get the raw HTML at ~2s post-paint, not content-readiness-gated output.
    await page.waitForTimeout(2000);
    return page.evaluate(() => document.documentElement.outerHTML);
  } finally {
    await context.close();
  }
}

export async function screenshotBrowser(url: string, fullPage: boolean, timeout: number): Promise<string> {
  const b = await getBrowser();
  const context = await createStealthContext(b);
  try {
    const page = await context.newPage();
    await applyStealthPage(page);
    await page.goto(url, { waitUntil: 'networkidle', timeout });

    const buffer = await page.screenshot({ type: 'png', fullPage });

    if (buffer.length > MAX_SCREENSHOT_SIZE) {
      throw new Error(`Screenshot too large: ${buffer.length} bytes (max ${MAX_SCREENSHOT_SIZE})`);
    }

    return buffer.toString('base64');
  } finally {
    await context.close();
  }
}
