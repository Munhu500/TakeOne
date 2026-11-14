'use client';
import { Button, ErrorState } from '@/components/ui';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorState title={error.message ? `This page could not be loaded: ${error.message}` : 'This page could not be loaded.'} retry={<Button variant="secondary" onClick={reset}>Try again</Button>} />;
}
