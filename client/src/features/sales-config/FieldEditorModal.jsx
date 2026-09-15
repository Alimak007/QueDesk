import { ArrowDown, ArrowUp, Lock, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button, FormField, Input, Modal, Switch } from '@/components/ui';
import { FieldInput } from '@/features/sales/fields';
import { useCreateField, useUpdateField } from '@/features/sales/api';
import { useResetOnChange } from '@/hooks';
import { applyServerErrors } from '@/lib/api';
import { OPTION_COLORS, SALES_FIELD_TYPE_MAP, SALES_FIELD_TYPES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { FieldTypeIcon } from './FieldTypeIcon';

const COLOR_NAMES = Object.keys(OPTION_COLORS);

const slugify = (text) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);

const camelKey = (label) => {
  const words = label.replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const key = words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join('');
  return key.replace(/^[^a-z]+/, '').slice(0, 32);
};

const blank = () => ({
  label: '',
  key: '',
  type: 'text',
  required: false,
  isVisible: true,
  showInList: true,
  placeholder: '',
  helpText: '',
  defaultValue: '',
  options: [],
});

function OptionsEditor({ options, onChange, error }) {
  const update = (index, patch) => onChange(options.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  const move = (index, delta) => {
    const next = [...options];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] font-medium text-slate-700">
          Options <span className="text-red-500">*</span>
        </span>
        <Button
          variant="soft"
          size="xs"
          leftIcon={Plus}
          onClick={() => onChange([...options, { label: '', value: '', color: COLOR_NAMES[options.length % COLOR_NAMES.length], isNew: true }])}
        >
          Add option
        </Button>
      </div>
      <ul className="space-y-2">
        {options.map((option, index) => (
          <li key={index} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
            <div className="flex flex-col">
              <button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label="Move option up">
                <ArrowUp size={13} />
              </button>
              <button type="button" disabled={index === options.length - 1} onClick={() => move(index, 1)} className="text-slate-400 hover:text-slate-700 disabled:opacity-30" aria-label="Move option down">
                <ArrowDown size={13} />
              </button>
            </div>
            <Input
              aria-label={`Option ${index + 1} label`}
              value={option.label}
              placeholder="Label"
              className="h-8"
              onChange={(e) => update(index, { label: e.target.value, ...(option.isNew ? { value: slugify(e.target.value) } : {}) })}
            />
            <code className="hidden w-28 shrink-0 truncate rounded bg-slate-100 px-1.5 py-1 text-[11px] text-slate-500 sm:block" title="Stored value (fixed once saved)">
              {option.value || 'value'}
            </code>
            <div className="flex shrink-0 gap-1" role="radiogroup" aria-label="Colour">
              {COLOR_NAMES.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={option.color === color}
                  aria-label={color}
                  onClick={() => update(index, { color })}
                  className={cn(
                    'size-4 rounded-full transition-transform',
                    OPTION_COLORS[color].dot,
                    option.color === color ? 'scale-110 ring-2 ring-slate-900/60 ring-offset-1' : 'opacity-60 hover:opacity-100',
                    'max-md:[&:nth-child(n+6)]:hidden',
                  )}
                />
              ))}
            </div>
            <Button variant="ghost" size="icon-xs" onClick={() => onChange(options.filter((_, i) => i !== index))} aria-label="Remove option" disabled={options.length === 1}>
              <Trash2 size={14} />
            </Button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
      <p className="mt-1.5 text-xs text-slate-500">
        Removing an option does not change existing leads; they’ll show as uncategorised on the Kanban board.
      </p>
    </div>
  );
}

export function FieldEditorModal({ open, onOpenChange, field, currency }) {
  const isEdit = Boolean(field);
  const create = useCreateField();
  const update = useUpdateField();
  const mutation = isEdit ? update : create;

  const [values, setValues] = useState(blank);
  const [keyTouched, setKeyTouched] = useState(false);
  const [errors, setErrors] = useState({});

  const reopened = useResetOnChange(open ? (field?.id ?? 'new') : null);
  if (reopened) {
    setErrors({});
    setKeyTouched(false);
    setValues(
      field
        ? {
            ...blank(),
            ...field,
            placeholder: field.placeholder ?? '',
            helpText: field.helpText ?? '',
            defaultValue: field.defaultValue ?? '',
            options: field.options?.map((o) => ({ ...o })) ?? [],
          }
        : blank(),
    );
  }

  const set = (patch) => {
    setValues((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  };

  const previewField = useMemo(() => ({ ...values, options: values.options.filter((o) => o.value) }), [values]);

  const validate = () => {
    const next = {};
    if (!values.label.trim()) next.label = 'Label is required';
    if (!isEdit && values.key && !/^[a-z][a-zA-Z0-9]{0,39}$/.test(values.key)) {
      next.key = 'Start with a lowercase letter; letters and numbers only';
    }
    if (values.type === 'dropdown') {
      if (!values.options.length) next.options = 'Add at least one option';
      else if (values.options.some((o) => !o.label.trim() || !o.value)) next.options = 'Every option needs a label';
      else if (new Set(values.options.map((o) => o.value)).size !== values.options.length) next.options = 'Option labels must be unique';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      label: values.label.trim(),
      required: values.required,
      isVisible: values.isVisible,
      showInList: values.showInList,
      placeholder: values.placeholder,
      helpText: values.helpText,
      defaultValue:
        values.defaultValue === '' || values.defaultValue === null
          ? null
          : ['number', 'currency'].includes(values.type)
            ? Number(values.defaultValue)
            : values.defaultValue,
      ...(values.type === 'dropdown' ? { options: values.options.map(({ value, label, color }) => ({ value, label: label.trim(), color })) } : {}),
    };

    try {
      if (isEdit) await update.mutateAsync({ id: field.id, ...payload });
      else await create.mutateAsync({ ...payload, type: values.type, ...(values.key ? { key: values.key } : {}) });
      toast.success(isEdit ? 'Field updated' : 'Field added', { description: 'The Sales form now reflects this change.' });
      onOpenChange(false);
    } catch (err) {
      const fieldErrors = {};
      if (applyServerErrors(err, (path, { message }) => (fieldErrors[path.split('.')[0]] = message))) setErrors(fieldErrors);
      else toast.error(err.message);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={isEdit ? `Edit “${field.label}”` : 'Add a field'}
      description={isEdit ? 'Changes apply immediately to the Sales form for everyone.' : 'New fields appear on the Add / Edit lead form straight away.'}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="field-form" loading={mutation.isPending}>
            {isEdit ? 'Save field' : 'Add field'}
          </Button>
        </>
      }
    >
      <form id="field-form" onSubmit={submit} noValidate className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Label" required error={errors.label}>
              {(ids) => (
                <Input
                  {...ids}
                  value={values.label}
                  placeholder="e.g. Industry"
                  maxLength={60}
                  onChange={(e) => set({ label: e.target.value, ...(!isEdit && !keyTouched ? { key: camelKey(e.target.value) } : {}) })}
                />
              )}
            </FormField>
            <FormField
              label="Key"
              error={errors.key}
              hint={isEdit ? 'Keys are permanent so stored data stays linked.' : 'Used to store values. Cannot be changed later.'}
            >
              {(ids) => (
                <Input
                  {...ids}
                  value={values.key}
                  readOnly={isEdit}
                  placeholder="industry"
                  className={cn('font-mono text-[13px]', isEdit && 'bg-slate-50 text-slate-500')}
                  onChange={(e) => {
                    setKeyTouched(true);
                    set({ key: e.target.value.replace(/[^A-Za-z0-9]/g, '') });
                  }}
                  leftIcon={isEdit ? Lock : undefined}
                />
              )}
            </FormField>
          </div>

          <div>
            <p className="mb-1.5 text-[13px] font-medium text-slate-700">
              Field type {isEdit && <span className="font-normal text-slate-400">— locked after creation</span>}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Field type">
              {SALES_FIELD_TYPES.map((type) => {
                const active = values.type === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={isEdit && !active}
                    title={type.description}
                    onClick={() =>
                      set({
                        type: type.value,
                        defaultValue: '',
                        options: type.value === 'dropdown' && !values.options.length ? [{ label: '', value: '', color: 'blue', isNew: true }] : values.options,
                      })
                    }
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-35',
                      active ? 'border-brand-500 bg-brand-50/70 text-brand-800 ring-4 ring-brand-500/10' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    <FieldTypeIcon type={type.value} size={17} />
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>

          {values.type === 'dropdown' && <OptionsEditor options={values.options} onChange={(options) => set({ options })} error={errors.options} />}

          <div className="grid gap-4 sm:grid-cols-2">
            {values.type !== 'checkbox' && values.type !== 'dropdown' && values.type !== 'date' && (
              <FormField label="Placeholder" error={errors.placeholder}>
                {(ids) => <Input {...ids} value={values.placeholder} maxLength={120} onChange={(e) => set({ placeholder: e.target.value })} />}
              </FormField>
            )}
            <FormField label="Help text" error={errors.helpText} className={values.type === 'checkbox' || values.type === 'dropdown' || values.type === 'date' ? 'sm:col-span-2' : undefined}>
              {(ids) => <Input {...ids} value={values.helpText} maxLength={200} placeholder="Shown below the input" onChange={(e) => set({ helpText: e.target.value })} />}
            </FormField>
          </div>

          <FormField label="Default value" error={errors.defaultValue} hint="Pre-filled when someone adds a new lead.">
            {(ids) => (
              <FieldInput
                {...ids}
                field={{ ...previewField, placeholder: previewField.type === 'dropdown' ? 'No default' : 'No default', required: false }}
                currency={currency}
                value={values.defaultValue}
                onChange={(value) => set({ defaultValue: value })}
              />
            )}
          </FormField>

          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {[
              { key: 'required', label: 'Required', description: 'The form cannot be submitted without a value.', locked: field?.isSystem },
              { key: 'isVisible', label: 'Show on form', description: 'Hidden fields keep their data but are not editable.', locked: field?.isSystem },
              { key: 'showInList', label: 'Show in List View', description: 'Display as a column in the leads table.' },
            ].map((toggle) => (
              <div key={toggle.key} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                    {toggle.label} {toggle.locked && <Lock size={12} className="text-slate-400" />}
                  </p>
                  <p className="text-xs text-slate-500">{toggle.locked ? 'Required by the system for this field.' : toggle.description}</p>
                </div>
                <Switch checked={Boolean(values[toggle.key])} disabled={toggle.locked} onChange={(checked) => set({ [toggle.key]: checked })} label={toggle.label} />
              </div>
            ))}
          </div>
        </div>

        <aside className="lg:sticky lg:top-0 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Live preview</p>
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
            <FormField label={values.label || 'Field label'} required={values.required} hint={values.helpText}>
              {(ids) => (
                <FieldInput
                  {...ids}
                  field={{ ...previewField, label: values.label || 'field' }}
                  currency={currency}
                  value={values.defaultValue}
                  onChange={() => {}}
                />
              )}
            </FormField>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
              <FieldTypeIcon type={values.type} size={13} /> {SALES_FIELD_TYPE_MAP[values.type]?.description}
            </p>
          </div>
        </aside>
      </form>
    </Modal>
  );
}
