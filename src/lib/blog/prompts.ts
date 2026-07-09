import type { BlogContext, BlogOutline } from './types';
import { formatBlogBrandBlock } from './company-context';

export function substitutePromptTemplate(
  template: string,
  vars: Record<string, string | number | string[] | undefined | null>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    const replacement = Array.isArray(value) ? value.join('\n') : String(value ?? '');
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), replacement);
  }
  return result;
}

export function buildDefaultTitleSystemPrompt(ctx: BlogContext): string {
  return `You are an SEO content outline generator for ${ctx.companyName}, creating strategic blog outlines that help the target audience solve real problems related to the company's products and services.

BUSINESS CONTEXT
${formatBlogBrandBlock(ctx)}

CRITICAL CONTENT PHILOSOPHY
- Each blog post must focus deeply on ONE specific service, problem, or topic.
- Write for real readers seeking genuine, practical advice — not for search engines or hard sales.
- Mention ${ctx.companyName} only when relevant (tools, screening, solutions) — not in every section.
- Provide realistic, honest guidance. Never make exaggerated claims.

TASK
Generate H1 title + H2/H3 subheading structure based on the specific blog topic provided. Stay laser-focused on that ONE topic.

TITLE REQUIREMENTS
- H1 Title: 60–70 characters (include primary keyword when relevant)
- Meta Title: 50–60 characters
- URL Slug: ONE main keyword only (3–6 words, SEO-friendly)
- Select and use 3–4 most suitable keywords from the provided list
- Target word count: 800–1000 words across body sections (3–5 H2 sections)

OUTPUT RULES
- Respond with JSON only
- Provide descriptions only — never write actual article content
- Required fields: selected_keywords, main_keyword_for_url, title, meta_title, meta_description, url, summary, introduction, body_sections (array with h2, description, keywords, subsections), conclusion, cta`;
}

export function buildDefaultTitleUserPrompt(
  ctx: BlogContext,
  category: string,
  service: string,
  seedKeyword: string,
  keywords: string[],
  rankedKeywords: string[],
  today: string
): string {
  return `Generate title and outline for this content:

Blog topic/Service Category: ${category}
Service: ${service}
Seed keyword: ${seedKeyword}
SEO Keywords (must be included in the blog):
${rankedKeywords.join('\n')}
${keywords.join('\n')}

Strictly use 3-4 keywords in the blog which are suitable and one main keyword in the slug for URL.
Today's date: ${today}
Target: 800-1000 words

BUSINESS CONTEXT:
${formatBlogBrandBlock(ctx)}`;
}

export function buildDefaultArticleSystemPrompt(ctx: BlogContext): string {
  return `You are an expert content creator and SEO strategist for ${ctx.companyName}. Your mission is to take a user-provided article outline and write a complete, practical, high-quality blog post designed to rank in search results while building trust and providing genuine guidance.

PRIMARY DIRECTIVE: Professional Blog Formatting
- Paragraphs are continuous flowing text (4-6 sentences each)
- Use numbered lists only for step-by-step processes or checklists
- One blank line between paragraphs
- TWO blank lines before and after all headings (H1, H2, H3)
- Include a ## Summary section immediately after the H1 title (60-80 words)
- Each H2 section: 250-350 words minimum
- Total article: 1200-1500 words
- Active voice only; Grade 10-11 readability
- Naturally integrate ${ctx.companyName} strengths where relevant without hard-sell language

BUSINESS CONTEXT:
${formatBlogBrandBlock(ctx)}

OUTPUT FORMAT
Deliver complete article in Markdown. Structure: H1 Title, ## Summary, Introduction paragraphs, ## H2 sections with ### H3 subsections as needed, ## Conclusion with CTA integrated naturally.

Respond with JSON containing: title, meta_title, meta_description, url, article (full markdown content).`;
}

export function buildDefaultArticleUserPrompt(
  outline: BlogOutline,
  today: string,
  ctx: BlogContext
): string {
  const bodySectionsText = (outline.body_sections || [])
    .map((section, index) => {
      const subs = (section.subsections || [])
        .map((sub, subIndex) => `  ${subIndex + 1}. ${sub.h3}\n     ${sub.description}`)
        .join('\n');
      return `SECTION ${index + 1}: ${section.h2}\n${section.description}\nKeywords: ${section.keywords.join(', ')}\n${subs ? `Subsections:\n${subs}` : ''}`;
    })
    .join('\n\n');

  return `Generate a complete article and metadata based on the following outline. Adhere strictly to all instructions.

ARTICLE METADATA
Title (H1): ${outline.title}
Meta Title: ${outline.meta_title}
Meta Description: ${outline.meta_description}
URL Slug: ${outline.url}
Target Word Count: 1200-1500 words
Selected Keywords: ${outline.selected_keywords.join(', ')}
Main Keyword for URL: ${outline.main_keyword_for_url}
Today's date: ${today}

CONTENT STRUCTURE
Summary: ${outline.summary}
Introduction: ${outline.introduction}
Body Sections:
${bodySectionsText}
Conclusion: ${outline.conclusion}
CTA: ${outline.cta}

BUSINESS CONTEXT:
${formatBlogBrandBlock(ctx)}`;
}

export function buildDefaultImageSystemPrompt(ctx: BlogContext): string {
  return `You are an expert image prompt writer for ${ctx.companyName}'s blog.

Analyze the blog content and write ONE image prompt for a photorealistic thumbnail image.

CRITICAL RULE — ZERO TEXT ON IMAGE: No logos, signs, labels, writing, readable documents, or screen displays.

STRICT RULES:
1. PHOTOREALISTIC ONLY — looks like a real photograph
2. NO TEXT OR SCREENS — devices must show back side only if included
3. NO AI ARTIFACTS — natural hands, eyes, proportions
4. DIVERSE REAL PEOPLE when people are included
5. TOPIC RELEVANT to the blog subject
6. UNDER 100 WORDS

OUTPUT FORMAT — JSON with fields:
- image_prompt (string)
- title (string)
- alt_text (string)
- description (string)
- caption (string)`;
}

export function buildDefaultImageUserPrompt(articleHtml: string): string {
  return `Blog content:
${articleHtml.slice(0, 8000)}

Analyze this blog and generate a photorealistic image prompt under 100 words that visually represents the blog topic.

Rules:
- Zero text on image
- No screens or device displays
- Natural poses, real environments
- Output JSON only with image_prompt, title, alt_text, description, caption`;
}

export function buildWpCategoryPrompt(
  articleText: string,
  categories: Array<{ id: number; name: string }>
): string {
  const list = categories.map((c) => `${c.id}. ${c.name}`).join('\n');
  return `Article:\n${articleText.slice(0, 4000)}\n\nAvailable WordPress categories:\n${list}\n\nAnalyze the article and return JSON with category_id (number) for the best matching category. Use 0 if none match.`;
}

export function getTitlePrompts(
  ctx: BlogContext,
  customSystem?: string,
  customUser?: string
) {
  return {
    system: customSystem?.trim() || buildDefaultTitleSystemPrompt(ctx),
    userTemplate: customUser?.trim() || null,
  };
}

export function getArticlePrompts(
  ctx: BlogContext,
  customSystem?: string,
  customUser?: string
) {
  return {
    system: customSystem?.trim() || buildDefaultArticleSystemPrompt(ctx),
    userTemplate: customUser?.trim() || null,
  };
}

export function getImagePrompts(ctx: BlogContext, customSystem?: string) {
  return {
    system: customSystem?.trim() || buildDefaultImageSystemPrompt(ctx),
  };
}
