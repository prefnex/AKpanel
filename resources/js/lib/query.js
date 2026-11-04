import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, err) => (err?.status >= 400 && err?.status < 500 ? false : count < 2),
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (err) => toast.error(err?.message || 'Something went wrong'),
    },
  },
});
