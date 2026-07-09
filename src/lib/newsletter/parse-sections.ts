import type { NewsletterData } from './types';

function extract(raw: string, label: string, nextLabel: string | null): string {
  const boldLabel = `**${label}**`;
  let start = raw.indexOf(label);
  let labelUsed = label;

  if (start === -1) {
    start = raw.indexOf(boldLabel);
    labelUsed = boldLabel;
  }
  if (start === -1) return '';

  const contentStart = start + labelUsed.length;

  if (nextLabel) {
    const end = raw.indexOf(nextLabel);
    if (end === -1) return raw.slice(contentStart).trim();
    return raw.slice(contentStart, end).trim();
  }

  return raw.slice(contentStart).trim();
}

function clean(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/-{2,}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanSubject(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/-{2,}/g, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function parseNewsletterSections(raw: string): NewsletterData {
  const subjectLine = extract(raw, '[SUBJECT LINE]', '[PREHEADER TEXT]');
  const preheader = extract(raw, '[PREHEADER TEXT]', '[HEADER TITLE]');
  const headerTitle = extract(raw, '[HEADER TITLE]', '[INTRO]');
  const intro = extract(raw, '[INTRO]', '[SECTION 1: MAIN STORY]');
  const mainStory = extract(raw, '[SECTION 1: MAIN STORY]', '[SECTION 2: KEY INSIGHTS]');
  const keyInsights = extract(raw, '[SECTION 2: KEY INSIGHTS]', '[SECTION 3: INDUSTRY UPDATE]');
  const industryUpdate = extract(raw, '[SECTION 3: INDUSTRY UPDATE]', '[SECTION 4: PRO TIP OF THE WEEK]');
  const proTip = extract(raw, '[SECTION 4: PRO TIP OF THE WEEK]', '[SECTION 5: CALL TO ACTION]');
  const callToAction = extract(raw, '[SECTION 5: CALL TO ACTION]', '[CLOSING]');
  const closing = extract(raw, '[CLOSING]', '[FOOTER NOTE]');
  const footerNote = extract(raw, '[FOOTER NOTE]', null);

  return {
    subjectLine: cleanSubject(subjectLine),
    preheader: clean(preheader),
    headerTitle: clean(headerTitle),
    intro: clean(intro),
    mainStory: clean(mainStory),
    keyInsights: clean(keyInsights),
    industryUpdate: clean(industryUpdate),
    proTip: clean(proTip),
    callToAction: clean(callToAction),
    closing: clean(closing),
    footerNote: clean(footerNote),
  };
}

export function hasStructuredFields(data: NewsletterData): boolean {
  return Boolean(
    data.subjectLine ||
      data.preheader ||
      data.headerTitle ||
      data.intro ||
      data.mainStory
  );
}
