'use client';
import * as Dialog from '@radix-ui/react-dialog';
import * as Menu from '@radix-ui/react-dropdown-menu';
import * as Pop from '@radix-ui/react-popover';
import * as Tip from '@radix-ui/react-tooltip';
import { X } from 'lucide-react';
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button, ICON } from './index';

const FLOAT = 'z-dropdown rounded-md border border-border-strong bg-surface-2 shadow-float';

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tip.Provider delayDuration={300}>
      <Tip.Root>
        <Tip.Trigger asChild>{children}</Tip.Trigger>
        <Tip.Portal><Tip.Content sideOffset={8} className={cn(FLOAT, 'z-toast rounded-sm px-3 py-2 text-caption text-primary')}>{label}</Tip.Content></Tip.Portal>
      </Tip.Root>
    </Tip.Provider>
  );
}
/** Square icon-only button. The label is required: it is the tooltip and the accessible name. */
export function IconButton({ label, children, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <Tooltip label={label}>
      <button type="button" aria-label={label} {...p} className={cn('inline-grid size-control-sm shrink-0 place-items-center rounded-sm text-secondary transition duration-fast ease-standard hover:bg-surface-3 hover:text-primary active:scale-press disabled:pointer-events-none disabled:opacity-40', className)}>{children}</button>
    </Tooltip>
  );
}
export function Popover({ trigger, children, align = 'start', side, className, open, onOpenChange }: { trigger: ReactNode; children: ReactNode; align?: 'start' | 'center' | 'end'; side?: 'top' | 'right' | 'bottom' | 'left'; className?: string; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  return (
    <Pop.Root open={open} onOpenChange={onOpenChange}>
      <Pop.Trigger asChild>{trigger}</Pop.Trigger>
      <Pop.Portal><Pop.Content align={align} side={side} sideOffset={8} collisionPadding={12} className={cn(FLOAT, 'w-72 p-4 text-small', className)}>{children}</Pop.Content></Pop.Portal>
    </Pop.Root>
  );
}
export function DropdownMenu({ trigger, items, align = 'end' }: { trigger: ReactNode; items: { label: string; onSelect: () => void; destructive?: boolean; disabled?: boolean }[]; align?: 'start' | 'end' }) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align={align} sideOffset={8} className={cn(FLOAT, 'min-w-48 p-1')}>
          {items.map((i) => (
            <Menu.Item key={i.label} disabled={i.disabled} onSelect={i.onSelect} className={cn('flex h-control-sm cursor-pointer select-none items-center rounded-sm px-3 text-small outline-none transition-colors duration-fast data-[disabled]:pointer-events-none data-[highlighted]:bg-surface-3 data-[disabled]:opacity-40', i.destructive ? 'text-danger-text' : 'text-primary')}>{i.label}</Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

function Overlay() {
  return <Dialog.Overlay className="fixed inset-0 z-modal bg-scrim" />;
}
export function Modal({ open, onOpenChange, title, description, children, footer }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: ReactNode; children?: ReactNode; footer?: ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Overlay />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-modal w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border-strong bg-surface-1 p-6 shadow-float focus:outline-none">
          <Dialog.Title className="text-h3">{title}</Dialog.Title>
          {description && <Dialog.Description className="mt-2 text-small text-secondary">{description}</Dialog.Description>}
          {children && <div className="mt-4">{children}</div>}
          {footer && <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div>}
          <Dialog.Close asChild><button aria-label="Close" className="absolute right-4 top-4 inline-grid size-control-sm place-items-center rounded-sm text-secondary transition-colors duration-fast hover:bg-surface-3 hover:text-primary"><X size={16} {...ICON} /></button></Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
/**
 * Restates the effect of the action before it happens. Destructive confirms can require a typed phrase
 * (`requireText`) or a written reason (`requireReason`).
 */
export function ConfirmDialog({ open, onOpenChange, title, effect, confirmLabel, destructive, requireText, requireReason, busy, onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; effect: ReactNode; confirmLabel: string; destructive?: boolean; requireText?: string; requireReason?: boolean; busy?: boolean; onConfirm: (reason: string) => void;
}) {
  const [text, setText] = useState('');
  const blocked = (requireText !== undefined && text.trim() !== requireText) || (requireReason && text.trim().length < 3);
  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) setText(''); onOpenChange(o); }} title={title} description={effect}
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant={destructive ? 'destructive' : 'primary'} disabled={blocked} loading={busy} onClick={() => onConfirm(text.trim())}>{confirmLabel}</Button></>}>
      {(requireText !== undefined || requireReason) && (
        <div>
          <label className="label" htmlFor="confirm-input">{requireText !== undefined ? `Type “${requireText}” to confirm` : 'Reason'}</label>
          <input id="confirm-input" className="input" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      )}
    </Modal>
  );
}
/** Right-side panel for detail views. Radius xl on the leading edge. */
export function Drawer({ open, onOpenChange, title, children, footer }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Overlay />
        <Dialog.Content className="fixed inset-y-0 right-0 z-drawer flex w-full max-w-lg flex-col rounded-l-xl border-l border-border-strong bg-surface-1 shadow-float focus:outline-none">
          <div className="flex items-center justify-between gap-4 border-b border-border p-6">
            <Dialog.Title className="text-h3">{title}</Dialog.Title>
            <Dialog.Close asChild><button aria-label="Close" className="inline-grid size-control-sm place-items-center rounded-sm text-secondary transition-colors duration-fast hover:bg-surface-3 hover:text-primary"><X size={16} {...ICON} /></button></Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-6">{children}</div>
          {footer && <div className="glass flex flex-wrap justify-end gap-3 border-b-0 border-t p-6">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
