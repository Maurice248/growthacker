import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wfPath = path.join(__dirname, '../src/data/tenant-report-blog-automation.workflow.json');
const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));

const strip = (s) => (s || '').replace(/^=/, '');
const byName = (n) => wf.nodes.find((x) => x.name === n);
const title = byName('Title and Subheading Generator');
const article = byName('Article Writing Chain');
const image = byName('AI Agent');

let titleUser = strip(title.parameters.text)
  .replace(/\{\{\s*\$\('Code in JavaScript4'\)\.item\.json\.category\s*\}\}/g, '{{category}}')
  .replace(
    /\{\{\s*\$json\.data\s*\}\}\{\{\s*\$\('Code in JavaScript4'\)\.item\.json\.seeds\s*\}\}/g,
    '{{rankedKeywords}}\n{{keywords}}'
  )
  .replace(/\{\{\s*\$now\.format\('yyyy-MM-dd'\)\s*\}\}/g, '{{today}}');

let articleUser = strip(article.parameters.text)
  .replace(/\{\{\s*\$json\.title\s*\}\}/g, '{{title}}')
  .replace(/\{\{\s*\$json\.meta_title\s*\}\}/g, '{{meta_title}}')
  .replace(/\{\{\s*\$json\.meta_description\s*\}\}/g, '{{meta_description}}')
  .replace(/\{\{\s*\$json\.url\s*\}\}/g, '{{url}}')
  .replace(/\{\{\s*\$json\.selected_keywords\s*\}\}/g, '{{selected_keywords}}')
  .replace(/\{\{\s*\$json\.main_keyword_for_url\s*\}\}/g, '{{main_keyword_for_url}}')
  .replace(/\{\{\s*\$json\.summary\s*\}\}/g, '{{summary}}')
  .replace(/\{\{\s*\$json\.introduction_description\s*\}\}/g, '{{introduction_description}}')
  .replace(/\{\{\s*\$json\.body_sections_text\s*\}\}/g, '{{body_sections_text}}')
  .replace(/\{\{\s*\$json\.conclusion_description\s*\}\}/g, '{{conclusion_description}}')
  .replace(/\{\{\s*\$json\.cta\s*\}\}/g, '{{cta}}')
  .replace(/Todays date\s*:\s*\{\{\s*\$now\.format\('yyyy-MM-dd'\)\s*\}\}/gi, "Today's date: {{today}}");

const out = `/**
 * Tenant Report blog prompts — extracted from n8n workflow
 * src/data/tenant-report-blog-automation.workflow.json
 * Used only to seed BlogConfig for the tenant-report company.
 */
export const TENANT_REPORT_BLOG_PROMPTS = {
  titlePrompt: ${JSON.stringify(strip(title.parameters.messages.messageValues[0].message))},
  titleUserPrompt: ${JSON.stringify(titleUser)},
  articleSystemPrompt: ${JSON.stringify(strip(article.parameters.messages.messageValues[0].message))},
  articleUserPrompt: ${JSON.stringify(articleUser)},
  imagePromptSystem: ${JSON.stringify(strip(image.parameters.options.systemMessage))},
} as const;
`;

const target = path.join(__dirname, '../src/lib/blog/tenant-report-prompts.ts');
fs.writeFileSync(target, out);
console.log('Wrote', target);
