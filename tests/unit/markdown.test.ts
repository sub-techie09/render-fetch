import { describe, it, expect } from 'vitest';
import { cleanMarkdown } from '../../src/utils/markdown.js';

const baseOpts = { url: 'https://example.com', title: 'Test Page', method: 'static' as const };

describe('cleanMarkdown', () => {
  it('prepends metadata header', () => {
    const { content } = cleanMarkdown('Hello world', { ...baseOpts, maxLength: 50000 });
    expect(content).toContain('# Test Page');
    expect(content).toContain('> Source: https://example.com');
    expect(content).toContain('> Method: static');
  });

  it('strips base64 images', () => {
    const raw = '![img](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA)';
    const { content } = cleanMarkdown(raw, { ...baseOpts, maxLength: 50000 });
    expect(content).not.toContain('data:image');
  });

  it('collapses multiple blank lines to two', () => {
    const raw = 'line1\n\n\n\n\nline2';
    const { content } = cleanMarkdown(raw, { ...baseOpts, maxLength: 50000 });
    expect(content).not.toMatch(/\n{4,}/);
  });

  it('truncates at maxLength', () => {
    const raw = 'a'.repeat(1000);
    const { content, truncated } = cleanMarkdown(raw, { ...baseOpts, maxLength: 200 });
    expect(truncated).toBe(true);
    expect(content).toContain('[Content truncated]');
  });

  it('does not truncate short content', () => {
    const raw = 'short content';
    const { content, truncated } = cleanMarkdown(raw, { ...baseOpts, maxLength: 50000 });
    expect(truncated).toBe(false);
    expect(content).not.toContain('[Content truncated]');
  });

  it('handles empty string input', () => {
    const { content } = cleanMarkdown('', { ...baseOpts, maxLength: 50000 });
    expect(content).toContain('# Test Page');
  });

  it('strips empty image links', () => {
    const raw = '![](https://example.com/tracker.png)';
    const { content } = cleanMarkdown(raw, { ...baseOpts, maxLength: 50000 });
    expect(content).not.toContain('![]');
  });
});
