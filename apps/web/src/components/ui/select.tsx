'use client';
import * as Pop from '@radix-ui/react-popover';
import * as RSelect from '@radix-ui/react-select';
import { Check, ChevronDown, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ICON } from './index';

export interface Option { value: string; label: string; icon?: ReactNode }
const TRIGGER = 'input flex items-center justify-between gap-3 text-left data-[placeholder]:text-tertiary';
const LIST = 'z-dropdown overflow-hidden rounded-md border border-border-strong bg-surface-2 shadow-float';
const ITEM = 'flex h-control-md cursor-pointer select-none items-center gap-3 rounded-sm px-3 text-small text-primary outline-none transition-colors duration-fast';

/** Replaces every native <select>. Label above, 48px, keyboard accessible. */
export function Select({ id, label, value, onValueChange, options, placeholder = 'Choose', helper, className, compact }: {
  id: string; label: string; value: string; onValueChange: (v: string) => void; options: Option[]; placeholder?: string; helper?: ReactNode; className?: string; compact?: boolean;
}) {
  return (
    <div className={className}>
      <label className={compact ? 'sr-only' : 'label'} htmlFor={id}>{label}</label>
      <RSelect.Root value={value || undefined} onValueChange={onValueChange}>
        <RSelect.Trigger id={id} aria-label={label} className={cn(TRIGGER, compact && 'h-control-sm text-small')}>
          <RSelect.Value placeholder={placeholder} />
          <RSelect.Icon><ChevronDown size={16} {...ICON} className="text-tertiary" /></RSelect.Icon>
        </RSelect.Trigger>
        <RSelect.Portal>
          <RSelect.Content position="popper" sideOffset={8} className={cn(LIST, 'max-h-80 min-w-[var(--radix-select-trigger-width)]')}>{/* tokens-allow: width follows the trigger (Radix variable) */}
            <RSelect.Viewport className="p-1">
              {options.map((o) => (
                <RSelect.Item key={o.value} value={o.value} className={cn(ITEM, 'data-[highlighted]:bg-surface-3')}>
                  {o.icon}
                  <RSelect.ItemText>{o.label}</RSelect.ItemText>
                  <RSelect.ItemIndicator className="ml-auto"><Check size={16} {...ICON} /></RSelect.ItemIndicator>
                </RSelect.Item>
              ))}
            </RSelect.Viewport>
          </RSelect.Content>
        </RSelect.Portal>
      </RSelect.Root>
      {helper && !compact && <p className="helper">{helper}</p>}
    </div>
  );
}

/** Select with type-to-filter, for longer lists. */
export function Combobox({ id, label, value, onValueChange, options, placeholder = 'Search', helper }: { id: string; label: string; value: string; onValueChange: (v: string) => void; options: Option[]; placeholder?: string; helper?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const shown = useMemo(() => options.filter((o) => o.label.toLowerCase().includes(q.trim().toLowerCase())), [options, q]);
  const current = options.find((o) => o.value === value);
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <Pop.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(''); }}>
        <Pop.Trigger asChild>
          <button id={id} type="button" role="combobox" aria-expanded={open} aria-controls={`${id}-list`} className={cn(TRIGGER, !current && 'text-tertiary')}>
            <span className="flex min-w-0 items-center gap-3 truncate">{current?.icon}{current?.label ?? 'Choose'}</span>
            <ChevronDown size={16} {...ICON} className="shrink-0 text-tertiary" />
          </button>
        </Pop.Trigger>
        <Pop.Portal>
          <Pop.Content align="start" sideOffset={8} className={cn(LIST, 'w-[var(--radix-popover-trigger-width)]')}>{/* tokens-allow: width follows the trigger (Radix variable) */}
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search size={16} {...ICON} className="text-tertiary" />
              <input autoFocus aria-label={placeholder} placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} className="h-control-md w-full bg-transparent text-small text-primary placeholder:text-tertiary focus:outline-none" />
            </div>
            <ul id={`${id}-list`} role="listbox" className="max-h-64 overflow-y-auto p-1">
              {shown.length === 0 && <li className="px-3 py-3 text-small text-tertiary">No matches</li>}
              {shown.map((o) => (
                <li key={o.value} role="option" aria-selected={o.value === value}>
                  <button type="button" className={cn(ITEM, 'w-full hover:bg-surface-3 focus-visible:bg-surface-3')} onClick={() => { onValueChange(o.value); setOpen(false); setQ(''); }}>
                    {o.icon}<span className="truncate">{o.label}</span>{o.value === value && <Check size={16} {...ICON} className="ml-auto" />}
                  </button>
                </li>
              ))}
            </ul>
          </Pop.Content>
        </Pop.Portal>
      </Pop.Root>
      {helper && <p className="helper">{helper}</p>}
    </div>
  );
}

/** surface-2 track with a white selected pill. For switching views inside a page. */
export function SegmentedControl<T extends string>({ label, value, onChange, options, size = 'md' }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-surface-2 p-1">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn('tabular rounded-full px-4 text-small font-medium transition duration-fast ease-standard active:scale-press', size === 'sm' ? 'h-8' : 'h-control-sm', value === o.value ? 'bg-inverse text-on-inverse' : 'text-secondary hover:text-primary')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
