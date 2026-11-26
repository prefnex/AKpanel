import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Web server modes, the active one, and the two default PHP versions (Nginx / Apache).
export function useWebServerModes() {
  return useQuery({
    queryKey: ['webservers', 'modes'],
    queryFn: () => api.get('/api/webservers/modes').then((r) => r.data),
    staleTime: 15_000,
  });
}

export const BACKEND_LABEL = { apache: 'Apache', nginx: 'Nginx' };
export const HANDLER_LABEL = { fpm: 'PHP-FPM', cgi: 'PHP-CGI (suexec)' };

// Short human summary of an effective stack ({backend, php_handler, varnish, site_type, proxy_port}).
export function describeStack(e) {
  if (!e) return '';
  if (e.site_type === 'proxy') return `Proxy :${e.proxy_port} via ${BACKEND_LABEL[e.backend] || e.backend}`;
  if (e.site_type === 'static') return `Static via ${BACKEND_LABEL[e.backend] || e.backend}${e.varnish ? ' + Varnish' : ''}`;
  const php = e.backend === 'apache' ? HANDLER_LABEL[e.php_handler] || 'PHP-FPM' : 'PHP-FPM';
  return `${BACKEND_LABEL[e.backend] || e.backend} · ${php}${e.varnish ? ' · Varnish' : ''}`;
}
