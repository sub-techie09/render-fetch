import { describe, it, expect } from 'vitest';
import { validateUrl } from '../../src/utils/validate.js';

describe('validateUrl', () => {
  it('accepts valid http URL', () => {
    expect(() => validateUrl('http://example.com')).not.toThrow();
  });

  it('accepts valid https URL', () => {
    expect(() => validateUrl('https://example.com/path?q=1')).not.toThrow();
  });

  it('rejects file:// protocol', () => {
    expect(() => validateUrl('file:///etc/passwd')).toThrow('Protocol not allowed');
  });

  it('rejects javascript: protocol', () => {
    expect(() => validateUrl('javascript:alert(1)')).toThrow();
  });

  it('rejects ftp:// protocol', () => {
    expect(() => validateUrl('ftp://example.com')).toThrow('Protocol not allowed');
  });

  it('rejects localhost', () => {
    expect(() => validateUrl('http://localhost/admin')).toThrow('localhost');
  });

  it('rejects 127.0.0.1', () => {
    expect(() => validateUrl('http://127.0.0.1/')).toThrow();
  });

  it('rejects 10.x private range', () => {
    expect(() => validateUrl('http://10.0.0.1/')).toThrow();
  });

  it('rejects 192.168.x private range', () => {
    expect(() => validateUrl('http://192.168.1.1/')).toThrow();
  });

  it('rejects AWS metadata endpoint', () => {
    expect(() => validateUrl('http://169.254.169.254/latest/meta-data')).toThrow();
  });

  it('rejects .local TLD', () => {
    expect(() => validateUrl('http://myserver.local/')).toThrow();
  });

  it('rejects .internal TLD', () => {
    expect(() => validateUrl('http://db.internal/')).toThrow();
  });

  it('rejects malformed URL', () => {
    expect(() => validateUrl('not-a-url')).toThrow('Invalid URL');
  });

  it('rejects IPv4-mapped IPv6 address (::ffff:127.0.0.1)', () => {
    expect(() => validateUrl('http://[::ffff:127.0.0.1]/')).toThrow();
  });

  it('rejects IPv4-mapped IPv6 for private range (::ffff:10.0.0.1)', () => {
    expect(() => validateUrl('http://[::ffff:10.0.0.1]/')).toThrow();
  });

  it('returns URL object', () => {
    const url = validateUrl('https://example.com/path');
    expect(url).toBeInstanceOf(URL);
    expect(url.hostname).toBe('example.com');
  });
});
