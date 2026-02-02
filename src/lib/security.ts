import path from 'path';

/**
 * Validate that a URL is safe to fetch (no SSRF).
 * Blocks private IPs, loopback, and non-http(s) schemes.
 */
export function isAllowedUrl(urlString: string): { ok: true } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { ok: false, reason: 'Invalid URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: `Disallowed scheme: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0' || hostname === '[::1]') {
    return { ok: false, reason: 'Loopback addresses are not allowed' };
  }

  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 10) return { ok: false, reason: 'Private IP range (10.x)' };
    if (a === 172 && b >= 16 && b <= 31) return { ok: false, reason: 'Private IP range (172.16-31.x)' };
    if (a === 192 && b === 168) return { ok: false, reason: 'Private IP range (192.168.x)' };
    if (a === 169 && b === 254) return { ok: false, reason: 'Link-local address (169.254.x)' };
    if (a === 127) return { ok: false, reason: 'Loopback address (127.x)' };
    if (a === 0) return { ok: false, reason: 'Reserved address (0.x)' };
  }

  return { ok: true };
}

/**
 * Validate that a URL is a recognized Google service embed URL.
 */
export function isAllowedEmbedUrl(url: string | null, service: 'docs' | 'sheets' | 'slides' | 'maps'): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    switch (service) {
      case 'docs':
        return hostname === 'docs.google.com';
      case 'sheets':
        return hostname === 'docs.google.com' && parsed.pathname.startsWith('/spreadsheets');
      case 'slides':
        return hostname === 'docs.google.com' && parsed.pathname.startsWith('/presentation');
      case 'maps':
        return hostname === 'www.google.com' && parsed.pathname.startsWith('/maps') ||
               hostname === 'maps.google.com' ||
               hostname === 'google.com' && parsed.pathname.startsWith('/maps');
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * Validate that a resolved file path stays within the expected base directory.
 * Prevents path traversal attacks (e.g. ../../etc/passwd).
 *
 * TypeScript re-implementation of the electron/main.js version.
 * The Electron copy stays in place since it can't import from src/.
 */
export function validateFilePath(basePath: string, ...segments: string[]): string {
  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(basePath, ...segments);
  if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
    throw new Error(`Path traversal blocked: ${segments.join('/')} escapes ${basePath}`);
  }
  return resolvedTarget;
}

/**
 * Sanitize a file name by removing dangerous characters.
 *
 * TypeScript re-implementation of the electron/main.js version.
 * The Electron copy stays in place since it can't import from src/.
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/\.\./g, '_')
    .replace(/[/\\]/g, '_')
    .replace(/[<>:"|?*\x00-\x1F]/g, '_');
}
