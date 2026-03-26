/**
 * Post-processing to clean markdown for LLM consumption.
 */

export interface MarkdownOptions {
  maxLength: number;
  url: string;
  title: string;
  method: 'static' | 'browser';
}

export function cleanMarkdown(raw: string, options: MarkdownOptions): { content: string; truncated: boolean } {
  let content = raw;

  // Strip base64-encoded image data (useless to LLMs and huge)
  content = content.replace(/!\[[^\]]*\]\(data:[^)]+\)/g, '');

  // Strip empty image links
  content = content.replace(/!\[\]\([^)]*\)/g, '');

  // Collapse 3+ consecutive blank lines to 2
  content = content.replace(/\n{3,}/g, '\n\n');

  // Trim leading/trailing whitespace
  content = content.trim();

  // Truncate at maxLength
  let truncated = false;
  if (content.length > options.maxLength) {
    content = content.slice(0, options.maxLength);
    // Don't cut mid-word
    const lastSpace = content.lastIndexOf(' ');
    if (lastSpace > options.maxLength - 200) {
      content = content.slice(0, lastSpace);
    }
    content += '\n\n[Content truncated]';
    truncated = true;
  }

  // Prepend metadata header
  const header = [
    `# ${options.title || 'Untitled'}`,
    `> Source: ${options.url}`,
    `> Fetched: ${new Date().toISOString()}`,
    `> Method: ${options.method}`,
    '',
    '',
  ].join('\n');

  return { content: header + content, truncated };
}
