import { execSync } from 'child_process';
import type { Browser } from 'playwright';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import type { FetchResult } from '../types.js';
import { cleanMarkdown } from '../utils/markdown.js';

const MAX_SCREENSHOT_SIZE = 2 * 1024 * 1024; // 2MB
const USER_AGENT = 'render-fetch/0.1 (https://github.com/sub-techie09/render-fetch)';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

// Singleton browser instance
let browser: Browser | null = null;
let browserInitializing = false;

async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;

  if (browserInitializing) {
    // Wait for initialization
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (!browserInitializing) { clearInterval(check); resolve(); }
      }, 100);
    });
    if (browser?.isConnected()) return browser;
  }

  browserInitializing = true;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      headless: true,
      timeout: 15000,
    });
    return browser;
  } finally {
    browserInitializing = false;
  }
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
  const context = await b.newContext({ userAgent: USER_AGENT });

  try {
    const page = await context.newPage();

    // Block resources that don't contribute to text content
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // Navigate with networkidle fallback
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout });
    } catch {
      // Fallback: domcontentloaded is less thorough but more reliable
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      await page.waitForTimeout(1500);
    }

    const html = await page.evaluate(() => document.documentElement.innerHTML);
    const pageTitle = await page.title();

    // Extract with Readability
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    let markdownContent: string;
    const title = article?.title ?? pageTitle;

    if (article?.content) {
      markdownContent = turndown.turndown(article.content);
    } else {
      markdownContent = turndown.turndown(html);
    }

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

export async function screenshotBrowser(url: string, fullPage: boolean, timeout: number): Promise<string> {
  const b = await getBrowser();
  const context = await b.newContext({ userAgent: USER_AGENT });

  try {
    const page = await context.newPage();
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
