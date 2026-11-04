import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Live server stats (polled) plus a rolling history window for sparklines/charts.
export function useServerStats({ interval = 3000, historySize = 40 } = {}) {
  const query = useQuery({
    queryKey: ['system', 'stats'],
    queryFn: () => api.get('/api/system/stats').then((r) => r.data),
    refetchInterval: interval,
    staleTime: interval,
  });
  const [history, setHistory] = useState([]);
  const lastAt = useRef(0);

  useEffect(() => {
    const d = query.data;
    if (!d || query.dataUpdatedAt === lastAt.current) return;
    lastAt.current = query.dataUpdatedAt;
    setHistory((h) => [
      ...h.slice(-(historySize - 1)),
      {
        t: new Date(query.dataUpdatedAt).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
        cpu: Number(d.cpu_usage) || 0,
        mem: Number(d.mem_usage_pct) || 0,
        rx: Number(d.network?.download_speed_kbps) || 0,
        tx: Number(d.network?.upload_speed_kbps) || 0,
      },
    ]);
  }, [query.data, query.dataUpdatedAt, historySize]);

  return { ...query, history };
}
