"use client";

interface NewsletterData {
  subjectLine?: string;
  preheader?: string;
  headerTitle?: string;
  intro?: string;
  mainStory?: string;
  keyInsights?: string;
  industryUpdate?: string;
  proTip?: string;
  callToAction?: string;
  closing?: string;
  footerNote?: string;
}

function formatText(text: string) {
  return text.replace(/\\n/g, "\n").trim();
}

function parseMainStory(text: string) {
  const lines = formatText(text).split("\n").filter(Boolean);
  const titleLine = lines.find((l) => l.toLowerCase().startsWith("title:"));
  const title = titleLine ? titleLine.replace(/^title:\s*/i, "") : null;
  const body = lines.filter((l) => l !== titleLine).join("\n");
  return { title, body };
}

function parseBullets(text: string) {
  const lines = formatText(text).split("\n").filter(Boolean);
  const titleLine = lines.find((l) => l.toLowerCase().startsWith("title:"));
  const title = titleLine ? titleLine.replace(/^title:\s*/i, "") : null;
  const bullets = lines
    .filter((l) => l !== titleLine)
    .map((l) => l.replace(/^[→•📌]\s*/, "").trim())
    .filter(Boolean);
  return { title, bullets };
}

export default function EmailPreview({ data }: { data: NewsletterData }) {
  const mainStory = data.mainStory ? parseMainStory(data.mainStory) : null;
  const keyInsights = data.keyInsights ? parseBullets(data.keyInsights) : null;
  const industryUpdate = data.industryUpdate ? parseBullets(data.industryUpdate) : null;

  return (
    <div style={{
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#374151',
      backgroundColor: '#f3f4f6',
      borderRadius: '16px',
      overflow: 'hidden',
      border: '1px solid #e5e7eb'
    }}>

      {/* Email client chrome */}
      <div style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        padding: '12px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        {data.subjectLine && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ fontSize: '11px', color: '#9ca3af', width: '60px', flexShrink: 0, fontWeight: 600, textTransform: 'uppercase' }}>Subject</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{formatText(data.subjectLine)}</span>
          </div>
        )}
        {data.preheader && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ fontSize: '11px', color: '#9ca3af', width: '60px', flexShrink: 0, fontWeight: 600, textTransform: 'uppercase' }}>Preview</span>
            <span style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>{formatText(data.preheader)}</span>
          </div>
        )}
      </div>

      {/* Email body wrapper */}
      <div style={{ backgroundColor: '#f3f4f6', padding: '48px 32px' }}>
        <div style={{
          maxWidth: '600px',
          margin: '0 auto',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}>

          {/* Header banner */}
          {data.headerTitle && (
            <div style={{
              backgroundColor: '#4f46e5',
              padding: '48px 40px',
              textAlign: 'center',
              backgroundImage: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)'
            }}>
              <p style={{ color: '#c7d2fe', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '12px' }}>Newsletter</p>
              <h1 style={{ color: '#ffffff', fontSize: '24px', fontWeight: 800, lineHeight: '1.3', margin: 0 }}>
                {formatText(data.headerTitle)}
              </h1>
            </div>
          )}

          <div style={{ padding: '56px 64px', display: 'flex', flexDirection: 'column', gap: '40px' }}>

            {/* Intro */}
            {data.intro && (
              <p style={{ fontSize: '15px', color: '#4b5563', lineHeight: '1.7', margin: 0 }}>
                {formatText(data.intro)}
              </p>
            )}

            {/* Main Story */}
            {mainStory && (
              <div style={{ borderLeft: '4px solid #6366f1', paddingLeft: '24px' }}>
                {mainStory.title && (
                  <p style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4f46e5', marginBottom: '8px', fontWeight: 800 }}>
                    {mainStory.title}
                  </p>
                )}
                <p style={{ fontSize: '15px', color: '#374151', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-line' }}>
                  {mainStory.body}
                </p>
              </div>
            )}

            {/* Key Insights */}
            {keyInsights && keyInsights.bullets.length > 0 && (
              <div style={{ backgroundColor: '#E7F0F6', borderRadius: '20px', padding: '32px' }}>
                {keyInsights.title && (
                  <p style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4f46e5', marginBottom: '16px', fontWeight: 800 }}>
                    {keyInsights.title}
                  </p>
                )}
                <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {keyInsights.bullets.map((b, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '14px', color: '#4b5563' }}>
                      <span style={{ marginTop: '6px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#818cf8', flexShrink: 0 }} />
                      <span style={{ lineHeight: '1.6' }}>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Industry Update */}
            {industryUpdate && industryUpdate.bullets.length > 0 && (
              <div style={{ backgroundColor: '#f9fafb', borderRadius: '20px', padding: '32px', border: '1px solid #f3f4f6' }}>
                {industryUpdate.title && (
                  <p style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', marginBottom: '16px', fontWeight: 800 }}>
                    {industryUpdate.title}
                  </p>
                )}
                <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {industryUpdate.bullets.map((b, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '14px', color: '#4b5563' }}>
                      <span style={{ flexShrink: 0, fontSize: '16px' }}>📌</span>
                      <span style={{ lineHeight: '1.6' }}>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pro Tip */}
            {data.proTip && (
              <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '20px', padding: '24px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '24px', lineHeight: '1' }}>💡</span>
                <p style={{ fontSize: '14px', color: '#92400e', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-line' }}>
                  {formatText(data.proTip).replace(/^💡\s*(Pro Tip:?\s*)?/i, "")}
                </p>
              </div>
            )}

            {/* Call to Action */}
            {data.callToAction && (
              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <span style={{
                  display: 'inline-block',
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 700,
                  padding: '16px 40px',
                  borderRadius: '100px',
                  boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.4)',
                  cursor: 'pointer'
                }}>
                  {formatText(data.callToAction)}
                </span>
              </div>
            )}

            {/* Closing */}
            {data.closing && (
              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '32px', marginTop: '8px' }}>
                <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-line' }}>
                  {formatText(data.closing)}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {data.footerNote && (
            <div style={{ backgroundColor: '#f9fafb', borderTop: '1px solid #f3f4f6', padding: '32px 40px', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.6', margin: 0 }}>
                {formatText(data.footerNote)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
