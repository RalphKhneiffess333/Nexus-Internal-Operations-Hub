export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  path?: string;
  maxAgeSeconds?: number;
  expires?: Date;
}

export function parseCookieHeader(
  cookieHeader: string | undefined,
): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(';')
    .reduce<Record<string, string>>((cookies, cookie) => {
      const separatorIndex = cookie.indexOf('=');
      if (separatorIndex === -1) {
        return cookies;
      }

      const name = cookie.slice(0, separatorIndex).trim();
      const value = cookie.slice(separatorIndex + 1).trim();
      if (!name) {
        return cookies;
      }

      cookies[name] = decodeURIComponent(value);
      return cookies;
    }, {});
}

export function buildCookie(
  name: string,
  value: string,
  options: CookieOptions,
): string {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAgeSeconds !== undefined) {
    segments.push(`Max-Age=${options.maxAgeSeconds}`);
  }
  if (options.expires) {
    segments.push(`Expires=${options.expires.toUTCString()}`);
  }
  if (options.path) {
    segments.push(`Path=${options.path}`);
  }
  if (options.httpOnly) {
    segments.push('HttpOnly');
  }
  if (options.secure) {
    segments.push('Secure');
  }
  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }

  return segments.join('; ');
}
