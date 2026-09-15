import { Archive, ArchiveRestore, ArrowDown, ArrowUp, ChevronDown, Ellipsis, Eye, EyeOff, Lock, Pencil, Plus, Settings2, Sparkles, Table2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  ErrorState,
  FormField,
  Hint,
  Input,
  Menu,
  MenuItem,
  MenuSeparator,
  PageHeader,
  Select,
  Skeleton,
  Switch,
} from '@/components/ui';
import { useArchiveField, useDeleteField, useReorderFields, useSalesConfig, useUpdateField, useUpdateSalesSettings } from '@/features/sales/api';
import { FieldInput } from '@/features/sales/fields';
import { useDocumentTitle } from '@/hooks';
import { SALES_FIELD_TYPE_MAP } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { FieldEditorModal } from './FieldEditorModal';
import { FieldTypeIcon } from './FieldTypeIcon';

function SettingsCard({ fields, settings }) {
  const updateSettings = useUpdateSalesSettings();
  const [currency, setCurrency] = useState(settings.currency);

  const save = async (patch, message) => {
    try {
      await updateSettings.mutateAsync(patch);
      toast.success(message);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const dropdowns = fields.filter((f) => f.type === 'dropdown');
  const numeric = fields.filter((f) => ['number', 'currency'].includes(f.type));

  return (
    <Card>
      <CardHeader icon={Settings2} title="Board & pipeline" description="How leads are grouped and valued." />
      <div className="space-y-4 px-5 pb-5">
        <FormField label="Group Kanban columns by" hint="Columns are the options of this dropdown field.">
          {(ids) => (
            <Select {...ids} value={settings.kanbanGroupField} onChange={(e) => save({ kanbanGroupField: e.target.value }, 'Kanban grouping updated')}>
              {dropdowns.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Pipeline value field" hint="Summed per column and on dashboards.">
          {(ids) => (
            <Select
              {...ids}
              value={settings.valueField ?? ''}
              onChange={(e) => save({ valueField: e.target.value || null }, 'Value field updated')}
              placeholder="None"
            >
              {numeric.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Currency" hint="3-letter ISO code, e.g. INR, USD, EUR.">
          {(ids) => (
            <div className="flex gap-2">
              <Input
                {...ids}
                value={currency}
                maxLength={3}
                className="w-24 font-mono uppercase"
                onChange={(e) => setCurrency(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
              />
              <Button
                variant="secondary"
                disabled={currency === settings.currency || currency.length !== 3}
                loading={updateSettings.isPending}
                onClick={() => save({ currency }, 'Currency updated')}
              >
                Save
              </Button>
            </div>
          )}
        </FormField>
      </div>
    </Card>
  );
}

function FormPreview({ fields, currency }) {
  const [values, setValues] = useState({});
  const visible = fields.filter((f) => f.isVisible);
  return (
    <Card>
      <CardHeader icon={Sparkles} title="Form preview" description="Exactly what employees see when adding a lead." />
      <div className="px-5 pb-5">
        <div className="space-y-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4">
          {visible.map((field) => (
            <FormField key={field.id} label={field.label} required={field.required} hint={field.helpText}>
              {(ids) => (
                <FieldInput
                  {...ids}
                  field={field}
                  currency={currency}
                  value={values[field.key] ?? field.defaultValue ?? (field.type === 'checkbox' ? false : '')}
                  onChange={(value) => setValues((prev) => ({ ...prev, [field.key]: value }))}
                />
              )}
            </FormField>
          ))}
          {!visible.length && <p className="text-sm text-slate-500">No visible fields.</p>}
        </div>
      </div>
    </Card>
  );
}

export default function SalesConfigPage() {
  useDocumentTitle('Sales Configuration');
  const { data, isPending, isError, error, refetch } = useSalesConfig({ includeArchived: true });
  const updateField = useUpdateField();
  const archiveField = useArchiveField();
  const deleteField = useDeleteField();
  const reorder = useReorderFields();

  const [editor, setEditor] = useState({ open: false, field: null });
  const [confirm, setConfirm] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [localOrder, setLocalOrder] = useState(null);

  const allFields = useMemo(() => data?.fields ?? [], [data]);
  const activeFields = useMemo(() => {
    const active = allFields.filter((f) => !f.isArchived);
    if (!localOrder) return active;
    const byId = new Map(active.map((f) => [f.id, f]));
    return localOrder.map((id) => byId.get(id)).filter(Boolean);
  }, [allFields, localOrder]);
  const archivedFields = allFields.filter((f) => f.isArchived);
  const settings = data?.settings;

  const run = async (promise, message) => {
    try {
      await promise;
      if (message) toast.success(message);
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  };

  const move = async (index, delta) => {
    const ids = activeFields.map((f) => f.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + delta, 0, id);
    setLocalOrder(ids);
    const ok = await run(reorder.mutateAsync(ids));
    // Server data now reflects the order (or we roll back on failure).
    setLocalOrder(null);
    if (!ok) refetch();
  };

  const toggle = (field, patch, message) => run(updateField.mutateAsync({ id: field.id, ...patch }), message);

  const handleConfirm = async () => {
    const { type, field } = confirm;
    const ok =
      type === 'delete'
        ? await run(deleteField.mutateAsync(field.id), 'Field deleted')
        : await run(archiveField.mutateAsync({ id: field.id, archived: true }), 'Field archived');
    if (ok) setConfirm(null);
  };

  const usedBySettings = (field) => settings && (settings.kanbanGroupField === field.key || settings.valueField === field.key);

  return (
    <>
      <PageHeader
        title="Sales Configuration"
        description="Design the Sales form without a developer. Changes apply instantly for everyone."
        actions={
          <Button leftIcon={Plus} onClick={() => setEditor({ open: true, field: null })}>
            Add field
          </Button>
        }
      />

      {isError ? (
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Form fields"
                description={isPending ? 'Loading…' : `${activeFields.length} active fields, shown in this order`}
              />
              {isPending ? (
                <div className="space-y-2 px-5 pb-5">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : (
                <ul className="space-y-2 px-3 pb-3 sm:px-5 sm:pb-5">
                  {activeFields.map((field, index) => (
                    <li
                      key={field.id}
                      className={cn(
                        'group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300',
                        !field.isVisible && 'bg-slate-50/80',
                      )}
                    >
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => move(index, -1)}
                          disabled={index === 0 || reorder.isPending}
                          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25"
                          aria-label={`Move ${field.label} up`}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(index, 1)}
                          disabled={index === activeFields.length - 1 || reorder.isPending}
                          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25"
                          aria-label={`Move ${field.label} down`}
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>

                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <FieldTypeIcon type={field.type} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className={cn('truncate text-sm font-semibold', field.isVisible ? 'text-slate-900' : 'text-slate-500')}>{field.label}</p>
                          {field.required && <Badge tone="red">Required</Badge>}
                          {field.isSystem && (
                            <Hint content="System field: can be relabelled but not removed">
                              <span>
                                <Badge tone="slate">
                                  <Lock size={10} /> System
                                </Badge>
                              </span>
                            </Hint>
                          )}
                          {settings?.kanbanGroupField === field.key && <Badge tone="violet">Kanban</Badge>}
                          {settings?.valueField === field.key && <Badge tone="green">Pipeline value</Badge>}
                          {!field.isVisible && <Badge tone="amber">Hidden</Badge>}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {SALES_FIELD_TYPE_MAP[field.type]?.label}
                          <span className="mx-1.5 text-slate-300">·</span>
                          <code className="font-mono">{field.key}</code>
                          {field.type === 'dropdown' && (
                            <>
                              <span className="mx-1.5 text-slate-300">·</span>
                              {field.options.length} options
                            </>
                          )}
                        </p>
                      </div>

                      <div className="hidden items-center gap-4 md:flex">
                        <Hint content={field.isSystem ? 'System fields are always on the form' : field.isVisible ? 'Shown on form' : 'Hidden from form'}>
                          <label className="flex items-center gap-2 text-xs text-slate-500">
                            {field.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                            <Switch
                              size="sm"
                              checked={field.isVisible}
                              disabled={field.isSystem || updateField.isPending}
                              onChange={(checked) => toggle(field, { isVisible: checked }, checked ? `“${field.label}” is now on the form` : `“${field.label}” hidden from the form`)}
                              label={`Show ${field.label} on form`}
                            />
                          </label>
                        </Hint>
                        <Hint content={field.showInList ? 'Shown in List View' : 'Not in List View'}>
                          <label className="flex items-center gap-2 text-xs text-slate-500">
                            <Table2 size={14} />
                            <Switch
                              size="sm"
                              checked={field.showInList}
                              disabled={updateField.isPending}
                              onChange={(checked) => toggle(field, { showInList: checked })}
                              label={`Show ${field.label} in list view`}
                            />
                          </label>
                        </Hint>
                      </div>

                      <Button variant="ghost" size="icon-sm" onClick={() => setEditor({ open: true, field })} aria-label={`Edit ${field.label}`}>
                        <Pencil size={15} />
                      </Button>
                      <Menu
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${field.label}`}>
                            <Ellipsis size={16} />
                          </Button>
                        }
                      >
                        <MenuItem icon={Pencil} onSelect={() => setEditor({ open: true, field })}>
                          Edit field
                        </MenuItem>
                        <MenuItem icon={field.isVisible ? EyeOff : Eye} disabled={field.isSystem} onSelect={() => toggle(field, { isVisible: !field.isVisible })}>
                          {field.isVisible ? 'Hide from form' : 'Show on form'}
                        </MenuItem>
                        <MenuSeparator />
                        <MenuItem icon={Archive} disabled={field.isSystem || usedBySettings(field)} onSelect={() => setConfirm({ type: 'archive', field })}>
                          Archive
                        </MenuItem>
                        <MenuItem icon={Trash2} tone="danger" disabled={field.isSystem || usedBySettings(field)} onSelect={() => setConfirm({ type: 'delete', field })}>
                          Delete
                        </MenuItem>
                      </Menu>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {archivedFields.length > 0 && (
              <Card>
                <button
                  type="button"
                  onClick={() => setShowArchived((v) => !v)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                  aria-expanded={showArchived}
                >
                  <span>
                    <span className="block text-[15px] font-semibold text-slate-900">Archived fields</span>
                    <span className="text-xs text-slate-500">{archivedFields.length} archived — data is preserved on existing leads</span>
                  </span>
                  <ChevronDown size={18} className={cn('text-slate-400 transition-transform', showArchived && 'rotate-180')} />
                </button>
                {showArchived && (
                  <ul className="space-y-2 px-5 pb-5">
                    {archivedFields.map((field) => (
                      <li key={field.id} className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 p-3">
                        <span className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                          <FieldTypeIcon type={field.type} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-600">{field.label}</p>
                          <p className="text-xs text-slate-400">
                            {SALES_FIELD_TYPE_MAP[field.type]?.label} · <code className="font-mono">{field.key}</code>
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={ArchiveRestore}
                          loading={archiveField.isPending && archiveField.variables?.id === field.id}
                          onClick={() => run(archiveField.mutateAsync({ id: field.id, archived: false }), `“${field.label}” restored`)}
                        >
                          Restore
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setConfirm({ type: 'delete', field })} aria-label={`Delete ${field.label}`}>
                          <Trash2 size={15} />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </div>

          <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            {isPending ? (
              <Skeleton className="h-64 w-full rounded-2xl" />
            ) : (
              <>
                <SettingsCard key={settings.updatedAt} fields={activeFields} settings={settings} />
                <FormPreview fields={activeFields} currency={settings.currency} />
              </>
            )}
          </div>
        </div>
      )}

      <FieldEditorModal
        open={editor.open}
        field={editor.field}
        currency={settings?.currency}
        onOpenChange={(open) => setEditor((prev) => ({ ...prev, open }))}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        tone={confirm?.type === 'delete' ? 'danger' : 'primary'}
        title={confirm?.type === 'delete' ? `Delete “${confirm?.field.label}”?` : `Archive “${confirm?.field.label}”?`}
        description={
          confirm?.type === 'delete'
            ? 'The field will be removed permanently. This is only possible when no lead has a value for it — otherwise archive it instead.'
            : 'The field will be removed from the form and List View. Values already saved on leads are kept, and you can restore it any time.'
        }
        confirmLabel={confirm?.type === 'delete' ? 'Delete field' : 'Archive field'}
        loading={deleteField.isPending || archiveField.isPending}
        onConfirm={handleConfirm}
      />
    </>
  );
}
