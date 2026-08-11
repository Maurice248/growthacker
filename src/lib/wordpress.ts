const WP_API_BASE = '/wp-json/wp/v2';

export type WordPressPostStatus = 'publish' | 'draft' | 'pending' | 'private' | 'future';

export interface WordPressRenderedField {
  rendered: string;
  protected?: boolean;
}

export interface WordPressPost {
  id: number;
  date: string;
  modified: string;
  slug: string;
  status: WordPressPostStatus;
  link: string;
  title: WordPressRenderedField;
  content: WordPressRenderedField;
  excerpt: WordPressRenderedField;
  categories?: number[];
}

export interface WordPressPostInput {
  title: string;
  content: string;
  status?: WordPressPostStatus;
  excerpt?: string;
  slug?: string;
  categories?: number[];
  featured_media?: number;
}

export interface WordPressMediaMeta {
  alt_text?: string;
  caption?: string;
  description?: string;
  title?: string;
}

export interface WordPressCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
}

export interface WordPressListParams {
  page?: number;
  perPage?: number;
  search?: string;
  status?: WordPressPostStatus | 'any';
}

export class WordPressConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WordPressConfigError';
  }
}

export class WordPressApiError extends Error {
  status: number;
  body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = 'WordPressApiError';
    this.status = status;
    this.body = body;
  }
}

export interface WordPressConfig {
  siteUrl: string;
  username: string;
  appPassword: string;
}

export function isWordPressConfigured(config?: WordPressConfig | null): boolean {
  if (config) {
    return Boolean(config.siteUrl && config.username && config.appPassword);
  }
  const siteUrl = process.env.WORDPRESS_SITE_URL?.trim();
  const username = process.env.WORDPRESS_USERNAME?.trim();
  const appPassword = process.env.WORDPRESS_APP_PASSWORD?.replace(/\s/g, '');
  return Boolean(siteUrl && username && appPassword);
}

function getWordPressConfig(config?: WordPressConfig | null): WordPressConfig {
  if (config?.siteUrl && config.username && config.appPassword) {
    return {
      siteUrl: config.siteUrl.trim().replace(/\/$/, ''),
      username: config.username.trim(),
      appPassword: config.appPassword.replace(/\s/g, ''),
    };
  }

  const siteUrl = process.env.WORDPRESS_SITE_URL?.trim().replace(/\/$/, '');
  const username = process.env.WORDPRESS_USERNAME?.trim();
  const appPassword = process.env.WORDPRESS_APP_PASSWORD?.replace(/\s/g, '');

  if (!siteUrl || !username || !appPassword) {
    throw new WordPressConfigError(
      'WordPress is not configured. Add credentials in Client Dashboard → API keys or set WORDPRESS_* environment variables.'
    );
  }

  return { siteUrl, username, appPassword };
}

function getAuthHeader(username: string, appPassword: string) {
  const token = Buffer.from(`${username}:${appPassword}`).toString('base64');
  return `Basic ${token}`;
}

async function wpRequest<T>(path: string, options: RequestInit = {}, config?: WordPressConfig | null): Promise<T> {
  const { siteUrl, username, appPassword } = getWordPressConfig(config);
  const url = `${siteUrl}${WP_API_BASE}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: getAuthHeader(username, appPassword),
      ...(options.headers ?? {}),
    },
  });

  const body = await response.text();

  if (!response.ok) {
    throw new WordPressApiError(
      `WordPress API request failed (${response.status})`,
      response.status,
      body
    );
  }

  return body ? (JSON.parse(body) as T) : ({} as T);
}

export async function listWordPressPosts(params: WordPressListParams = {}, config?: WordPressConfig | null) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.perPage) searchParams.set('per_page', String(params.perPage));
  if (params.search) searchParams.set('search', params.search);
  if (params.status) searchParams.set('status', params.status);

  const query = searchParams.toString();
  return wpRequest<WordPressPost[]>(`/posts${query ? `?${query}` : ''}`, {}, config);
}

export async function getWordPressPost(id: number, config?: WordPressConfig | null) {
  return wpRequest<WordPressPost>(`/posts/${id}`, {}, config);
}

export async function createWordPressPost(input: WordPressPostInput, config?: WordPressConfig | null) {
  return wpRequest<WordPressPost>(
    '/posts',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: input.title,
        content: input.content,
        status: input.status ?? 'draft',
        excerpt: input.excerpt,
        slug: input.slug,
        categories: input.categories,
        featured_media: input.featured_media,
      }),
    },
    config
  );
}

export async function updateWordPressPost(
  id: number,
  input: Partial<WordPressPostInput>,
  config?: WordPressConfig | null
) {
  return wpRequest<WordPressPost>(
    `/posts/${id}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    config
  );
}

export async function deleteWordPressPost(id: number, force = false, config?: WordPressConfig | null) {
  const query = force ? '?force=true' : '';
  return wpRequest<WordPressPost>(`/posts/${id}${query}`, { method: 'DELETE' }, config);
}

export async function listWordPressCategories(config?: WordPressConfig | null) {
  return wpRequest<WordPressCategory[]>('/categories?per_page=100', {}, config);
}

export async function uploadWordPressMedia(
  imageBytes: ArrayBuffer | Uint8Array,
  filename: string,
  mimeType: string,
  config?: WordPressConfig | null
): Promise<{ id: number; source_url: string }> {
  const { siteUrl, username, appPassword } = getWordPressConfig(config);
  const url = `${siteUrl}${WP_API_BASE}/media`;
  const bytes = imageBytes instanceof Uint8Array ? imageBytes : new Uint8Array(imageBytes);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(username, appPassword),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type': mimeType,
    },
    body: Buffer.from(bytes),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new WordPressApiError(
      `WordPress media upload failed (${response.status})`,
      response.status,
      body
    );
  }

  const parsed = JSON.parse(body) as { id: number; source_url: string };
  return { id: parsed.id, source_url: parsed.source_url };
}

export async function updateWordPressMediaMeta(
  mediaId: number,
  meta: WordPressMediaMeta,
  config?: WordPressConfig | null
) {
  return wpRequest<{ id: number }>(
    `/media/${mediaId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meta),
    },
    config
  );
}

export async function setWordPressFeaturedMedia(
  postId: number,
  mediaId: number,
  config?: WordPressConfig | null
) {
  return updateWordPressPost(postId, { featured_media: mediaId }, config);
}

export async function fetchImageBytes(imageUrl: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const res = await fetch(imageUrl, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) {
    throw new Error(`Failed to fetch image (${res.status}): ${imageUrl}`);
  }
  const mimeType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = await res.arrayBuffer();
  return { bytes: new Uint8Array(buffer), mimeType };
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export function formatWordPressError(error: unknown): string {
  if (error instanceof WordPressConfigError) return error.message;
  if (error instanceof WordPressApiError) {
    try {
      const parsed = JSON.parse(error.body) as { message?: string; code?: string };
      return parsed.message ?? error.message;
    } catch {
      return error.message;
    }
  }
  if (error instanceof Error) return error.message;
  return 'WordPress request failed';
}
