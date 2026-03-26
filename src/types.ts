import { z } from 'zod';

export interface FetchResult {
  url: string;
  title: string;
  content: string;
  extractedAt: string;
  method: 'static' | 'browser';
  truncated: boolean;
}

export const FetchOptionsSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  mode: z.enum(['auto', 'static', 'browser']).default('auto'),
  maxLength: z.number().int().min(1000).max(100000).default(50000),
  timeout: z.number().int().min(1000).max(60000).default(30000),
});

export const FetchRawOptionsSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  mode: z.enum(['auto', 'static', 'browser']).default('auto'),
  timeout: z.number().int().min(1000).max(60000).default(30000),
});

export const ScreenshotOptionsSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  fullPage: z.boolean().default(false),
  timeout: z.number().int().min(1000).max(60000).default(30000),
});

export type FetchOptions = z.infer<typeof FetchOptionsSchema>;
export type FetchRawOptions = z.infer<typeof FetchRawOptionsSchema>;
export type ScreenshotOptions = z.infer<typeof ScreenshotOptionsSchema>;
