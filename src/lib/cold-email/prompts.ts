import { formatOutreachBrandBlock } from './company-context';
import type { CampaignGenerateInput, OutreachContext } from './types';

export function buildCampaignSystemPrompt(ctx: OutreachContext): string {
  const brandBlock = formatOutreachBrandBlock(ctx);

  return `You are ${ctx.companyName}'s expert cold email campaign content writer. You write professional, conversational, human-sounding outreach emails that help the company reach its ideal customers.

Your primary goal is INBOX DELIVERY. Every word choice must avoid spam filters.
Write like a trusted advisor sending a personal note — not a marketer.

================================================================
BUSINESS CONTEXT — ${ctx.companyName.toUpperCase()}
================================================================
${brandBlock}

---

## INBOX DELIVERY RULES — HIGHEST PRIORITY

### NEVER USE — ANYWHERE IN THE EMAIL
Emojis of any kind (subject line, body, anywhere)
Exclamation marks more than once in the entire email
ALL CAPS anywhere
These words: free, cheap, cheapest, discount, deal, offer, promotion,
guaranteed, risk-free, act now, limited time, hurry, buy now, click here,
save, earn, cash, winner, best price, exclusive, screening package,
best platform, top service, number one, world class, transform,
amazing, incredible, revolutionary, opportunity, don't miss, congratulations,
urgent, important, reminder, special, bonus, zero risk, 100% reliable,
instant approval, no credit check, guaranteed rent, eviction guarantee

### SUBJECT LINE RULES (critical for inbox placement)
- 40–55 characters maximum
- Plain text only — no emoji, no symbols, no punctuation tricks
- Write like a colleague sending a personal email, not a campaign
- No questions ending in "?" in the subject
- No: "Re:", "Fwd:", or fake reply threading

### PREVIEW TEXT RULES
- 85–100 characters
- Must read as a natural continuation of the subject line
- No clickbait, no urgency language, no emoji

### BODY COPY RULES
- Short paragraphs: 2–3 lines maximum each
- One exclamation mark allowed in the entire body — use it in the closing only
- Vary sentence length — mix short and medium sentences
- Never repeat the company name more than 3 times total
- Use soft language: "may help", "many find", "designed to support"
- Never make absolute claims or guarantees
- Never use discriminatory language
- Never fear-monger — focus on informed decisions

---

## PLACEHOLDER VARIABLES — USE EXACTLY AS WRITTEN
{{subscriber_first_name}}
{{subscriber_last_name}}
{{subscriber_email}}
{{first_name}}
{{last_name}}
{{service_type}}
{{city}}
{{country}}

Never substitute real values. Keep as-is.

---

## OUTPUT FORMAT

Return a single JSON object with these exact keys:
subject_line, preview_text, header_title, greeting, opening, main_content, cta, closing, footer_note, email_body

The email_body field must contain the full email assembled from all sections with clear section labels:
[SUBJECT LINE], [PREVIEW TEXT], [HEADER TITLE], [GREETING], [OPENING], [MAIN CONTENT], [CTA], [CLOSING], [FOOTER NOTE]

No HTML, no markdown, no code fences. JSON only.`;
}

export function buildCampaignUserPrompt(ctx: OutreachContext, input: CampaignGenerateInput): string {
  const ctaLink = input.cta_link?.trim() || ctx.defaultCtaLink;

  return `Generate a cold email campaign for ${ctx.companyName} using the inputs below.

Campaign Name: ${input.campaign_name}
Service Type: ${input.service_type}
Target Region: ${input.target_region}
Campaign Goal: ${input.campaign_goal}
Campaign Message: ${input.campaign_message}
CTA Button Text: ${input.cta_button_text}
CTA Link: ${ctaLink}
Tone: ${input.tone}
Lead List: ${input.selected_sheet}

Follow every rule in your system instructions exactly.
Use {{subscriber_first_name}} in the greeting — never write a name directly.
Write no emojis anywhere. Write no exclamation marks except one in the closing.
The subject line must read like a personal email, not a campaign blast.
Every section must sound human, calm, and trustworthy.
Brand name is ${ctx.companyName} — use it consistently but sparingly.`;
}

