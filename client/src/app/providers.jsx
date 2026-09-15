import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui';
import { AuthProvider } from '@/features/auth/AuthProvider';

const queryClient = new QueryClient({
  queryCache: new QueryCache(),
  mutationCache: new MutationCache(),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        if ([400, 401, 403, 404].includes(error?.status)) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

export function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>{children}</AuthProvider>
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{ className: 'font-sans', duration: 4000 }}
          offset={{ top: 72 }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
