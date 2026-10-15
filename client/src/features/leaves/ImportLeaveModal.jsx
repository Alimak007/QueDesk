import { useMutation } from '@tanstack/react-query';
import { CircleAlert, CircleCheck, Download, FileSpreadsheet, Info, TriangleAlert, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, ErrorState, FormField, Modal, Select, Spinner, Table, Tabs, Td, Th, THead, Tr } from '@/components/ui';
import { LEAVE_TYPE_MAP } from '@/lib/constants';
import { formatDate, formatDateRange } from '@/lib/dates';
import { cn, pluralize } from '@/lib/utils';
import { downloadLeaveTemplate, previewLeaveImport, useImportLeave } from './api';

const DATE_ORDERS = [
  { value: 'dmy', label: 'Day first — 13/2/2026' },
  { value: 'mdy', label: 'Month first — 2/13/2026' },
];

function RowStatus({ row }) {
  if (row.errors.length) return <CircleAlert size={16} className="text-red-500" aria-label="Will be skipped" />;
  if (row.warnings.length) return <TriangleAlert size={16} className="text-amber-500" aria-label="Will be imported, with a warning" />;
  return <CircleCheck size={16} className="text-emerald-500" aria-label="Ready" />;
}

function PreviewTable({ rows }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <Table>
        <THead>
          <tr>
            <Th className="w-10">
              <span className="sr-only">Status</span>
            </Th>
            <Th>Row</Th>
            <Th>Employee</Th>
            <Th>Type</Th>
            <Th>Dates</Th>
            <Th align="right">Days</Th>
          </tr>
        </THead>
        <tbody>
          {rows.map((row) => {
            const messages = [...row.errors, ...row.warnings];
            return (
              <Tr key={row.row} className={cn(row.errors.length && 'bg-red-50/40')}>
                <Td className="align-top">
                  <RowStatus row={row} />
                </Td>
                <Td className="align-top tabular text-slate-500">{row.row}</Td>
                <Td className="align-top">
                  <span className="block font-medium text-slate-900">{row.employee?.name ?? (row.employeeLabel || '—')}</span>
                  {row.employee && <span className="block text-xs text-slate-500">{row.employee.employeeId}</span>}
                  {messages.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {row.errors.map((m) => (
                        <li key={m} className="text-xs font-medium text-red-600">
                          {m}
                        </li>
                      ))}
                      {row.warnings.map((m) => (
                        <li key={m} className="text-xs text-amber-700">
                          {m}
                        </li>
                      ))}
                    </ul>
                  )}
                </Td>
                <Td className="align-top whitespace-nowrap">
                  {row.type ? (row.isHalfDay ? 'Half day' : (LEAVE_TYPE_MAP[row.type]?.short ?? row.type)) : '—'}
                </Td>
                <Td className="align-top whitespace-nowrap">
                  {row.startDate ? formatDateRange(row.startDate, row.endDate ?? row.startDate) : '—'}
                  {row.appliedOn && <span className="block text-xs text-slate-500">Applied {formatDate(row.appliedOn)}</span>}
                </Td>
                <Td align="right" className="align-top tabular">
                  {row.days ?? '—'}
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}

/**
 * Bulk-records approved leave from an Excel register. The file is read twice:
 * first as a preview where nothing is saved, then for real once the admin has
 * checked each row. Rows with problems are skipped.
 */
export function ImportLeaveModal({ open, onOpenChange }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dateOrder, setDateOrder] = useState('dmy');
  const [filter, setFilter] = useState('all');
  const preview = useMutation({ mutationFn: ({ file: f, dateOrder: order }) => previewLeaveImport(f, { dateOrder: order }) });
  const importLeave = useImportLeave();

  const resetAll = () => {
    setFile(null);
    setFilter('all');
    preview.reset();
  };

  const close = (next) => {
    if (!next) resetAll();
    onOpenChange(next);
  };

  const read = (nextFile, order = dateOrder) => {
    setFile(nextFile);
    setFilter('all');
    preview.mutate({ file: nextFile, dateOrder: order });
  };

  const onFile = (event) => {
    const chosen = event.target.files?.[0];
    event.target.value = '';
    if (chosen) read(chosen);
  };

  const onDrop = (event) => {
    event.preventDefault();
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) read(dropped);
  };

  const changeOrder = (order) => {
    setDateOrder(order);
    if (file) read(file, order);
  };

  const onDownloadTemplate = async () => {
    try {
      await downloadLeaveTemplate();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const result = preview.data;
  const ready = result?.summary.ready ?? 0;

  const onImport = async () => {
    try {
      const done = await importLeave.mutateAsync({ file, dateOrder });
      const skipped = done.summary.failed;
      toast.success(`${pluralize(done.imported, 'leave record')} imported`, {
        description: skipped ? `${pluralize(skipped, 'row')} with problems ${skipped === 1 ? 'was' : 'were'} skipped.` : undefined,
      });
      close(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const rows = result ? (filter === 'problems' ? result.rows.filter((r) => r.errors.length || r.warnings.length) : result.rows) : [];

  return (
    <Modal
      open={open}
      onOpenChange={close}
      size="xl"
      title="Import leave from Excel"
      description="Every valid row is recorded as approved leave. You’ll see each row before anything is saved."
      footer={
        <>
          {file && (
            <Button variant="ghost" className="mr-auto" onClick={() => inputRef.current?.click()} disabled={preview.isPending}>
              Choose another file
            </Button>
          )}
          <Button variant="secondary" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button onClick={onImport} disabled={!result || ready === 0 || preview.isPending} loading={importLeave.isPending}>
            {result ? `Import ${pluralize(ready, 'record')}` : 'Import'}
          </Button>
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        onChange={onFile}
        tabIndex={-1}
      />

      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <FormField label="Dates in the file are written" hint="Indian registers are usually day first.">
            {(field) => (
              <Select {...field} value={dateOrder} onChange={(e) => changeOrder(e.target.value)} disabled={preview.isPending}>
                {DATE_ORDERS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <Button variant="secondary" leftIcon={Download} onClick={onDownloadTemplate} className="sm:mb-6">
            Download template
          </Button>
        </div>

        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 px-6 py-12 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/30"
          >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Upload size={22} />
            </span>
            <span className="text-sm font-semibold text-slate-900">Choose an Excel file or drop it here</span>
            <span className="text-xs text-slate-500">
              .xlsx with the columns Employee ID, Leave Type, From Date and To Date — like the template
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
            <FileSpreadsheet size={20} className="shrink-0 text-emerald-600" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{file.name}</span>
            {preview.isPending && <Spinner size={18} />}
            {result && (
              <span className="flex flex-wrap gap-1.5">
                <Badge tone="green">{ready} ready</Badge>
                {result.summary.failed > 0 && <Badge tone="red">{result.summary.failed} skipped</Badge>}
                {result.summary.withWarnings > 0 && <Badge tone="amber">{result.summary.withWarnings} with warnings</Badge>}
              </span>
            )}
          </div>
        )}

        {preview.isError && <ErrorState error={preview.error} onRetry={() => read(file)} className="py-6" />}

        {result && (
          <>
            {result.notices.map((notice) => (
              <p key={notice} className="flex gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
                <Info size={16} className="mt-0.5 shrink-0" />
                {notice}
              </p>
            ))}
            {(result.summary.failed > 0 || result.summary.withWarnings > 0) && (
              <Tabs
                size="sm"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: 'All rows', count: result.summary.total },
                  { value: 'problems', label: 'Needs a look', count: result.summary.failed + result.summary.withWarnings },
                ]}
              />
            )}
            <PreviewTable rows={rows} />
          </>
        )}
      </div>
    </Modal>
  );
}
