import { LinkButton } from '@/components/ui';
import { Wordmark } from '@/components/shell';

export default function Creators() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <Wordmark name="TakeOne" />
      <h1 className="mt-8 font-display text-4xl font-semibold">Creators use the app</h1>
      <p className="mt-3 text-muted">Find paid campaigns, shoot one take, and let the Variant Engine do the editing. You keep 75% of the campaign fee and of every license after it.</p>
      <p className="mt-3 text-sm text-faint">The creator app runs on iOS and Android (Expo). In this demo it is also served as a web build — see the README for the address.</p>
      <div className="mt-6"><LinkButton href="/" variant="secondary">Back to home</LinkButton></div>
    </div>
  );
}
