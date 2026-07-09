type RenderVars = {
  first_name: string;
  last_name: string;
  email: string;
  service_type: string;
  unsubscribe_token: string;
  unsubscribe_url: string;
};

export function renderNewsletterHtml(templateHtml: string, vars: RenderVars): string {
  let html = templateHtml;

  const replacements: Record<string, string> = {
    '{{first_name}}': vars.first_name || 'there',
    '{{last_name}}': vars.last_name || '',
    '{{email}}': vars.email,
    '{{service_type}}': vars.service_type || 'Newsletter',
    '{{unsubscribe_token}}': vars.unsubscribe_token,
    '{{unsubscribe_url}}': vars.unsubscribe_url,
  };

  for (const [token, value] of Object.entries(replacements)) {
    html = html.split(token).join(value);
  }

  return html;
}

export function buildUnsubscribeUrl(baseUrl: string, token: string): string {
  const trimmed = baseUrl.replace(/\/$/, '');
  if (trimmed.includes('?')) {
    return `${trimmed}&token=${encodeURIComponent(token)}`;
  }
  return `${trimmed}?token=${encodeURIComponent(token)}`;
}
