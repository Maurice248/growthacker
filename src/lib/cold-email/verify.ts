export type EmailVerificationStatus = 'verified' | 'catch_all' | 'invalid' | 'unknown';

export function mapMillionVerifierCode(resultcode: number): EmailVerificationStatus {
  switch (resultcode) {
    case 1:
      return 'verified';
    case 2:
      return 'catch_all';
    case 5:
    case 6:
    case 7:
      return 'invalid';
    case 3:
    case 4:
    default:
      return 'unknown';
  }
}

export async function verifyEmail(
  apiKey: string,
  email: string
): Promise<{ email: string; email_status: EmailVerificationStatus; resultcode: number }> {
  const url = new URL('https://api.millionverifier.com/api/v3');
  url.searchParams.set('api', apiKey);
  url.searchParams.set('email', email);
  url.searchParams.set('timeout', '10');

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    return { email, email_status: 'unknown', resultcode: 4 };
  }

  const data = (await res.json()) as { resultcode?: number };
  const resultcode = Number(data.resultcode ?? 4);
  return {
    email,
    email_status: mapMillionVerifierCode(resultcode),
    resultcode,
  };
}

export async function verifyEmailsBatch(
  apiKey: string,
  emails: string[],
  concurrency = 10
): Promise<Map<string, EmailVerificationStatus>> {
  const results = new Map<string, EmailVerificationStatus>();

  for (let i = 0; i < emails.length; i += concurrency) {
    const batch = emails.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((email) => verifyEmail(apiKey, email))
    );
    for (const r of batchResults) {
      results.set(r.email, r.email_status);
    }
    if (i + concurrency < emails.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return results;
}
