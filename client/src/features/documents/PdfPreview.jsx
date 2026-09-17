import { useQuery } from '@tanstack/react-query';
import { Download, FileWarning } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Button, Card, Spinner } from '@/components/ui';

/**
 * Shows the generated PDF exactly as it will be downloaded. The file is fetched
 * with the session cookie and rendered from a blob URL, so the preview and the
 * download are always the same document.
 */
export function PdfPreview({ fetcher, queryKey, onDownload, className, height = 'h-[78vh]' }) {
  const { data: blob, isPending, isError, error } = useQuery({
    queryKey: queryKey ?? ['pdf-preview', String(fetcher)],
    queryFn: fetcher,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);

  return (
    <Card className={className}>
      {isPending && (
        <div className={`flex ${height} items-center justify-center`}>
          <Spinner size={26} />
        </div>
      )}

      {isError && (
        <div className={`flex ${height} flex-col items-center justify-center gap-3 px-6 text-center`}>
          <span className="flex size-11 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <FileWarning size={22} />
          </span>
          <p className="text-sm font-medium text-slate-900">The preview could not be generated</p>
          <p className="max-w-sm text-sm text-slate-500">{error?.message}</p>
          {onDownload && (
            <Button variant="secondary" leftIcon={Download} onClick={onDownload}>
              Try downloading instead
            </Button>
          )}
        </div>
      )}

      {url && (
        <>
          {/* Mobile browsers often refuse to render PDFs in an iframe. */}
          <iframe title="Document preview" src={`${url}#view=FitH`} className={`hidden w-full rounded-2xl md:block ${height}`} />
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center md:hidden">
            <p className="text-sm text-slate-600">PDF preview is not supported on small screens.</p>
            {onDownload && (
              <Button leftIcon={Download} onClick={onDownload}>
                Download PDF
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
