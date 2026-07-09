import type { BlogCategoryData, BlogOutline } from './types';

const OUTLINE_WRAPPER_KEYS = ['output', 'outline', 'data', 'result', 'json'];

function unwrapOutline(raw: unknown, depth = 0): Record<string, unknown> {
  if (depth > 6) return {};
  if (Array.isArray(raw)) {
    return unwrapOutline(raw[0], depth + 1);
  }
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const obj = raw as Record<string, unknown>;
  for (const key of OUTLINE_WRAPPER_KEYS) {
    const nested = obj[key];
    if (nested && typeof nested === 'object') {
      const unwrapped = unwrapOutline(nested, depth + 1);
      if (Object.keys(unwrapped).length) return unwrapped;
    }
  }

  return obj;
}

function getProperty(obj: Record<string, unknown>, propertyName: string): unknown {
  if (Object.prototype.hasOwnProperty.call(obj, propertyName)) {
    return obj[propertyName];
  }

  const lower = propertyName.toLowerCase();
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === lower) {
      return obj[key];
    }
  }

  return undefined;
}

function getArrayProperty(
  obj: Record<string, unknown>,
  propertyName: string,
  altNames: string[] = []
): unknown[] {
  for (const name of [propertyName, ...altNames]) {
    const value = getProperty(obj, name);
    const fromValue = coerceSectionArray(value);
    if (fromValue.length) return fromValue;
  }
  return [];
}

function coerceSectionArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.filter((item) => item && typeof item === 'object');
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const values = Object.values(record).filter((item) => item && typeof item === 'object');
    if (values.length) return values;
  }
  return [];
}

