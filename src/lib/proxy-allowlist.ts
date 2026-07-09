function hostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isBlockedHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  if (hostname === '127.0.0.1' || hostname.startsWith('127.')) return true;
  if (hostname === '::1' || hostname === '[::1]') return true;
  if (hostname.startsWith('10.')) return true;
  if (hostname.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  if (hostname.startsWith('169.254.')) return true;
  if (hostname.endsWith('.internal') || hostname.endsWith('.local')) return true;
  return false;
}

function collectEnvHostnames(): Set<string> {
  const hosts = new Set<string>();
  const raw = process.env.PROXY_ALLOWED_HOSTS?.trim();
  if (!raw) return hosts;
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const host = trimmed.includes('://') ? hostnameFromUrl(trimmed) : trimmed.toLowerCase();
    if (host) hosts.add(host);
  }
  return hosts;
}

/** Returns true when the URL targets an allowed external host. */
export async function isAllowedProxyUrl(url: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (isBlockedHostname(hostname)) {
    return false;
  }

  return collectEnvHostnames().has(hostname);
}
