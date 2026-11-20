const DEFAULT_API_URL = 'https://web.onio.app';
const TOKEN_PREFIX = 'onio_pat_';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export interface Config {
  token: string;
  apiUrl: string;
}

export function readConfig(env: NodeJS.ProcessEnv): Config {
  return { token: readToken(env.ONIO_TOKEN), apiUrl: readApiUrl(env.ONIO_API_URL) };
}

function readToken(value: string | undefined): string {
  const token = value?.trim();
  if (!token) {
    throw new Error('Set ONIO_TOKEN to a personal access token from your Onio profile.');
  }
  if (!token.startsWith(TOKEN_PREFIX)) {
    throw new Error(`ONIO_TOKEN must start with ${TOKEN_PREFIX}.`);
  }
  return token;
}

function readApiUrl(value: string | undefined): string {
  if (!value?.trim()) {
    return DEFAULT_API_URL;
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('ONIO_API_URL must be a URL, for example https://web.onio.app.');
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname))) {
    throw new Error('ONIO_API_URL must use https, except for localhost.');
  }
  return url.origin;
}
