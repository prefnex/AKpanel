import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Installed PHP versions (newest first), shared by every PHP version picker.
export function useInstalledPHPVersions() {
  return useQuery({
    queryKey: ['php', 'versions'],
    queryFn: () => api.get('/api/php/versions'),
    staleTime: 60_000,
    select: (r) => (r.data || [])
      .filter((v) => v.is_installed)
      .map((v) => v.version)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true })),
  });
}
