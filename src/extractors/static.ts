import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import type { FetchResult } from '../types.js';
import { cleanMarkdown } from '../utils/markdown.js';

const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB
const USER_AGENT = 'render-fetch/0.1 (https://github.com/sub-techie09/render-fetch)';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

export interface StaticExtractOptions {
  url: string;
  body?: string;  // Pre-fetched body (from router's detection fetch)
  maxLength: number;
  timeout: number;
}

export async function extractStatic(options: StaticExtractOptions): Promise<FetchResult> {
  const { url, maxLength, timeout } = options;

  let rawBody = options.body;

  if (!rawBody) {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeout),
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      const text = await response.text();
      return {
        url,
        title: '',
        content: text.slice(0, maxLength),
        extractedAt: new Date().toISOString(),
        method: 'static',
        truncated: text.length > maxLength,
      };
    }

    // Guard against oversized responses
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
      throw new Error(`Response too large: ${contentLength} bytes (max ${MAX_RESPONSE_SIZE})`);
    }

    rawBody = await response.text();
    if (rawBody.length > MAX_RESPONSE_SIZE) {
      rawBody = rawBody.slice(0, MAX_RESPONSE_SIZE);
    }
  }

  // Extract with Readability for main content
  const dom = new JSDOM(rawBody, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  let markdownContent: string;
  let title = article?.title ?? '';

  if (article?.content) {
    // Clean the Readability HTML before converting
    const $ = cheerio.load(article.content);
    $('script, style, noscript').remove();
    markdownContent = turndown.turndown($.html());
  } else {
    // Fallback: strip noise from full page
    const $ = cheerio.load(rawBody);
    $('script, style, noscript, nav, footer, aside, [aria-hidden="true"]').remove();
    title = $('title').text().trim() || title;
    markdownContent = turndown.turndown($.html());
  }

  const { content, truncated } = cleanMarkdown(markdownContent, {
    maxLength,
    url,
    title,
    method: 'static',
  });

  return {
    url,
    title,
    content,
    extractedAt: new Date().toISOString(),
    method: 'static',
    truncated,
  };
}
