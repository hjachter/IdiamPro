import { isAllowedUrl, isAllowedEmbedUrl, validateFilePath, sanitizeFileName } from '@/lib/security';
import path from 'path';

describe('isAllowedUrl', () => {
  it('allows valid http URL', () => {
    expect(isAllowedUrl('http://example.com/file.pdf')).toEqual({ ok: true });
  });

  it('allows valid https URL', () => {
    expect(isAllowedUrl('https://example.com/file.pdf')).toEqual({ ok: true });
  });

  it('rejects ftp scheme', () => {
    const result = isAllowedUrl('ftp://example.com/file');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Disallowed scheme');
  });

  it('rejects file scheme', () => {
    const result = isAllowedUrl('file:///etc/passwd');
    expect(result.ok).toBe(false);
  });

  it('rejects javascript scheme', () => {
    const result = isAllowedUrl('javascript:alert(1)');
    expect(result.ok).toBe(false);
  });

  it('rejects invalid URL', () => {
    const result = isAllowedUrl('not a url');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('Invalid URL');
  });

  it('rejects empty string', () => {
    const result = isAllowedUrl('');
    expect(result.ok).toBe(false);
  });

  it('rejects localhost', () => {
    const result = isAllowedUrl('http://localhost:3000');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Loopback');
  });

  it('rejects 127.0.0.1', () => {
    const result = isAllowedUrl('http://127.0.0.1:8080');
    expect(result.ok).toBe(false);
  });

  it('rejects ::1', () => {
    const result = isAllowedUrl('http://::1/path');
    expect(result.ok).toBe(false);
  });

  it('rejects 0.0.0.0', () => {
    const result = isAllowedUrl('http://0.0.0.0/path');
    expect(result.ok).toBe(false);
  });

  it('blocks 10.x.x.x private range', () => {
    const result = isAllowedUrl('http://10.0.0.1/resource');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('10.x');
  });

  it('blocks 172.16.x.x private range', () => {
    const result = isAllowedUrl('http://172.16.0.1/resource');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('172.16-31.x');
  });

  it('blocks 172.31.x.x private range (upper boundary)', () => {
    const result = isAllowedUrl('http://172.31.255.255/resource');
    expect(result.ok).toBe(false);
  });

  it('allows 172.15.x.x (below private range)', () => {
    expect(isAllowedUrl('http://172.15.0.1/resource')).toEqual({ ok: true });
  });

  it('allows 172.32.x.x (above private range)', () => {
    expect(isAllowedUrl('http://172.32.0.1/resource')).toEqual({ ok: true });
  });

  it('blocks 192.168.x.x private range', () => {
    const result = isAllowedUrl('http://192.168.1.1/resource');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('192.168');
  });

  it('blocks 169.254.x.x link-local range', () => {
    const result = isAllowedUrl('http://169.254.169.254/metadata');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Link-local');
  });

  it('blocks 127.x.x.x loopback range', () => {
    const result = isAllowedUrl('http://127.0.0.2/resource');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Loopback');
  });

  it('blocks 0.x.x.x reserved range', () => {
    const result = isAllowedUrl('http://0.1.2.3/resource');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Reserved');
  });

  it('allows public IP addresses', () => {
    expect(isAllowedUrl('http://8.8.8.8/resource')).toEqual({ ok: true });
  });

  it('allows domain names', () => {
    expect(isAllowedUrl('https://www.google.com/document')).toEqual({ ok: true });
  });
});

describe('isAllowedEmbedUrl', () => {
  // Docs
  it('allows valid Google Docs URL', () => {
    expect(isAllowedEmbedUrl('https://docs.google.com/document/d/123', 'docs')).toBe(true);
  });

  it('rejects non-Google URL for docs', () => {
    expect(isAllowedEmbedUrl('https://evil.com/document', 'docs')).toBe(false);
  });

  // Sheets
  it('allows valid Google Sheets URL', () => {
    expect(isAllowedEmbedUrl('https://docs.google.com/spreadsheets/d/123', 'sheets')).toBe(true);
  });

  it('rejects docs.google.com with wrong path for sheets', () => {
    expect(isAllowedEmbedUrl('https://docs.google.com/document/d/123', 'sheets')).toBe(false);
  });

  // Slides
  it('allows valid Google Slides URL', () => {
    expect(isAllowedEmbedUrl('https://docs.google.com/presentation/d/123', 'slides')).toBe(true);
  });

  it('rejects docs.google.com with wrong path for slides', () => {
    expect(isAllowedEmbedUrl('https://docs.google.com/document/d/123', 'slides')).toBe(false);
  });

  // Maps
  it('allows www.google.com/maps URL', () => {
    expect(isAllowedEmbedUrl('https://www.google.com/maps/embed?pb=123', 'maps')).toBe(true);
  });

  it('allows maps.google.com URL', () => {
    expect(isAllowedEmbedUrl('https://maps.google.com/something', 'maps')).toBe(true);
  });

  it('allows google.com/maps URL', () => {
    expect(isAllowedEmbedUrl('https://google.com/maps/place/abc', 'maps')).toBe(true);
  });

  // Null / empty / invalid
  it('rejects null URL', () => {
    expect(isAllowedEmbedUrl(null, 'docs')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isAllowedEmbedUrl('', 'docs')).toBe(false);
  });

  it('rejects malformed URL', () => {
    expect(isAllowedEmbedUrl('not-a-url', 'docs')).toBe(false);
  });
});

describe('validateFilePath', () => {
  const base = '/home/user/documents';

  it('returns resolved path for valid subpath', () => {
    const result = validateFilePath(base, 'file.txt');
    expect(result).toBe(path.resolve(base, 'file.txt'));
  });

  it('returns resolved path for nested subpath', () => {
    const result = validateFilePath(base, 'subdir', 'file.txt');
    expect(result).toBe(path.resolve(base, 'subdir', 'file.txt'));
  });

  it('accepts the base path itself', () => {
    const result = validateFilePath(base);
    expect(result).toBe(path.resolve(base));
  });

  it('throws on ../ traversal', () => {
    expect(() => validateFilePath(base, '..', 'etc', 'passwd')).toThrow('Path traversal blocked');
  });

  it('throws on ../../ traversal', () => {
    expect(() => validateFilePath(base, '..', '..', 'etc', 'passwd')).toThrow('Path traversal blocked');
  });
});

describe('sanitizeFileName', () => {
  it('preserves clean file name', () => {
    expect(sanitizeFileName('my-outline.idm')).toBe('my-outline.idm');
  });

  it('strips ..', () => {
    expect(sanitizeFileName('..file')).toBe('_file');
  });

  it('strips forward slashes', () => {
    expect(sanitizeFileName('path/to/file')).toBe('path_to_file');
  });

  it('strips backslashes', () => {
    expect(sanitizeFileName('path\\to\\file')).toBe('path_to_file');
  });

  it('strips special characters (<>:"|?*)', () => {
    expect(sanitizeFileName('file<name>:test')).toBe('file_name__test');
  });

  it('strips control characters', () => {
    expect(sanitizeFileName('file\x00name')).toBe('file_name');
  });

  it('handles combined dangerous input', () => {
    const result = sanitizeFileName('../../../etc/passwd');
    expect(result).not.toContain('..');
    expect(result).not.toContain('/');
  });
});