function findSectionArrays(obj: Record<string, unknown>): unknown[] {
  const sectionKeyHints = ['section', 'body', 'h2', 'heading'];
  for (const [key, value] of Object.entries(obj)) {
    const coerced = coerceSectionArray(value);
    if (!coerced.length) continue;

    const keyLower = key.toLowerCase();
    if (sectionKeyHints.some((hint) => keyLower.includes(hint))) {
      return coerced;
    }

    const first = coerced[0] as Record<string, unknown>;
    if (
      getProperty(first, 'h2') ||
      getProperty(first, 'heading') ||
      getProperty(first, 'title') ||
      getProperty(first, 'description')
    ) {
      return coerced;
    }
  }
  return [];
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function normalizeSection(section: unknown, index: number) {
  const row =
    section && typeof section === 'object' && !Array.isArray(section)
      ? (section as Record<string, unknown>)
      : {};

  const h2 =
    asString(getProperty(row, 'h2')) ||
    asString(getProperty(row, 'heading')) ||
    asString(getProperty(row, 'title')) ||
    `Section ${index + 1}`;

  const description = asString(getProperty(row, 'description'));
  const keywords = asStringArray(getProperty(row, 'keywords'));

  const subsections = getArrayProperty(row, 'subsections', ['sub_sections', 'h3_sections']).map(
    (sub, subIndex) => {
      const subRow =
        sub && typeof sub === 'object' && !Array.isArray(sub)
          ? (sub as Record<string, unknown>)
          : {};
      return {
        h3:
          asString(getProperty(subRow, 'h3')) ||
          asString(getProperty(subRow, 'heading')) ||
          asString(getProperty(subRow, 'title')) ||
          `Subsection ${subIndex + 1}`,
        description: asString(getProperty(subRow, 'description')),
      };
    }
  );

  return { h2, description, keywords, subsections };
}

export function buildFallbackOutline(
  category: BlogCategoryData,
  rankedKeywords: string[]
): BlogOutline {
  const keywords =
    rankedKeywords.length > 0
      ? [...new Set([...rankedKeywords, ...category.keywords])].slice(0, 4)
      : category.keywords.slice(0, 4);
  const mainKeyword = category.seedKeyword || keywords[0] || 'guide';
  const slug = mainKeyword
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  return {
    selected_keywords: keywords,
    main_keyword_for_url: mainKeyword,
    title: category.category,
    meta_title: category.category.slice(0, 60),
    meta_description: `Practical guide to ${category.category.toLowerCase()} with actionable advice.`,
    url: slug || 'blog-post',
    summary: `This article explains ${category.category.toLowerCase()} and what readers should know before taking action.`,
    introduction: `Introduce the topic of ${category.category}, who it helps, and why it matters now.`,
    body_sections: [
      {
        h2: `Understanding ${category.category}`,
        description: `Explain the core concepts, context, and why this topic matters to the reader.`,
        keywords: keywords.slice(0, 2),
        subsections: [],
      },
      {
        h2: 'Step-by-Step Best Practices',
        description: `Walk through the recommended process, checklist, or workflow in practical order.`,
        keywords: keywords.slice(1, 3),
        subsections: [],
      },
      {
        h2: 'Common Risks and How to Avoid Them',
        description: `Cover frequent mistakes, warning signs, and prevention strategies related to this topic.`,
        keywords: keywords.slice(2, 4),
        subsections: [],
      },
      {
        h2: 'What to Do Next',
        description: `Give actionable next steps and decision criteria readers can apply immediately.`,
        keywords: keywords.slice(0, 1),
        subsections: [],
      },
    ],
    conclusion: `Summarize the key takeaways from ${category.category.toLowerCase()} and reinforce the main action readers should take.`,
    cta: 'Take the next step with confidence.',
  };
}

export const BLOG_ARTICLE_JSON_SCHEMA = `REQUIRED JSON OUTPUT:
{
  "title": "H1 title",
  "meta_title": "Meta title",
  "meta_description": "Meta description",
  "url": "url-slug",
  "article": "Full article content in Markdown"
}

The article field must contain the complete Markdown blog post. Respond with JSON only.`;

export const BLOG_OUTLINE_JSON_SCHEMA = `REQUIRED JSON OUTPUT (respond with this exact top-level shape):
{
  "selected_keywords": ["keyword 1", "keyword 2", "keyword 3"],
  "main_keyword_for_url": "primary-keyword-phrase",
  "title": "H1 title",
  "meta_title": "Meta title",
  "meta_description": "Meta description",
  "url": "url-slug",
  "summary": "60-80 word summary description",
  "introduction": "Introduction section description",
  "body_sections": [
    {
      "h2": "Section heading",
      "description": "What this section should cover",
      "keywords": ["keyword"],
      "subsections": [{ "h3": "Subheading", "description": "Subsection guidance" }]
    }
  ],
  "conclusion": "Conclusion description",
  "cta": "Call to action"
}

You MUST include body_sections as an array with exactly 3-5 section objects. Each section MUST have h2 and description. Respond with JSON only.`;

export function normalizeBlogOutline(raw: unknown): BlogOutline {
  const outline = unwrapOutline(raw);

  let bodySections = getArrayProperty(outline, 'body_sections', [
    'bodySections',
    'sections',
    'h2_sections',
    'article_sections',
    'content_sections',
  ]).map(normalizeSection);

  if (!bodySections.length) {
    bodySections = findSectionArrays(outline).map(normalizeSection);
  }

  const title = asString(getProperty(outline, 'title'), 'Untitled');
  const metaTitle = asString(getProperty(outline, 'meta_title'), title);
  const selectedKeywords = asStringArray(getProperty(outline, 'selected_keywords'));

  const normalized: BlogOutline = {
    selected_keywords: selectedKeywords,
    main_keyword_for_url: asString(getProperty(outline, 'main_keyword_for_url')),
    title,
    meta_title: metaTitle,
    meta_description: asString(getProperty(outline, 'meta_description')),
    url: asString(getProperty(outline, 'url')),
    summary: asString(getProperty(outline, 'summary')),
    introduction: asString(getProperty(outline, 'introduction')),
    body_sections: bodySections,
    conclusion: asString(getProperty(outline, 'conclusion')),
    cta: asString(getProperty(outline, 'cta')),
  };

  if (!normalized.body_sections.length) {
    throw new Error('OUTLINE_MISSING_BODY_SECTIONS');
  }

  return normalized;
}

export function normalizeBlogOutlineWithFallback(
  raw: unknown,
  category: BlogCategoryData,
  rankedKeywords: string[]
): BlogOutline {
  try {
    return normalizeBlogOutline(raw);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'OUTLINE_MISSING_BODY_SECTIONS'
    ) {
      console.warn('[blog] outline missing body_sections, using category fallback');
      return buildFallbackOutline(category, rankedKeywords);
    }
    throw error;
  }
}
