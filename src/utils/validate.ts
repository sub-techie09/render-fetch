/**
 * URL validation with SSRF protection.
 * Blocks private IP ranges, metadata endpoints, and non-HTTP(S) protocols.
 */

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,   // AWS/GCP metadata endpoint
  /^0\./,
  /^::1$/,
  /^::ffff:/i,     // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1)
  /^fc[0-9a-f]{2}:/i,
  /^fe[89ab][0-9a-f]:/i,
];

const BLOCKED_TLDS = ['.local', '.internal', '.localhost', '.example', '.invalid', '.test'];

export function validateUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Protocol not allowed: ${url.protocol}. Only http: and https: are permitted.`);
  }

  // url.hostname returns IPv6 addresses with enclosing brackets, e.g. [::1].
  // Strip them so the patterns below match consistently.
  const rawHostname = url.hostname.toLowerCase();
  const hostname = rawHostname.startsWith('[') && rawHostname.endsWith(']')
    ? rawHostname.slice(1, -1)
    : rawHostname;

  if (hostname === 'localhost') {
    throw new Error('localhost is not allowed');
  }

  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new Error(`Private/internal IP ranges are not allowed: ${hostname}`);
    }
  }

  for (const tld of BLOCKED_TLDS) {
    if (hostname.endsWith(tld)) {
      throw new Error(`Internal TLD not allowed: ${hostname}`);
    }
  }

  return url;
}
