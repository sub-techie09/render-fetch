import { describe, it, expect } from 'vitest';
import { detectRenderingMode, scoreBody } from '../../src/utils/detect.js';

const base = { headers: {}, url: 'https://example.com' };

describe('detectRenderingMode', () => {
  it('routes static page to static', () => {
    const body = '<html><head><title>Test</title></head><body><p>Hello world, this is a static page with plenty of text content for the heuristics to work correctly.</p></body></html>';
    expect(detectRenderingMode({ body, ...base })).toBe('static');
  });

  it('routes React SPA to browser', () => {
    const body = '<html><body><div id="root"></div><script src="/static/js/main.abc123.chunk.js"></script></body></html>';
    expect(detectRenderingMode({ body, ...base })).toBe('browser');
  });

  it('routes Next.js SPA to browser', () => {
    const body = '<html><body><div id="__next"></div></body></html>';
    expect(detectRenderingMode({ body, ...base })).toBe('browser');
  });

  it('routes Angular app to browser', () => {
    const body = '<html><body><app-root ng-version="17.0.0"></app-root></body></html>';
    expect(detectRenderingMode({ body, ...base })).toBe('browser');
  });

  it('routes Vue app to browser', () => {
    const body = '<html><body><div id="app" data-v-app></div></body></html>';
    expect(detectRenderingMode({ body, ...base })).toBe('browser');
  });

  it('routes Nuxt to browser', () => {
    const body = '<html><body><div id="__nuxt"></div></body></html>';
    expect(detectRenderingMode({ body, ...base })).toBe('browser');
  });

  it('routes thin body (skeleton) to browser', () => {
    const body = '<html><body><div id="root"></div></body></html>';
    expect(detectRenderingMode({ body, ...base })).toBe('browser');
  });

  it('routes markdown URL to static', () => {
    const body = '<html><body><p>content</p></body></html>';
    expect(detectRenderingMode({ body, headers: {}, url: 'https://example.com/README.md' })).toBe('static');
  });

  it('routes Redux state page to browser', () => {
    const body = `<html><body><div id="root"></div><script>window.__REDUX_STATE__ = {}</script></body></html>`;
    expect(detectRenderingMode({ body, ...base })).toBe('browser');
  });

  it('routes data-reactroot to browser', () => {
    const body = '<html><body><div data-reactroot=""><h1>App</h1></div></body></html>';
    expect(detectRenderingMode({ body, ...base })).toBe('browser');
  });
});

describe('scoreBody', () => {
  it('scores 0 for rich static page', () => {
    const body = '<html><body>' + '<p>word </p>'.repeat(60) + '</body></html>';
    const score = scoreBody({ body, headers: {}, url: 'https://example.com' });
    expect(score).toBeLessThan(3);
  });

  it('scores >= 3 for react SPA', () => {
    const body = '<html><body><div id="root"></div></body></html>';
    const score = scoreBody({ body, headers: {}, url: 'https://example.com' });
    expect(score).toBeGreaterThanOrEqual(3);
  });

  it('negative score for markdown extension', () => {
    const body = '<html><body>' + '<p>word </p>'.repeat(60) + '</body></html>';
    const score = scoreBody({ body, headers: {}, url: 'https://example.com/README.md' });
    expect(score).toBeLessThan(0);
  });
});
