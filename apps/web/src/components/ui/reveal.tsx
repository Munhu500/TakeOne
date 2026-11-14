'use client';
import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { motionPresets } from '@takeone/design-tokens';

/** Section reveal: fade + 16px rise, children staggered 60ms, once. Reduced motion keeps the fade only. */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.div className={className} variants={motionPresets.revealContainer} initial="hidden" whileInView="show" viewport={motionPresets.viewport}>{children}</motion.div>;
}
export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return <motion.div className={className} variants={reduced ? motionPresets.revealItemReduced : motionPresets.revealItem}>{children}</motion.div>;
}
