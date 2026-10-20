import {handler} from '../app.mjs';

export function normalizeRoute(requestUrl) {
  const url = new URL(requestUrl || '/', 'https://backend.internal');
  const route = url.searchParams.get('route');
  if (route === 'health') return '/health';
  if (route !== 'v1') return requestUrl;
  const kind = url.searchParams.get('kind') || '';
  if (!/^[a-z]+$/.test(kind)) return '/invalid';
  url.searchParams.delete('route');
  url.searchParams.delete('kind');
  const query = url.searchParams.toString();
  return '/v1/' + kind + (query ? '?' + query : '');
}

export default function vercelHandler(req, res) {
  req.url = normalizeRoute(req.url);
  return handler(req, res);
}
