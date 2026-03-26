/**
 * Heuristic scoring to determine if a page requires JS rendering.
 * Score >= 3 routes to the browser extractor.
 */

const SPA_THRESHOLD = 3;

interface DetectionInput {
  body: string;
  headers: Record<string, string>;
  url: string;
}

export function detectRenderingMode(input: DetectionInput): 'static' | 'browser' {
  const score = scoreBody(input);
  return score >= SPA_THRESHOLD ? 'browser' : 'static';
}

export function scoreBody(input: DetectionInput): number {
  const { body, headers, url } = input;
  let score = 0;

  // Strong SPA root signals
  if (/<div[^>]+id=["'](root|app)["'][^>]*>/i.test(body)) score += 3;
  if (/<div[^>]+id=["']__next["'][^>]*>/i.test(body)) score += 3;
  if (/<div[^>]+id=["']__nuxt["'][^>]*>/i.test(body)) score += 3;

  // Framework-specific markers
  if (/data-reactroot/i.test(body)) score += 2;
  if (/ng-version/i.test(body)) score += 2;
  if (/<app-root[\s>]/i.test(body)) score += 2;
  if (/data-v-app/i.test(body)) score += 2;  // Vue 3

  // State injection patterns
  if (/window\.__(?:INITIAL_STATE|REDUX_STATE|NEXT_DATA|NUXT_STATE)__/i.test(body)) score += 2;

  // Thin body (skeleton page) — substantial signal
  const textContent = body.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (textContent.length < 500) score += 2;

  // Bundled JS patterns
  if (/src=["'][^"']*(?:chunk|bundle|main\.[a-f0-9]+)[^"']*\.js["']/i.test(body)) score += 1;

  // Server response headers
  const poweredBy = headers['x-powered-by'] ?? '';
  if (/next\.js/i.test(poweredBy) && textContent.length < 1000) score += 1;

  // URL path hints
  const urlPath = new URL(url).pathname;
  if (/^\/(app|dashboard|feed|home)\//i.test(urlPath)) score += 1;

  // Known-static negative signals
  if (/\.(md|txt|xml|json|csv)$/i.test(url)) score -= 3;
  if (/^docs\.|^api\.|^static\./i.test(new URL(url).hostname)) score -= 1;

  return score;
}
