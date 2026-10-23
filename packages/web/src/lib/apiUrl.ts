/** Resolve an API route against the configured hosted origin when one exists. */
export function apiUrl(
  path: string,
  configuredOrigin: string = import.meta.env.VITE_API_URL || '',
): string {
  const route = path.startsWith('/') ? path : `/${path}`;
  const origin = configuredOrigin.trim().replace(/\/+$/, '');
  return `${origin}${route}`;
}
