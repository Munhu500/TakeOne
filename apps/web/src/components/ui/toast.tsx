'use client';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useSyncExternalStore } from 'react';
import { motionPresets } from '@takeone/design-tokens';

interface ToastItem { id: number; text: string; tone: 'neutral' | 'danger' }
let items: ToastItem[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());
const EMPTY: ToastItem[] = [];

/** Bottom-centre, 4s auto-dismiss. Call from anywhere in client code. */
export function toast(text: string, tone: ToastItem['tone'] = 'neutral') {
  const id = Date.now() + Math.random();
  items = [...items, { id, text, tone }];
  emit();
  setTimeout(() => { items = items.filter((i) => i.id !== id); emit(); }, 4000);
}
export function ToastHost() {
  const list = useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => items, () => EMPTY);
  const reduced = useReducedMotion();
  useEffect(() => () => { items = []; }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-toast flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {list.map((t) => (
          <motion.div key={t.id} {...(reduced ? motionPresets.fade : motionPresets.toast)} role="status" className={`pointer-events-auto max-w-md rounded-md border border-border-strong bg-surface-2 px-4 py-3 text-small shadow-float ${t.tone === 'danger' ? 'text-danger-text' : 'text-primary'}`}>
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
