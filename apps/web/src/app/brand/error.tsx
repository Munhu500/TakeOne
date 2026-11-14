'use client';
import { Button } from '@/components/ui';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <div className="font-medium">Something went wrong</div>
      <p className="mt-2 text-sm text-muted">{error.message || 'The page could not be loaded.'}</p>
      <Button className="mt-5" onClick={reset}>Try again</Button>
    </div>
  );
}
