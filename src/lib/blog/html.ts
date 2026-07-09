import { marked } from 'marked';
import type { BlogOutline } from './types';

export function prepareOutlineForArticle(outline: BlogOutline) {
  const bodySectionsArray = (outline.body_sections || []).map((section, index) => ({
    h2: section.h2 || `Section ${index + 1}`,
    description: section.description || '',
    keywords: section.keywords || [],
    subsections: (section.subsections || []).map((sub) => ({
      h3: sub.h3 || '',
      description: sub.description || '',
    })),
  }));

  let bodySectionsText = '';
  bodySectionsArray.forEach((section, index) => {
    bodySectionsText += `SECTION ${index + 1}: ${section.h2}\n`;
    bodySectionsText += `${section.description}\n`;
    if (section.keywords.length) {
      bodySectionsText += `Keywords: ${section.keywords.join(', ')}\n`;
    }
    if (section.subsections.length) {
      section.subsections.forEach((sub, subIndex) => {
        bodySectionsText += `  ${subIndex + 1}. ${sub.h3}\n     ${sub.description}\n`;
      });
    }
    bodySectionsText += '\n';
  });

  return {
    ...outline,
    introduction_description: outline.introduction,
    conclusion_description: outline.conclusion,
    body_sections: bodySectionsArray,
    body_sections_text: bodySectionsText.trim(),
  };
}

export function postProcessArticleMarkdown(
  article: string,
  bodySectionsText?: string
): string {
  let correctedText = article.replace(/2024/g, '2026');

  if (bodySectionsText) {
    const trueH2Headings: string[] = [];
    for (const line of bodySectionsText.split('\n')) {
      if (line.startsWith('SECTION')) {
        trueH2Headings.push(line.substring(line.indexOf(':') + 1).trim());
      }
    }

    const lines = correctedText.split('\n');
    correctedText = lines
      .map((line) => {
        if (trueH2Headings.length && line.startsWith('## ')) {
          const currentHeading = line.substring(3).trim();
          const isTrueH2 = trueH2Headings.some(
            (h2) => h2.includes(currentHeading) || currentHeading.includes(h2)
          );
          if (!isTrueH2) return `### ${currentHeading}`;
        }
        return line;
      })
      .join('\n');
  }

  return correctedText.replace(/(?<=[.!?])\s+/g, '\n');
}

export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string;
}

export function cleanupArticleHtml(content: string): string {
  let html = content;

  if (html.includes('<!DOCTYPE') || html.includes('<html')) {
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      html = articleMatch[1];
    } else {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) html = bodyMatch[1];
    }
  }

  html = html.replace(/<div[^>]*>[\s\S]*?<h1[^>]*>[\s\S]*?<\/h1>[\s\S]*?<\/div>/i, '');
  html = html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '');

  html = html.replace(/<br\s*\/?>\s*(?=<h[2-6]\b)/gi, '');
  html = html.replace(/(?<=<\/h[2-6]>)\s*<br\s*\/?>/gi, '');
  html = html.replace(/<br\s*\/?>\s*(?=<img\b)/gi, '');
  html = html.replace(/(?<=<img\b[^>]*>)\s*<br\s*\/?>/gi, '');

  html = html.replace(
    /(<h[2-6]\b[^>]*>[\s\S]*?<\/h[2-6]>)/gi,
    '<div style="margin-top:24px; margin-bottom:16px;">$1</div>'
  );
  html = html.replace(
    /(<img\b[^>]*>)/gi,
    '<div style="margin-top:16px; margin-bottom:16px;">$1</div>'
  );

  return html.trim();
}

export function insertImageAfterFirstHeading(content: string, imgUrl: string, alt = 'Featured Image') {
  const h1Regex = /<\/h1>/i;
  const match = content.match(h1Regex);
  if (!match || match.index === undefined) {
    return `${content}\n<img src="${imgUrl}" alt="${alt}" style="max-width: 100%; height: auto;">`;
  }

  const insertAt = match.index + match[0].length;
  const imgTag = `\n<img src="${imgUrl}" alt="${alt}" style="max-width: 100%; height: auto;">\n`;
  return content.slice(0, insertAt) + imgTag + content.slice(insertAt);
}