export function parseCampaignAiOutput(raw: string): Record<string, string> {
  let parsed: Record<string, unknown>;

  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    parsed = parseSectionedEmail(raw);
  }

  const str = (key: string, fallback = '') =>
    typeof parsed[key] === 'string' ? (parsed[key] as string).trim() : fallback;

  const subject_line = str('subject_line') || extractSection(raw, '[SUBJECT LINE]', '[PREVIEW TEXT]') || 'Campaign Update';
  const preview_text = str('preview_text') || extractSection(raw, '[PREVIEW TEXT]', '[HEADER TITLE]');
  const header_title = str('header_title') || extractSection(raw, '[HEADER TITLE]', '[GREETING]');
  const greeting = str('greeting') || extractSection(raw, '[GREETING]', '[OPENING]');
  const opening = str('opening') || extractSection(raw, '[OPENING]', '[MAIN CONTENT]');
  const main_content = str('main_content') || extractSection(raw, '[MAIN CONTENT]', '[CTA]');
  const cta = str('cta') || extractSection(raw, '[CTA]', '[CLOSING]');
  const closing = str('closing') || extractSection(raw, '[CLOSING]', '[FOOTER NOTE]');
  const footer_note = str('footer_note') || extractSection(raw, '[FOOTER NOTE]', null);
  const email_body =
    str('email_body') ||
    str('full_email_body') ||
    str('full_content') ||
    assembleEmailBody({
      subject_line,
      preview_text,
      header_title,
      greeting,
      opening,
      main_content,
      cta,
      closing,
      footer_note,
    });

  return {
    subject_line,
    preview_text,
    header_title,
    greeting,
    opening,
    main_content,
    cta,
    closing,
    footer_note,
    email_body,
  };
}

function extractSection(text: string, label: string, nextLabel: string | null): string {
  const start = text.indexOf(label);
  if (start === -1) return '';
  const contentStart = start + label.length;
  if (nextLabel) {
    const end = text.indexOf(nextLabel, contentStart);
    if (end === -1) return text.slice(contentStart).trim();
    return text.slice(contentStart, end).trim();
  }
  return text.slice(contentStart).trim();
}

function parseSectionedEmail(raw: string): Record<string, string> {
  return {
    subject_line: extractSection(raw, '[SUBJECT LINE]', '[PREVIEW TEXT]'),
    preview_text: extractSection(raw, '[PREVIEW TEXT]', '[HEADER TITLE]'),
    header_title: extractSection(raw, '[HEADER TITLE]', '[GREETING]'),
    greeting: extractSection(raw, '[GREETING]', '[OPENING]'),
    opening: extractSection(raw, '[OPENING]', '[MAIN CONTENT]'),
    main_content: extractSection(raw, '[MAIN CONTENT]', '[CTA]'),
    cta: extractSection(raw, '[CTA]', '[CLOSING]'),
    closing: extractSection(raw, '[CLOSING]', '[FOOTER NOTE]'),
    footer_note: extractSection(raw, '[FOOTER NOTE]', null),
    email_body: raw,
  };
}

function assembleEmailBody(sections: Record<string, string>): string {
  return [
    '[SUBJECT LINE]',
    sections.subject_line,
    '',
    '[PREVIEW TEXT]',
    sections.preview_text,
    '',
    '[HEADER TITLE]',
    sections.header_title,
    '',
    '[GREETING]',
    sections.greeting,
    '',
    '[OPENING]',
    sections.opening,
    '',
    '[MAIN CONTENT]',
    sections.main_content,
    '',
    '[CTA]',
    sections.cta,
    '',
    '[CLOSING]',
    sections.closing,
    '',
    '[FOOTER NOTE]',
    sections.footer_note,
  ]
    .filter((line) => line !== undefined)
    .join('\n');
}

export function personalizeEmail(
  template: string,
  lead: {
    first_name?: string;
    last_name?: string;
    email: string;
    city?: string;
    country?: string;
    service_type?: string;
  }
): string {
  const firstName = (lead.first_name || 'there').trim();
  const lastName = (lead.last_name || '').trim();
  const replacements: Record<string, string> = {
    '{{subscriber_first_name}}': firstName,
    '{{first_name}}': firstName,
    '{{subscriber_last_name}}': lastName,
    '{{last_name}}': lastName,
    '{{subscriber_email}}': lead.email,
    '{{email}}': lead.email,
    '{{service_type}}': lead.service_type || '',
    '{{city}}': lead.city || '',
    '{{country}}': lead.country || '',
  };

  let result = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
  }
  return result;
}

export function buildPlainTextOutreach(
  lead: {
    first_name?: string;
    last_name?: string;
    email: string;
    city?: string;
    country?: string;
  },
  subjectLine: string,
  companyName: string,
  destinationUrl: string
): string {
  const firstName = lead.first_name || 'there';
  const city = lead.city || '';
  const locationLine = city ? ` in ${city}` : '';

  return `Hey ${firstName},

Hope you're doing well${locationLine}.

We wanted to share something that might interest you — ${companyName} may be able to help with what you're working on.

If you've been looking for a smarter approach, we'd love to share how others are using our platform.

Would you be open to a brief conversation?

Best regards,
The ${companyName} Team
${destinationUrl}

Subject: ${subjectLine}`;
}
