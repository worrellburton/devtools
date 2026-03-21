export function extractName(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    if (parts.length >= 2) return parts.slice(-2).join('/');
    if (parts.length === 1) return parts[0];
    return u.hostname;
  } catch {
    return url;
  }
}

export function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch { return url; }
}

export function initials(name: string): string {
  const parts = name.split('/');
  const last = parts[parts.length - 1];
  return last.substring(0, 2).toUpperCase();
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function extractGhRepo(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('github.com')) return null;
    const parts = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    if (parts.length >= 2) return parts[0] + '/' + parts[1];
  } catch {}
  return null;
}
