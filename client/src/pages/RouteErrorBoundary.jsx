import { RotateCcw, TriangleAlert } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Button } from '@/components/ui';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const isChunkError = /Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    error?.message ?? '',
  );

  const message = isRouteErrorResponse(error)
    ? `${error.status} — ${error.statusText}`
    : isChunkError
      ? 'A new version of the portal is available.'
      : 'An unexpected error occurred while rendering this page.';

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-6">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <TriangleAlert size={22} />
        </span>
        <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
        <p className="mt-1.5 text-sm text-slate-500">{message}</p>
        {import.meta.env.DEV && error?.stack && (
          <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-slate-900 p-3 text-left text-xs text-slate-100">{error.stack}</pre>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => (window.location.href = '/')}>
            Go to dashboard
          </Button>
          <Button leftIcon={RotateCcw} onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    </div>
  );
}
