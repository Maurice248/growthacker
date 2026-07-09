import { maskSecret } from '@/lib/integration-crypto';

export type DataForSeoCredentialParts = {
  login: string;
  password: string;
};

export type DataForSeoCredentialView = {
  loginSet: boolean;
  loginMasked: string;
  passwordSet: boolean;
  passwordMasked: string;
  configured: boolean;
};

export function normalizeDataForSeoCredential(credential: string): string {
  let cred = credential.trim();
  if (!cred) return cred;

  if (/^basic\s+/i.test(cred)) {
    const encoded = cred.replace(/^basic\s+/i, '').trim();
    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf8');
      if (decoded.includes(':')) return decoded;
    } catch {
      return encoded;
    }
  }

  if (!cred.includes(':') && /^[A-Za-z0-9+/=]+$/.test(cred) && cred.length > 16) {
    try {
      const decoded = Buffer.from(cred, 'base64').toString('utf8');
      if (decoded.includes(':')) return decoded;
    } catch {
      // keep original value
    }
  }

  return cred;
}

export function parseDataForSeoCredential(
  credential: string | null | undefined
): DataForSeoCredentialParts | null {
  const normalized = normalizeDataForSeoCredential(credential || '');
  if (!normalized.includes(':')) return null;

  const separator = normalized.indexOf(':');
  const login = normalized.slice(0, separator).trim();
  const password = normalized.slice(separator + 1).trim();
  if (!login || !password) return null;

  return { login, password };
}

export function formatDataForSeoCredential(login: string, password: string): string {
  return `${login.trim()}:${password.trim()}`;
}

export function buildDataForSeoCredential(
  existing: string | null | undefined,
  login?: string,
  password?: string
): string | null {
  const parsed = parseDataForSeoCredential(existing);
  const nextLogin = login?.trim() || parsed?.login || '';
  const nextPassword = password?.trim() || parsed?.password || '';
  if (!nextLogin || !nextPassword) return null;
  return formatDataForSeoCredential(nextLogin, nextPassword);
}

export function maskDataForSeoLogin(login: string): string {
  const trimmed = login.trim();
  if (!trimmed) return '';
  const at = trimmed.indexOf('@');
  if (at <= 0) return maskSecret(trimmed, 2);
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at);
  const visible = Math.min(2, local.length);
  return `${local.slice(0, visible)}••••${domain}`;
}

export function toDataForSeoCredentialView(
  credential: string | null | undefined
): DataForSeoCredentialView {
  const parsed = parseDataForSeoCredential(credential);
  return {
    loginSet: Boolean(parsed?.login),
    loginMasked: parsed?.login ? maskDataForSeoLogin(parsed.login) : '',
    passwordSet: Boolean(parsed?.password),
    passwordMasked: parsed?.password ? maskSecret(parsed.password) : '',
    configured: Boolean(parsed?.login && parsed?.password),
  };
}
